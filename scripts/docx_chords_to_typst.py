#!/usr/bin/env python3
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHORDS_DIR = ROOT / "static" / "chords"
TYP_DIR = ROOT / "typ"
SONGS_TYP_DIR = TYP_DIR / "songs"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

CHORD_RE = re.compile(
    r"(?<![А-Яа-яA-Za-z0-9#♯b♭])"
    r"([A-H](?:#|♯|b|♭)?(?:maj|min|dim|aug|sus|add|m|M|em)?[0-9]*(?:/[A-H](?:#|♯|b|♭)?)?)"
)
SECTION_RE = re.compile(
    r"^\s*(?:(Пр)\s*[:.]|(Припев|Куплет|Бридж|Мост|Интр[оo]|Intro|Край|Финал)\s*:?)\s*(.*)$",
    re.I,
)


def run_text(run):
    return "".join(t.text or "" for t in run.findall("w:t", NS))


def run_is_red(run):
    color = run.find("w:rPr/w:color", NS)
    return color is not None and (color.get(W + "val") or "").upper() == "FF0000"


def paragraph_text_and_red(paragraph):
    text = ""
    red_chars = 0
    total_chars = 0
    for run in paragraph.findall("w:r", NS):
        txt = run_text(run)
        if not txt:
            continue
        text += txt
        total_chars += len(txt.strip())
        if run_is_red(run):
            red_chars += len(txt.strip())
    return text.rstrip(), total_chars > 0 and red_chars >= max(1, total_chars // 2)


def read_docx_paragraphs(path):
    with zipfile.ZipFile(path) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    return [paragraph_text_and_red(p) for p in root.findall(".//w:body/w:p", NS)]


def typ_escape(text):
    replacements = {
        "\\": "\\\\",
        "#": r"\#",
        "[": r"\[",
        "]": r"\]",
        "`": r"\`",
        "*": r"\*",
        "_": r"\_",
        "$": r"\$",
    }
    return "".join(replacements.get(char, char) for char in text)


def typ_escape_line(text):
    escaped = typ_escape(text.strip())
    if escaped.startswith("-"):
        return "\\" + escaped
    return escaped


def normalize_chord(chord):
    chord = chord.replace("♯", "#").replace("♭", "b")
    chord = re.sub(r"^H", "B", chord)
    chord = re.sub(r"/H", "/B", chord)
    chord = chord.replace("em", "m")
    return chord


def typst_chord(chord):
    return chord.replace("#", r"\#")


def chord_markup(chord):
    return f"[{typst_chord(chord)}] "


def chord_tokens(chord_line):
    tokens = []
    for match in CHORD_RE.finditer(chord_line):
        token = normalize_chord(match.group(1))
        if token:
            tokens.append((match.start(1), token))
    return tokens


def standalone_chords(chord_line):
    tokens = chord_tokens(chord_line)
    return "#h(2em) ".join(chord_markup(chord) for _, chord in tokens).rstrip()


def is_chord_sequence(text):
    cleaned = CHORD_RE.sub("", text)
    cleaned = re.sub(r"[\s|/.,:;()xX0-9-]+", "", cleaned)
    return bool(chord_tokens(text)) and not cleaned


def merge_chords(chord_line, lyric_line):
    tokens = chord_tokens(chord_line)
    if not tokens:
        return typ_escape(lyric_line.strip())

    lyric = lyric_line.rstrip()
    if not lyric.strip():
        return standalone_chords(chord_line)

    out = []
    last = 0
    lyric_len = len(lyric)
    previous_was_chord = False
    for pos, chord in tokens:
        idx = min(max(pos, 0), lyric_len)
        if idx < last:
            idx = last
        lyric_part = typ_escape(lyric[last:idx])
        if lyric_part:
            out.append(lyric_part)
            previous_was_chord = False
        elif previous_was_chord:
            out.append("#h(2em) ")
        out.append(chord_markup(chord))
        last = idx
        previous_was_chord = True
    out.append(typ_escape(lyric[last:]))
    return "".join(out).strip()


def title_from_first_line(line, fallback):
    title = line.strip()
    return title or fallback


def section_name(raw, verse_count):
    label = raw.lower()
    if label.startswith("пр"):
        return "Припев"
    if label.startswith("бр") or label.startswith("мост"):
        return "Бридж"
    if label.startswith("интр") or label.startswith("intro"):
        return "Интро"
    if label.startswith("кра") or label.startswith("фин"):
        return "Край"
    if label.startswith("куп"):
        return f"Куплет {verse_count}"
    return raw.strip() or f"Куплет {verse_count}"


def emit_song(docx_path):
    paragraphs = read_docx_paragraphs(docx_path)
    non_empty = [(text, red) for text, red in paragraphs if text.strip()]
    fallback_title = docx_path.stem
    title = title_from_first_line(non_empty[0][0], fallback_title) if non_empty else fallback_title

    lines = [f"= {typ_escape(title)}", ""]
    pending_chords = None
    in_section = None
    verse_count = 1

    for index, (text, is_chords) in enumerate(paragraphs):
        if index == 0 and text.strip():
            continue

        if not text.strip():
            if pending_chords:
                if in_section is None:
                    lines.append("=== [[Интро]]")
                    in_section = "Интро"
                lines.append(f"{standalone_chords(pending_chords)} \\")
            pending_chords = None
            if lines and lines[-1] != "":
                lines.append("")
            continue

        if is_chords:
            if pending_chords:
                if in_section is None:
                    lines.append("=== [[Интро]]")
                    in_section = "Интро"
                lines.append(f"{standalone_chords(pending_chords)} \\")
            pending_chords = text
            continue

        lyric = text.strip()
        if lyric in {":", "："}:
            pending_chords = None
            continue
        match = SECTION_RE.match(lyric)
        if match:
            raw_section = match.group(1) or match.group(2)
            rest = match.group(3)
            if raw_section.lower().startswith("куп") and in_section and in_section.startswith("Куплет"):
                verse_count += 1
            section = section_name(raw_section, verse_count)
            if section != in_section:
                if lines and lines[-1] != "":
                    lines.append("")
                lines.append(f"=== [[{section}]]")
                in_section = section
            lyric = rest.strip()
            if not lyric or lyric in {":", "："}:
                pending_chords = None
                continue
            if is_chord_sequence(lyric):
                lines.append(f"{standalone_chords(lyric)} \\")
                pending_chords = None
                continue

        if in_section is None:
            lines.append("=== [[Куплет 1]]")
            in_section = "Куплет 1"

        merged = merge_chords(pending_chords or "", lyric)
        if not pending_chords:
            merged = typ_escape_line(lyric)
        elif merged.startswith("-"):
            merged = "\\" + merged
        lines.append(f"{merged} \\")
        pending_chords = None

    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines) + "\n"


def emit_song_module(docx_path):
    return "#let song = [\n" + emit_song(docx_path).rstrip() + "\n]\n"


def pdf_number_and_slug(path):
    match = re.match(r"^(\d+)-(.+?)_akord$", path.stem, re.I)
    if not match:
        return path.stem
    return f"{int(match.group(1)):03d}-{match.group(2)}"


def emit_central_songbook(song_paths):
    imports = []
    body = []
    for index, path in enumerate(song_paths, 1):
        ident = f"song{index:03d}"
        imports.append(f'#import "songs/{path.name}": song as {ident}')
        body.append(f"#{ident}")
        if index != len(song_paths):
            body.append("#pagebreak()")

    prelude = '''#import "@preview/conchord:0.4.0": chordify, sized-chordlib, change-tonality, chordlib, overchord, get-chordgram-width-scale, default-tuning, inlinechord
#set page(paper: "a4", margin: 3em, columns: 1, footer: [
  #set align(right)
  #set text(0.9em)
])
#set text(size: 16pt, weight: "bold")
#let och = overchord.with(styling: it => { text(it, fill: maroon, weight: "bold") })
#let ich = inlinechord.with(styling: it => { text(it, fill: maroon, weight: "bold") })
#show: chordify.with(line-chord: och)

#show heading.where(level: 1): it => stack(
  spacing: 1%,
  text(it),
  line(length: 100%, stroke: 2pt),
)

#let sized-chordlib2(
  N: 2,
  width: 50pt,
  prefix: none,
  postfix: none,
  inset: 10pt,
  ..args,
) = {
  let scale = get-chordgram-width-scale(args.named().at("tuning", default: default-tuning).split().len())
}

'''
    return prelude + "\n".join(imports) + "\n\n" + "\n".join(body) + "\n"


def main():
    SONGS_TYP_DIR.mkdir(parents=True, exist_ok=True)
    paths = sorted(CHORDS_DIR.glob("*.docx"), key=lambda p: (int(re.match(r"^(\d+)", p.name).group(1)), p.name.lower()) if re.match(r"^(\d+)", p.name) else (99999, p.name.lower()))
    if len(sys.argv) > 1:
        wanted = {arg for arg in sys.argv[1:]}
        paths = [p for p in paths if p.name in wanted or p.stem in wanted]

    out_paths = []
    for path in paths:
        out_path = SONGS_TYP_DIR / f"{pdf_number_and_slug(path)}.typ"
        out_path.write_text(emit_song_module(path), encoding="utf-8")
        out_paths.append(out_path)
        print(out_path.relative_to(ROOT))
    (TYP_DIR / "all.typ").write_text(emit_central_songbook(out_paths), encoding="utf-8")
    print((TYP_DIR / "all.typ").relative_to(ROOT))


if __name__ == "__main__":
    main()
