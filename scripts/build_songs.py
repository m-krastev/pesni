#!/usr/bin/env python3
"""Build the website's songs from typ/songs/*.typ, the single source of truth.

For every song this writes
  - src/data/songs/NNN.json   lyrics, sections and chords for <ChordSheet>,
  - docs/NNN.md               the page (generated: edit the .typ file instead),
  - static/chords/*_akord.pdf the printable chord sheet, rendered with typ/single.typ
                              (only when the .typ is newer than the PDF).

Runs before `npm run build` / `npm start` (see package.json).

    python3 scripts/build_songs.py                  # everything
    python3 scripts/build_songs.py 23 218           # selected song numbers
    python3 scripts/build_songs.py --force-pdf 23   # re-render the PDF even if up to date
    python3 scripts/build_songs.py --png DIR 23     # PNG preview pages into DIR, nothing else
"""
import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SONGS = ROOT / "typ" / "songs"
DOCS = ROOT / "docs"
STATIC = ROOT / "static"
DATA = ROOT / "src" / "data" / "songs"
TEMPLATE = ROOT / "typ" / "single.typ"

CHORD_RE = re.compile(r"(?<!\[)\[[^\[\]]+\](?!\])")
TOKEN_RE = re.compile(r"(?<!\[)\[([^\[\]]+)\](?!\]) ?")
HEADING_RE = re.compile(r"^\s*==+ `?\[\[(.+?)\]\]`?")
TITLE_RE = re.compile(r"^\s*= (.+)$", re.M)
# A `\` followed by whitespace is a manual line break; `\#`, `\-` etc. are escapes.
BREAK_RE = re.compile(r"\\(?=\s|$)")

SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]


def song_files():
    """Map song number -> typ file; on duplicates, prefer the file whose slug the doc links to."""
    candidates = {}
    for path in sorted(SONGS.glob("*.typ")):
        number = int(re.search(r"^\s*= (\d+)\.", path.read_text(), re.M).group(1))
        candidates.setdefault(number, []).append(path)
    found = {}
    for number, paths in candidates.items():
        doc = DOCS / f"{number:03d}.md"
        text = doc.read_text() if doc.exists() else ""
        found[number] = next((p for p in paths if p.stem[4:] in text), paths[0])
    return found


def transpose(chord, steps):
    if not steps:
        return chord
    def shift(m):
        note = m.group(0)
        names = FLATS if note.endswith("b") else SHARPS
        index = (SHARPS.index(note) if note in SHARPS else FLATS.index(note)) + steps
        return names[index % 12]
    return re.sub(r"(?:^|(?<=/))[A-G][#b]?", shift, chord)


def unescape(text):
    text = re.sub(r"/\*.*?\*/", "", text)
    text = re.sub(r"`[^`]*`", "", text)
    text = re.sub(r"\$[^$]*\$", " ", text)
    text = re.sub(r"#[hv]\([^)]*\)", "", text)
    text = re.sub(r"(?<![\w\\])_([^_]+)_", r"\1", text)
    text = re.sub(r"(?<![\w\\])\*([^*]+)\*", r"\1", text)
    return re.sub(r"\\(.)", r"\1", text)


def segments(line, steps):
    """Split a lyric line into [chord, text] pairs; the first chord may be None."""
    line = re.sub(r'#(?:inlinechord|ich)(?:\[([^\]]*)\]|\("([^"]*)"\))', lambda m: f"[{m.group(1) or m.group(2)}] ", line)
    parts = TOKEN_RE.split(line)
    segs = [[None, unescape(parts[0])]] if parts[0] else []
    for chord, text in zip(parts[1::2], parts[2::2]):
        segs.append([transpose(unescape(chord), steps), unescape(text)])
    return segs


def parse_song(source):
    """Return (title, sections) of a typ song module."""
    title = unescape(TITLE_RE.search(source).group(1)).strip()
    sections, current, steps = [], None, 0
    for raw in source.splitlines():
        line = raw.strip()
        if line.startswith(("//", "#let", "= ")) or line in ("]", "[", "})", "}"):
            continue
        heading = HEADING_RE.match(line)
        if heading:
            current = {"title": unescape(heading.group(1)), "lines": []}
            sections.append(current)
            continue
        tonality = re.match(r"#change-tonality\(\s*([+-]?\d+)\s*\)", line)
        if tonality:
            steps = int(tonality.group(1))
            continue
        if line.startswith("#") and not line.startswith(("#strong[", "#inlinechord", "#ich")):
            continue
        if current is None:
            current = {"title": "", "lines": []}
            sections.append(current)
        if not line:
            if current["lines"] and current["lines"][-1] is not None:
                current["lines"].append(None)
            continue
        progression = re.fullmatch(r"#strong\[(.*)\]\s*\\?", line)
        if progression:
            current["lines"].append({"progression": transpose_progression(unescape(progression.group(1)), steps)})
            continue
        for part in BREAK_RE.split(line):
            if part.strip():
                current["lines"].append(segments(part.strip(), steps))
    for section in sections:
        while section["lines"] and section["lines"][-1] is None:
            section["lines"].pop()
    return title, [s for s in sections if s["lines"] or s["title"]]


def transpose_progression(text, steps):
    return re.sub(r"[A-G][#b]?[^\s|:/]*(?:/[A-G][#b]?)?", lambda m: transpose(m.group(0), steps), text) if steps else text


def find_static(folder, number, slug, suffix):
    """Existing static file for the song: exact slug first, then any file with the song number."""
    names = {p.name.lower(): p.name for p in (STATIC / folder).iterdir()}
    exact = f"{number}-{slug}{suffix}".lower()
    if exact in names:
        return f"/{folder}/{names[exact]}"
    matches = sorted(n for low, n in names.items() if low.startswith(f"{number}-") and low.endswith(suffix.lower()))
    return f"/{folder}/{matches[0]}" if len(matches) == 1 else None


def mdx_text(text):
    return text.replace("{", "\\{").replace("}", "\\}").replace("<", "&lt;")


def write_doc(number, song_path, title, lyrics_pdf, chords_pdf):
    lines = [
        f"import song from '@site/src/data/songs/{number:03d}.json';",
        "",
        f"# {mdx_text(title)}",
        "",
        f"<!-- Generated from typ/songs/{song_path.name} by scripts/build_songs.py: edit the .typ file, not this page. -->",
        "",
        "<ChordSheet song={song} />",
    ]
    if lyrics_pdf:
        lines += ["", f'<DownloadsButton pdf="{lyrics_pdf}" />']
    if chords_pdf:
        lines += ["", f'<DownloadChordsButton pdf="{chords_pdf}"/>']
    doc = DOCS / f"{number:03d}.md"
    text = "\n".join(lines) + "\n"
    if not doc.exists() or doc.read_text() != text:
        doc.write_text(text)


def compile_song(song_path, out_path):
    subprocess.run(
        ["typst", "compile", "--root", str(ROOT),
         "--input", f"song={song_path.relative_to(ROOT / 'typ').as_posix()}",
         str(TEMPLATE), str(out_path)],
        check=True,
    )


def is_stale(song_path, pdf_path):
    if not pdf_path.exists():
        return True
    built = pdf_path.stat().st_mtime
    return built < song_path.stat().st_mtime or built < TEMPLATE.stat().st_mtime


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("numbers", nargs="*", type=int)
    parser.add_argument("--png", type=Path, help="only render PNG previews into this directory")
    parser.add_argument("--force-pdf", action="store_true")
    args = parser.parse_args()

    has_typst = shutil.which("typst") is not None
    if not has_typst and not args.png:
        print("warning: typst not found, chord PDFs are not re-rendered")
    DATA.mkdir(parents=True, exist_ok=True)
    rendered = 0
    files = song_files()
    for number, song_path in sorted(files.items()):
        if args.numbers and number not in args.numbers:
            continue
        source = song_path.read_text()
        has_chords = bool(CHORD_RE.search(source))
        if args.png:
            if has_chords:
                compile_song(song_path, args.png / f"song-{number}-{{p}}.png")
                print(f"{number}: {args.png}/song-{number}-*.png")
            continue

        title, sections = parse_song(source)
        data = {"id": f"{number:03d}", "sections": sections}
        (DATA / f"{number:03d}.json").write_text(json.dumps(data, ensure_ascii=False) + "\n")

        slug = song_path.stem[4:]
        chords_pdf = find_static("chords", number, slug, "_akord.pdf")
        if has_chords:
            chords_pdf = chords_pdf or f"/chords/{number}-{slug}_akord.pdf"
            pdf_path = STATIC / chords_pdf.lstrip("/")
            if has_typst and (args.force_pdf or is_stale(song_path, pdf_path)):
                compile_song(song_path, pdf_path)
                rendered += 1
        write_doc(number, song_path, title, find_static("pdf", number, slug, ".pdf"), chords_pdf)
    if not args.png:
        print(f"built {len(args.numbers) or len(files)} songs, rendered {rendered} chord PDFs")


if __name__ == "__main__":
    main()
