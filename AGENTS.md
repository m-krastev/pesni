# Skill: Bulgarian Chord Sheet → ChordPro

## Goal
Convert Bulgarian worship chord sheets from screenshots, pasted text, PDFs, or rough chord-over-lyric layouts into clean ChordPro files.

## Where songs live
`songs/NNN-slug.cho` (ChordPro) is the single source of truth for every song. `scripts/build-songs.mjs` generates everything else from it:

- `docs/NNN.md` and `src/data/songs/NNN.json`: the website page and its data,
- `typ/generated/*.typ`: Typst modules, rendered with `typ/single.typ` into the chord PDFs in `static/chords/` and with `typ/lyrics.typ` into the lyrics PDFs in `static/pdf/` (shared look in `typ/style.typ`),
- `static/openlp/*.xml` and `static/openlp/pesni-openlp.zip`: OpenLyrics files for OpenLP.

The build runs automatically before `npm run build` and `npm start`; run `npm run songs` by hand after editing. Generated files are git-ignored: never edit them. The build stops with an error on unknown directives, unknown chords, or unclosed sections.

The full songbook PDF is `typst compile --root . typ/all.typ songbook.pdf` (after `npm run songs`).

History: the original page lyrics are in `git show baa3098:docs/NNN.md`; the hand-corrected Typst versions the .cho files were converted from are in `git show 669fd3a:typ/songs/`. The original chord and lyrics files (PDF, DOC, DOCX) are archived unchanged in `static/old_chords/` and `static/old_pdf/`; `static/chord-thumbnails/` has rendered pages of the original chord PDFs. `songs/MISSING-CHORDS.md` lists songs that still have no chords.

## Song format

```chordpro
# Акорди: where the chords came from (a `#` line is a note for editors, never shown)
{title: Мир като река}

{start_of_verse: Куплет 1}
[G]Мир като [D]река, любов като [G]планина.
Але[Em]луя!
{end_of_verse}

{start_of_chorus: Припев}
[Em]Слез, [B7]Святи [Em]Душе,
{end_of_chorus}

{chorus: Припев}
```

- The number comes from the file name (`001-...cho`); do not put it in `{title}`.
- Sections: `{start_of_verse: Куплет 1}`, `{start_of_chorus: Припев}`, `{start_of_bridge: Мост}`; anything else (Интро, Предприпев, Край) is `{start_of_verse: Интро}`. Close each with the matching `{end_of_...}`.
- A repeated chorus is `{chorus: Припев}` between sections, not a copy of the lyrics. It becomes the repeat heading in the PDF and the verse order in OpenLP.
- A blank line inside a section is a stanza break (an optional slide break in OpenLP).
- Spoken or performance notes are `{comment: 2x}`, `{comment: само мъже}`.
- Credits, shown under the title on the page, in the PDFs and in OpenLP: `{meta: original English title}`, `{artist: ...}` (original authors), `{lyricist: ...}`, `{composer: ...}`, `{meta: translator ...}`, `{copyright: ...}`, `{ccli: ...}`. Add them only from a reliable source; never guess. `{key: ...}` is optional.

When the user asks to process songs, do it file-by-file unless they explicitly request batch regeneration. Do not overwrite already hand-corrected songs with automated output.
If there is no chord source for a song, keep it lyric-only. Do not invent chords.

The output must:
- Preserve the existing Bulgarian lyrics of the song exactly, including wording, line breaks, stanza breaks, and repeat layout. Add chords to that content.
- Preserve section order and repeat instructions.
- Avoid inventing missing lyrics. Mark unclear text with a `# unclear: ...` note line above it.
- Discard Bulgarian/German `H` notation, replacing it with `B`.

## Chord Placement Rules
- Put the chord immediately before the exact syllable where it appears in the source. This is strict: do not approximate to the start of the word or phrase for readability if the source places the chord later.
- Inside words there is no space: source chord over “ето” → `присъстви[Dm]ето`.
- A chord at the end of a line goes after the last word: `Бог Всемогъщ! [Em]`.
- Standalone chord rows (intros, interludes) are chords separated by spaces: `[C] [Dm7] [F] [C]`. Bar lines are written as text: `||: [F#m] | [D] | [A] | [E] :||`. Chord-only rows are hidden on the website while chords are off and left out of OpenLP.
- Two or more spaces before a chord keep a visible gap in the PDF: `ДНЕС!  [A4-5]`. Use this when adjacent chords would otherwise collide.
- Two chords on one syllable are written as the old sheets do, `[D/Em]` (every part must be a valid chord).
- Do not leave automated parse artifacts such as `Gem` becoming `[Gm]`; interpret source chord rows musically and visually. Example from song 1: source `Gem` means `[G] ... [Em]`, not `[Gm]`.
- Sharps are plain `#`: `[C#m]`, `[F#m]` (the build escapes them for Typst).

## Transposition
If the user asks to transpose, rewrite the chords with the exact mapping (the website can transpose further on the fly).

## Processing Steps

1. Read the existing `songs/NNN-*.cho` first. Treat it as the authoritative source for lyric content, line breaks, stanza breaks, and repeated section layout.
2. Always read every matching rendered `.png` thumbnail page in `static/chord-thumbnails/` as well; they are required context for every song, not optional.
3. Read the requested PDF or rendered thumbnail. Use it as the authoritative visual source for chord placement and chord rows.
4. Do not read or use the matching DOCX files unless the user explicitly asks for DOCX inspection. They are not an allowed source for normal correction work.
5. Edit that one song by hand.
6. Preserve the title, section order, lyrics, repeat markers, and source chord intent.
7. Replace `H` notation with `B`.
8. Run `npm run songs` (or `node scripts/build-songs.mjs NNN`) and fix any error it reports; check the PDF with `--force-pdf` if the layout matters.
9. Report only the file changed and verification result unless the user asks for the full ChordPro text.

## Quality Checks

Before responding, verify:

* `npm run songs` builds the song without errors.
* Every section is closed with the matching `{end_of_...}`.
* Section labels are consistent (`Куплет 1`, `Припев`, `Мост`).
* Repeats from the source are included as `{chorus: ...}` or sections.
* Transposition, if requested, is applied consistently.
* No source-only `:` line appears in a section.
* No adjacent chords visually collide in the PDF.
