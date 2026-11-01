#!/usr/bin/env python3
"""One-time import of Песнарка (the hymnal, m-krastev/pesnarka) into books/pesnarka/.

Lyrics come from the hymnal site's pages (docs/N.md in that repository): numbered
stanzas become verses; an indented (`>`) block that comes back (word for word, or
as "Радвам се аз и пр.") becomes the chorus, other indented blocks stay part of
their verse. The hymnal reference ("Д. П. 33") and the melody, one-voice and score
files on hopeforthebalkans.org become metadata.

Chords come from "Духовни песни с акорди" (Duhovni_pesni_text_akordi.doc) exported
to PDF by Word: two hymns per page in table cells, chords over the first verse. The
cell of each hymn is cut out and its chords are placed with import_pdf_chords.py.

    scripts/import_pesnarka.py PESNARKA_DOCS CHORDS_PDF [--write]

Needs pdfplumber (pip install pdfplumber).
"""
import argparse
import re
import sys
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_pdf_chords as chords  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "books" / "pesnarka"
MEDIA = "https://hopeforthebalkans.org/static"

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n",
    "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f",
    "х": "h", "ц": "tz", "ч": "ch", "ш": "sh", "щ": "sht", "ъ": "y", "ь": "y",
    "ю": "yu", "я": "q",
}


def slugify(title):
    text = "".join(TRANSLIT.get(ch, ch) for ch in title.lower())
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "himn"


def stanzas(body):
    """Blocks of lines separated by blank lines; each line as (quoted, text)."""
    out, cur = [], []
    for raw in body.split("\n"):
        line = raw.rstrip()
        if not line.strip():
            if cur:
                out.append(cur)
            cur = []
            continue
        quoted = line.lstrip().startswith(">")
        text = re.sub(r"^(\s*>)+\s?", "", line).strip() if quoted else line.strip()
        if text:
            cur.append((quoted, text))
    if cur:
        out.append(cur)
    return out


def split_quoted(block):
    """A block can start plain and end quoted (a verse, then its indented part): split there."""
    parts, cur = [], []
    for quoted, text in block:
        if cur and cur[-1][0] != quoted:
            parts.append(cur)
            cur = []
        cur.append((quoted, text))
    if cur:
        parts.append(cur)
    return parts


ETC = re.compile(r"\s*(и\s+пр\.?|и т\.\s*н\.?)\s*$", re.I)


def convert(md, number):
    """The .cho text of hymn `number` from its markdown page."""
    # The lyrics end where the recordings and the score begin.
    head = re.split(r"\*\*(?:Мелодия|Едноглас|Ноти)\*\*|<audio|<img", md, maxsplit=1)[0]
    title = re.search(r"^#\s*\d+\.\s*(.+?)\s*$", md, re.M).group(1)
    ref = re.search(r"^_(.+)_\s*$", head, re.M)
    body = head.split("\n", 1)[1]
    if ref:
        body = body.replace(ref.group(0), "", 1)
    # Bible references are links to biblia.bg on lines of their own: "[Йоан 6:68](http://...)".
    scripture = []
    kept = []
    for line in body.split("\n"):
        links = re.findall(r"\[([^\]]+)\]\(https?://[^)]*\)", line)
        if links and not re.sub(r"\[[^\]]+\]\([^)]*\)|[\s,;>]", "", line):
            scripture += [l.strip() for l in links]
        else:
            kept.append(line)
    body = "\n".join(kept)
    blocks = [part for block in stanzas(body) for part in split_quoted(block)]

    # Indented blocks that recur, or that something refers back to with "и пр.", are the chorus.
    quoted = [tuple(t for _, t in b) for b in blocks if b[0][0]]
    chorus = None
    for b in quoted:
        if quoted.count(b) > 1 or any(ETC.search(x[0]) and b[0].startswith(ETC.sub("", x[0])) for x in quoted if x != b):
            chorus = b
            break
    label_next = False

    out = [f"{{title: {title}}}"]
    if ref:
        out.append(f"{{meta: reference {ref.group(1).strip()}}}")
    if scripture:
        out.append(f"{{meta: scripture {'; '.join(scripture)}}}")
    for kind, path, ext in (("melody", "mp3", "mp3"), ("unison", "transp", "mp3"), ("score", "scores", "jpg")):
        if f"/{path}/{number}.{ext}" in md:
            out.append(f"{{meta: {kind} {MEDIA}/{path}/{number}.{ext}}}")
    out.append("")

    sections = []  # [kind, label, lines]
    verse = 0
    for block in blocks:
        lines = [t for _, t in block]
        is_quoted = block[0][0]
        if len(lines) == 1 and re.fullmatch(r"(?i)припев:?", lines[0]):
            label_next = True
            continue
        if is_quoted:
            if chorus and tuple(lines) == chorus:
                if any(s[0] == "chorus" for s in sections):
                    sections.append(["repeat", "Припев", []])
                else:
                    sections.append(["chorus", "Припев", lines])
                continue
            if chorus and len(lines) == 1 and ETC.search(lines[0]) and chorus[0].startswith(ETC.sub("", lines[0]).rstrip(" ,.;:")):
                sections.append(["repeat", "Припев", []])
                continue
            if label_next:
                sections.append(["chorus", "Припев", lines])
                label_next = False
                continue
            if sections and sections[-1][0] == "verse":
                sections[-1][2] += [None] + lines  # the indented second half of a verse
                continue
        m = re.match(r"^(\d+)\.\s*(.*)$", lines[0])
        if m:
            verse = int(m.group(1))
            lines = [m.group(2)] + lines[1:] if m.group(2) else lines[1:]
            sections.append(["verse", f"Куплет {verse}", lines])
        elif sections and sections[-1][0] == "verse":
            sections[-1][2] += [None] + lines
        else:
            verse += 1
            sections.append(["verse", f"Куплет {verse}", lines])
        label_next = False

    for kind, label, lines in sections:
        if kind == "repeat":
            out += [f"{{chorus: {label}}}", ""]
            continue
        out.append(f"{{start_of_{kind}: {label}}}")
        out += ["" if line is None else line for line in lines]
        out += [f"{{end_of_{kind}}}", ""]
    return title, "\n".join(out).rstrip() + "\n"


def hymn_regions(pdf):
    """{hymn number: [crops]}: the table cell of every hymn below its title, across pages."""
    regions = {}
    current = {0: None, 1: None}
    for page in pdf.pages:
        half = page.width / 2
        for col in (0, 1):
            cell = page.crop((half * col, 0, half * (col + 1), page.height))
            titles = []
            for line in cell.extract_text_lines(return_chars=True):
                big = [c for c in line["chars"] if c["size"] > 16]
                m = re.match(r"^(\d+)\.", line["text"].strip())
                if m and len(big) > len(line["chars"]) / 2:
                    titles.append((int(m.group(1)), line["top"], line["bottom"]))
            top = 0
            for number, t_top, t_bottom in titles:
                if current[col] is not None and t_top > top + 1:
                    regions.setdefault(current[col], []).append(cell.crop((half * col, top, half * (col + 1), t_top)))
                current[col] = number
                top = t_bottom + 1
            if current[col] is not None:
                regions.setdefault(current[col], []).append(cell.crop((half * col, top, half * (col + 1), page.height)))
    return regions


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("docs", type=Path, help="docs/ of the pesnarka repository")
    parser.add_argument("pdf", type=Path, help="Word's PDF of Duhovni_pesni_text_akordi.doc")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("numbers", nargs="*", type=int)
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    numbers = args.numbers or sorted(int(p.stem) for p in args.docs.glob("*.md") if p.stem.isdigit())
    with pdfplumber.open(args.pdf) as pdf:
        regions = hymn_regions(pdf)
        with_chords = lost = 0
        for number in numbers:
            title, text = convert((args.docs / f"{number}.md").read_text(), number)
            path = OUT / f"{number:03d}-{slugify(title)}.cho"
            if not args.write:
                path = Path("/dev/null")
            else:
                path.write_text(text)
            pages = regions.get(number)
            if not pages or not args.write:
                continue
            # Text is 12-14pt and chords are not superscripted, so every glyph counts.
            result = chords.process(path, True, pages=pages, min_size=9, keep_order=True,
                                    note="# Акорди: от \"Духовни песни\" с акорди (Duhovni_pesni_text_akordi.doc), само над първия куплет")
            if result and result["changes"]:
                with_chords += 1
                lost += len(result["lost"])
                if result["lost"]:
                    print(f"{number}: {len(result['lost'])} chords not placed", file=sys.stderr)
        print(f"{len(numbers)} hymns, {with_chords} with chords, {lost} chords not placed")


if __name__ == "__main__":
    main()
