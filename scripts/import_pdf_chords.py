#!/usr/bin/env python3
"""Re-place chords in songs/NNN-*.cho exactly where the original chord PDF has them.

The original chord sheets (static/old_chords/N-slug_akord.pdf, made in Word)
are text PDFs: every chord row sits above its lyric line, so the letter under
the left edge of each chord says where the chord belongs. This reads those
positions, matches the PDF lyrics to the .cho lyrics letter by letter (case and
line breaks differ), and rewrites the chords of every .cho line the PDF covers.
Lines the PDF does not cover keep their chords, unless an identical line is
covered (a repeated chorus), in which case they get the same chords.

    scripts/import_pdf_chords.py 119          # report what would change
    scripts/import_pdf_chords.py --write 119  # rewrite songs/119-*.cho
    scripts/import_pdf_chords.py --all        # report for every song with an original PDF

Needs pdfplumber (pip install pdfplumber).
"""
import argparse
import difflib
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
SONGS = ROOT / "songs"
ORIGINALS = ROOT / "static" / "old_chords"

CHORD_TOKEN = re.compile(r"^[A-H](#|b)?(m|maj|min|dim|aug|sus|add|M)?\d*(sus\d*|add\d*|maj\d*)?(/[A-H](#|b)?)?$")
VOWELS = set("АЕИОУЪЮЯЭЫAEIOUY")
LETTER = re.compile(r"[\wА-яЁё]")
LABEL = r"(?i)(пр|припев|куплет|бридж|мост|интро|край|финал)[\s\d.:]*"
CHORD_IN_CHO = re.compile(r"\[[^\]]*\]")


LATIN_LOOKALIKES = str.maketrans("ABCEHKMOPTXY", "АВСЕНКМОРТХУ")


def norm(ch):
    # Some PDFs have Latin look-alikes inside Cyrillic words ("Mир").
    return ch.upper().translate(LATIN_LOOKALIKES)


def rows_of(page):
    """Group characters into visual rows; small superscript-like glyphs ("m") join the row above."""
    chars = sorted(page.chars, key=lambda c: (round(c["top"]), c["x0"]))
    big = [c for c in chars if c["size"] >= 13]
    small = [c for c in chars if c["size"] < 13 and c["text"].strip()]
    rows = {}
    for c in big:
        rows.setdefault(round(c["top"]), []).append(c)
    tops = sorted(rows)
    for c in small:
        above = [t for t in tops if t <= c["top"] + 1 and c["top"] - t < 12]
        if above:
            rows[above[-1]].append(c)
    return [(t, sorted(rows[t], key=lambda c: c["x0"])) for t in tops]


CHORD_PART = re.compile(r"[A-H](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)?\d*(?:sus\d*|add\d*|maj\d*)?(?:/[A-H](?:#|b)?)?")


def runs(row):
    """Runs of touching non-space glyphs: lists of glyphs."""
    out, current = [], []
    for c in row:
        if not c["text"].strip():
            if current:
                out.append(current)
            current = []
            continue
        if current and c["x0"] - current[-1]["x1"] >= 1.5:
            out.append(current)
            current = []
        current.append(c)
    if current:
        out.append(current)
    return out


def split_chords(run):
    """[(chord, x0)] for a glyph run, splitting glued chords such as "G4G"; None if not chords."""
    text = "".join(c["text"] for c in run)
    parts, pos = [], 0
    for m in CHORD_PART.finditer(text):
        if m.start() != pos or not m.group():
            return None
        parts.append((m.group(), run[m.start()]["x0"]))
        pos = m.end()
    return parts if parts and pos == len(text) else None


def tokens(row):
    """Chords of a chord row as (chord, x0), or None when the row is not all chords."""
    out = []
    for run in runs(row):
        parts = split_chords(run)
        if parts is None:
            return None
        out.extend(parts)
    return out


def is_chord_row(row):
    return bool(tokens(row))


def pdf_chords(path):
    """Lyric text of the PDF as one letter stream, and chords anchored to it.

    Returns (letters, anchors): letters is a list of uppercase letters/digits,
    anchors a list of (chord, index, after) where the chord goes before
    letters[index], or after it when `after` is true (chord past the line end)."""
    letters, anchors = [], []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pending = None
            for _, row in rows_of(page):
                if is_chord_row(row):
                    pending = tokens(row)
                    continue
                text = "".join(c["text"] for c in row).strip()
                # The title row ("119. Ако жадува...") and bare labels ("Пр.:") are not lyrics.
                if re.match(r"^\d+\.\s", text) or re.fullmatch(LABEL, text):
                    pending = None
                    continue
                line = []  # (char, x0, x1, letter index or None)
                for c in (c for c in row if c["size"] >= 13):
                    if LETTER.match(c["text"]):
                        line.append((c["text"], c["x0"], c["x1"], len(letters)))
                        letters.append(norm(c["text"]))
                    else:
                        line.append((c["text"], c["x0"], c["x1"], None))
                if pending and any(i is not None for *_, i in line):
                    used = set()
                    for chord, x in pending:
                        idx, after = anchor_at(line, x)
                        if not after and idx in used:
                            # A second chord on the same syllable is played after the word.
                            idx, after = end_of_word(line, idx), True
                        used.add(idx)
                        anchors.append((chord.replace("H", "B"), idx, after, text))
                pending = None
    return letters, anchors


def is_vowel(ch):
    return ch.upper() in VOWELS


def syllable_start(word, i):
    """Index in `word` (a string of letters) where the syllable containing word[i] starts.

    Bulgarian rules of thumb: a word-initial consonant cluster belongs to the first
    syllable (гре-, взе); inside a word a single consonant starts the next syllable
    (лю-бов) and a longer cluster splits after its first consonant (ис-тин-ска,
    раз-пнат); word-final consonants close the last syllable."""
    vowels = [k for k, ch in enumerate(word) if is_vowel(ch)]
    if not vowels:
        return 0
    nucleus = i if is_vowel(word[i]) else None
    if nucleus is None:
        after = [k for k in vowels if k > i]
        before = [k for k in vowels if k < i]
        if not before:
            return 0
        if not after:
            nucleus = before[-1]
        else:
            # consonant between two vowels: which syllable does it belong to?
            cluster_start = before[-1] + 1
            cluster_len = after[0] - cluster_start
            belongs_next = cluster_len == 1 or i > cluster_start
            nucleus = after[0] if belongs_next else before[-1]
    previous = [k for k in vowels if k < nucleus]
    if not previous:
        return 0
    cluster_start = previous[-1] + 1
    cluster_len = nucleus - cluster_start
    return nucleus - cluster_len + (1 if cluster_len >= 2 else 0)


def end_of_word(line, idx):
    """Letter index of the last letter of the word containing letter `idx`."""
    k = next(k for k, (*_, i) in enumerate(line) if i == idx)
    while k + 1 < len(line) and line[k + 1][3] is not None:
        k += 1
    return line[k][3]


def anchor_at(line, x):
    """(letter index, after) for a chord whose left edge is at x over `line`."""
    lettered = [k for k, (*_, idx) in enumerate(line) if idx is not None]
    last = lettered[-1]
    if x >= line[last][2] - 1:
        return line[last][3], True
    # The glyph the chord starts over (2pt tolerance to the left), else the next glyph.
    hit = next((k for k, (_, x0, x1, _) in enumerate(line) if x0 - 2 <= x < x1), None)
    if hit is None or line[hit][3] is None:
        hit = next((k for k in lettered if line[k][1] >= x - 2), last)
    # The word around it and the syllable start inside that word.
    lo = hit
    while lo > 0 and line[lo - 1][3] is not None:
        lo -= 1
    hi = hit
    while hi + 1 < len(line) and line[hi + 1][3] is not None:
        hi += 1
    word = "".join(ch for ch, *_ in line[lo:hi + 1])
    return line[lo + syllable_start(word, hit - lo)][3], False


def cho_lines(text):
    """(line index, letters with their character offsets) for every lyric line of a .cho file."""
    out = []
    for n, line in enumerate(text.split("\n")):
        if line.startswith(("#", "{")) or not line.strip():
            continue
        # Without its chords, with the gaps they left collapsed.
        plain = re.sub(r"\s+", " ", CHORD_IN_CHO.sub("", line)).strip()
        if not any(LETTER.match(ch) for ch in plain):
            continue  # chord-only row
        offsets = [(i, norm(ch)) for i, ch in enumerate(plain) if LETTER.match(ch)]
        out.append((n, plain, offsets))
    return out


def rebuild(plain, inserts):
    """Insert chords into a chord-free line; inserts are (offset, chord, after)."""
    before, after = {}, []
    for offset, chord, is_after in inserts:
        if is_after:
            after.append((offset, chord))
        else:
            before.setdefault(offset, []).append(chord)
    out = []
    for i, ch in enumerate(plain):
        for chord in before.get(i, []):
            out.append(f"[{chord}]")
        out.append(ch)
    line = "".join(out).rstrip()
    for _, chord in sorted(after):
        line += f" [{chord}]"
    return line


def song_number(path):
    return int(path.name.split("-", 1)[0])


def original_pdf(number, slug):
    pdfs = [p for p in ORIGINALS.glob(f"{number}-*") if p.suffix.lower() == ".pdf"]
    exact = [p for p in pdfs if p.name.lower() == f"{number}-{slug}_akord.pdf"]
    return (exact or pdfs or [None])[0] if len(exact) == 1 or len(pdfs) == 1 else None


def process(cho_path, write):
    number = song_number(cho_path)
    pdf = original_pdf(number, cho_path.stem[4:])
    if not pdf:
        return None
    letters, anchors = pdf_chords(pdf)
    if not anchors:
        return None
    text = cho_path.read_text()
    lines = cho_lines(text)
    stream = [(li, off, ch) for li, (_, _, offsets) in enumerate(lines) for off, ch in offsets]
    matcher = difflib.SequenceMatcher(None, letters, [ch for _, _, ch in stream], autojunk=False)
    to_cho = {}
    for a, b, size in matcher.get_matching_blocks():
        for k in range(size):
            to_cho[a + k] = b + k

    covered = set(to_cho[i] for i in to_cho)
    inserts = {}
    lost = []
    for chord, idx, after, pdf_line in anchors:
        j = to_cho.get(idx)
        if j is None:
            lost.append((chord, pdf_line))
            continue
        li, off, _ = stream[j]
        if after:
            # Past the end of the PDF line: after the word that ends there.
            plain = lines[li][1]
            end = off
            while end + 1 < len(plain) and not plain[end + 1].isspace():
                end += 1
            inserts.setdefault(li, []).append((end + 1 if end + 1 < len(plain) else end, chord, end + 1 >= len(plain)))
        else:
            inserts.setdefault(li, []).append((off, chord, False))

    # A .cho line is "covered" when most of its letters came from the PDF.
    covered_lines = set()
    for li, (_, _, offsets) in enumerate(lines):
        idxs = [k for k, (l2, _, _) in enumerate(stream) if l2 == li]
        if idxs and sum(k in covered for k in idxs) >= 0.8 * len(idxs):
            covered_lines.add(li)

    src = text.split("\n")
    new_by_text = {}
    changes = []
    for li in sorted(covered_lines):
        n, plain, _ = lines[li]
        new = rebuild(plain, sorted(inserts.get(li, [])))
        new_by_text.setdefault(re.sub(r"\s+", " ", plain.strip()), new)
        if new != src[n]:
            changes.append((n, src[n], new))
            src[n] = new
    for li, (n, plain, _) in enumerate(lines):
        if li in covered_lines:
            continue
        twin = new_by_text.get(re.sub(r"\s+", " ", plain.strip()))
        if twin and twin != src[n]:
            changes.append((n, src[n], twin))
            src[n] = twin

    if write and changes:
        new_text = "\n".join(src)
        if "static/old_chords" not in new_text.split("\n", 1)[0]:
            new_text = f"# Акорди: местата са взети от оригиналния PDF static/old_chords/{pdf.name}\n" + new_text
        cho_path.write_text(new_text)
    uncovered = [lines[li][1] for li in range(len(lines)) if li not in covered_lines]
    return {"pdf": pdf.name, "chords": len(anchors), "lost": lost, "changes": changes, "uncovered": uncovered}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("numbers", nargs="*", type=int)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--skip", type=int, nargs="*", default=[], help="song numbers to leave alone")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("--lost", action="store_true", help="list PDF lines whose chords found no place")
    args = parser.parse_args()
    files = sorted(SONGS.glob("*.cho"))
    if not args.all:
        files = [f for f in files if song_number(f) in args.numbers]
    for f in files:
        if song_number(f) in args.skip:
            continue
        result = process(f, args.write)
        if not result:
            continue
        print(f"{song_number(f)}: {len(result['changes'])} lines changed, {result['chords']} chords in {result['pdf']}"
              + (f", {len(result['lost'])} not placed" if result["lost"] else "")
              + (f", {len(result['uncovered'])} lines not in the PDF" if result["uncovered"] else ""))
        if args.verbose or args.lost:
            for line in dict.fromkeys(l for _, l in result["lost"]):
                print(f"    not in the song: {line}  {[c for c, l in result['lost'] if l == line]}")
        if args.verbose:
            for _, old, new in result["changes"]:
                print(f"    - {old}\n    + {new}")


if __name__ == "__main__":
    main()
