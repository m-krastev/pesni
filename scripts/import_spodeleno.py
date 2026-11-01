#!/usr/bin/env python3
"""One-time import of spodelenohvalenie.com into books/new/ (the "Нови" tab).

Reads the scrape made by scripts/scrape_spodeleno.py (spodeleno/songs.json, the
chord files in spodeleno/chords/ and their PDF exports in spodeleno/chords-pdf/).
Leaves out the hymnal (author "Духовни химни": that is Песнарка) and the songs
that are already in Песни. A song's number is its place in the scrape (stable:
new songs get the next numbers) minus the 733 hymns.

The site's text has sections ("Куплет 1>...<Припев>..."), rows separated by a
literal \\n and chord progressions in {Акорди}...{/Акорди}; progressions become
chord rows. A chorus written out again word for word becomes {chorus}. Chords
over the lyrics come from the song's chord file, placed with import_pdf_chords.py.
The site's author attributions are mostly wrong, so they are kept as editor notes
only, as is the English original it names.

    scripts/import_spodeleno.py [--write] [numbers...]

Needs pdfplumber (pip install pdfplumber) and node (to check chord names with the build's parser).
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_pdf_chords as chords  # noqa: E402
from import_pesnarka import slugify  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SCRAPE = ROOT / "spodeleno"
OUT = ROOT / "books" / "new"
HYMNS = 733

BAR = re.compile(r"\|\|:|:\|\||\|\||:\||\|:|\|")
# Cyrillic letters typed instead of Latin ones in chord names ("Еm"), and German H.
LATIN = str.maketrans("АВСЕН", "ABCEB")


def norm_text(text):
    return re.sub(r"[^а-яa-z]", "", text.lower().replace("ѝ", "и"))


def first_lines(lines, count=2):
    """The first `count` lyric lines, normalized (a song is the same when its opening is)."""
    out = []
    for line in lines:
        plain = re.sub(r"\[[^\]]*\]", "", line).strip()
        if plain and not plain.startswith(("{", "#")) and len(norm_text(plain)) > 5:
            out.append(norm_text(plain)[:25])
            if len(out) == count:
                break
    return tuple(out)


def pesni_index():
    """Normalized title and first line of every song in Песни."""
    out = []
    for path in sorted((ROOT / "songs").glob("*.cho")):
        text = path.read_text()
        title = re.search(r"\{title:\s*(.*?)\}", text).group(1)
        out.append((path.name, norm_text(title), first_lines(text.split("\n"))))
    return out


def valid_chords(tokens):
    """The subset of `tokens` that the build accepts as chords (scripts/songs/lib.mjs isChord)."""
    script = ("import('./scripts/songs/lib.mjs').then(({isChord}) => {"
              "const t = JSON.parse(require('fs').readFileSync(0, 'utf8'));"
              "console.log(JSON.stringify(t.filter((c) => { try { return isChord(c); } catch (e) { return false; } })));})")
    out = subprocess.run(["node", "-e", script], input=json.dumps(sorted(tokens)), capture_output=True, text=True,
                         cwd=ROOT, check=True)
    return set(json.loads(out.stdout))


def chord_candidate(token):
    token = token.translate(LATIN)
    return re.sub(r"(^|/)H", r"\1B", token)


def chord_tokens(row):
    # A backslash ("D4\\3") is ChordPro's escape character; the sheets mean a slash.
    return [t for t in re.split(r"(\|\|:|:\|\||\|\||:\||\|:|\|)|\s+", row.replace("\\", "/")) if t]


def chord_row(row, known):
    out = []
    for token in chord_tokens(row):
        if BAR.fullmatch(token):
            out.append(token)
        elif chord_candidate(token) in known:
            out.append(f"[{chord_candidate(token)}]")
        else:
            out.append(token)
    return " ".join(out)


def sections_of(text):
    parts = re.split(r"<([^<>]*)>", "<" + text)
    return [(name.strip(), content) for name, content in zip(parts[1::2], parts[2::2])]


def kind_of(name):
    base = name.lower()
    if base.startswith(("припев", "рефрен", "рефрейн")):
        return "chorus"
    if base.startswith(("бридж", "мост")):
        return "bridge"
    return "verse"


def convert(song, known):
    title = song["bulgarianTitle"].strip()
    out = [f"# Източник: https://spodelenohvalenie.com/songs/{song['id']}"]
    if song.get("bulgarianAuthor"):
        out.append(f"# Автор според spodelenohvalenie (често грешно): {song['bulgarianAuthor']}")
    if song.get("englishTitle"):
        original = song["englishTitle"] + (f" ({song['englishAuthor']})" if song.get("englishAuthor") else "")
        out.append(f"# Оригинал според spodelenohvalenie (непроверено): {original}")
    out.append(f"{{title: {title}}}")
    out.append(f"{{meta: source https://spodelenohvalenie.com/songs/{song['id']}}}")
    if song.get("bulgarianYoutubeLink"):
        out.append(f"{{meta: youtube {song['bulgarianYoutubeLink'].strip()}}}")
    out.append("")

    seen = {}
    for name, content in sections_of(song["text"]):
        lines = []
        for piece in re.split(r"(\{Акорди\}.*?\{/Акорди\})", content, flags=re.S):
            block = re.fullmatch(r"\{Акорди\}(.*?)\{/Акорди\}", piece, flags=re.S)
            rows = (block.group(1) if block else piece).split("\\n")
            for row in rows:
                row = row.strip()
                if block:
                    if row:
                        lines.append(chord_row(row, known))
                else:
                    if "[" in row or "]" in row:
                        out.insert(0, f"# В текста [ ] са заменени със ( ): {row}")
                        row = row.replace("[", "(").replace("]", ")")
                    lines.append(row)
        while lines and not lines[0]:
            lines.pop(0)
        while lines and not lines[-1]:
            lines.pop()
        lines = [l for k, l in enumerate(lines) if l or (k and lines[k - 1])]  # one blank line at most
        if not lines:
            continue
        kind = kind_of(name)
        label = name or ("Припев" if kind == "chorus" else "")
        key = (kind, "\n".join(lines))
        if kind == "chorus" and key in seen:
            out += [f"{{chorus: {seen[key]}}}", ""]
            continue
        seen.setdefault(key, label)
        out.append(f"{{start_of_{kind}: {label}}}" if label else f"{{start_of_{kind}}}")
        out += lines
        out += [f"{{end_of_{kind}}}", ""]
    return title, "\n".join(out).rstrip() + "\n"


def chord_pdf(index):
    for folder in (SCRAPE / "chords", SCRAPE / "chords-pdf"):
        found = sorted(folder.glob(f"{index:04d}-*.pdf"))
        if found:
            return found[0]
    return None


def lyric_size(pdf_path):
    """The usual size of the text in a chord PDF: smaller glyphs are chord superscripts."""
    with pdfplumber.open(pdf_path) as pdf:
        sizes = Counter(round(c["size"]) for page in pdf.pages for c in page.chars if c["text"].strip())
    return sizes.most_common(1)[0][0] if sizes else 13


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("numbers", nargs="*", type=int, help="numbers in the Нови book")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    songs = [s for s in json.loads((SCRAPE / "songs.json").read_text()) if s["bulgarianAuthor"] != "Духовни химни"]
    index = json.loads((SCRAPE / "index.json").read_text())
    pesni = pesni_index()

    candidates = set()
    for song in songs:
        for name, content in sections_of(song["text"]):
            for block in re.findall(r"\{Акорди\}(.*?)\{/Акорди\}", content, flags=re.S):
                for row in block.split("\\n"):
                    candidates.update(chord_candidate(t) for t in chord_tokens(row) if not BAR.fullmatch(t))
    known = valid_chords(candidates)

    OUT.mkdir(parents=True, exist_ok=True)
    duplicates, written, placed = [], 0, 0
    for song in sorted(songs, key=lambda s: index[s["id"]]):
        number = index[song["id"]] - HYMNS
        if args.numbers and number not in args.numbers:
            continue
        title, text = convert(song, known)
        first = first_lines(text.split("\n"))
        twin = next((name for name, t, f in pesni if len(first) == 2 and f == first), None)
        if twin:
            duplicates.append((number, title, twin))
            continue
        path = OUT / f"{number:03d}-{slugify(title)}.cho"
        written += 1
        if not args.write:
            continue
        path.write_text(text)
        pdf = chord_pdf(index[song["id"]])
        if pdf:
            size = lyric_size(pdf)
            result = chords.process(path, True, pdf=pdf, min_size=size * 0.85, keep_order=True,
                                    note=f"# Акорди: от файла с акорди на spodelenohvalenie ({pdf.name})")
            if result and result["changes"]:
                placed += 1
    for number, title, twin in duplicates:
        print(f"left out {number}. {title}: already in Песни as {twin}")
    print(f"{written} songs, chords from files in {placed}, {len(duplicates)} already in Песни")


if __name__ == "__main__":
    main()
