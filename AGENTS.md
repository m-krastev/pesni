# Skill: Bulgarian Chord Sheet → Typst Conchord

## Goal
Convert Bulgarian worship chord sheets from screenshots, pasted text, or rough chord-over-lyric layouts into clean Typst using the `conchord` package.

## Required Output
`typ/songs/NNN-*.typ` is the single source of truth for every song: the website pages `docs/NNN.md`, their data `src/data/songs/NNN.json` and the chord PDFs in `static/chords/` are all generated from it by `scripts/build_songs.py` (runs automatically before `npm run build` and `npm start`; run `npm run songs` by hand after editing). Never edit `docs/NNN.md` directly.

The original lyric text (before the pages were generated) is in git history: `git show baa3098:docs/NNN.md`. The original chord PDFs are in git history of `static/chords` and in `static/chord-thumbnails/`.

Per-song output files live in `typ/songs/` as importable Typst modules:

```typst
#let song = [
= 1. Мир като река

=== [[Куплет 1]]
...
]
```

The combined songbook is `typ/all.typ`, which imports every song module and inserts page breaks.

When the user asks to process songs, do it file-by-file unless they explicitly request batch regeneration. Do not overwrite already hand-corrected songs with automated output.
If a song has no matching chord PDF in `static/chords`, keep it a lyric-only Typst module. Do not invent chords.

The output must:
- Preserve the existing Bulgarian lyrics of the song exactly, including wording, line breaks, stanza breaks, and repeat layout. Add chords to that content.
- Preserve section order and repeat instructions.
- Preserve the song number in the level-1 title, e.g. `= 1. Мир като река`.
- Use `conchord` bracket syntax: `[Chord] lyric`.
- Always place one literal space after every closing chord bracket: `[C] текст`, `[Dm7] ето`, `[F]  \`.
- Use `\` at the end of each lyric/manual-break line.
- Use headings like `=== [[Куплет 1]]`, `=== [[Припев]]`, `=== [[Бридж]]`.
- Avoid inventing missing lyrics. Mark unclear text as `/* unclear */`.
- Discard Bulgarian/German `H` notation, replacing it with `B`.

## Chord Placement Rules
For over-lyric alignment:
- Put the chord immediately before the exact syllable where it appears in the source. This is strict: do not approximate to the start of the word or phrase for readability if the PDF places the chord later.
- Keep one space after the chord bracket even inside words:
  - Source: chord over “ето”
  - Output: `присъстви[Dm] ето`
- Preserve inside-word chord placement when shown by the PDF, e.g. if the chord falls over the second syllable of a word, place the bracket inside that word before that syllable.
- For standalone chord rows, use spaced bracket chords:
  - `[C] `   ` [Dm7] `   ` [F] `   ` [C]  \`
- If adjacent end-of-line chords overlap when rendered, do not leave them collapsed. Either place the chords on the lyric syllables they belong to, or insert an explicit raw-text space block between adjacent chord tokens, e.g. `[A] `   ` [D]`.
- Do not leave automated parse artifacts such as `Gem` becoming `[Gm]`; interpret source chord rows musically and visually. Example from song 1: source `Gem` means `[G] ... [Em]`, not `[Gm]`.
- Sharp chords must be escaped with exactly one Typst backslash inside chord brackets: `[C\#m]`, `[F\#m]`. Never output `[C#m]` or `[C\\#m]`.
- Do not use `inlinechord` unless explicitly requested; it may render as bracketed text depending on package behavior.

## Manual Break Rules
Every displayed line should end with Typst manual break:
- `... текст \`
- Blank visual spacing between phrases can be represented by an empty line between lines.
- Escape a leading literal dash so Typst does not turn it into a bullet: `\- текст \`.
- A colon used only as a source repeat/chorus marker must not become its own displayed line. Integrate it into the section interpretation or omit it when the section heading already captures it.

## Transposition Rules
If user asks to transpose manually, apply exact mapping.
If user asks for conchord automatic transposition, use:
- `#change-tonality(n)`
- Example: A major → G major is `#change-tonality(-2)`

When using automatic transposition:
```typst
#show: chordify
#change-tonality(-2)
````

Use a local block if the transposition should affect only one song:

```typst
#[
  #show: chordify
  #change-tonality(-2)

  // song here
]
```

## Page Layout Rules

For two columns on one song/page:

```typst
#pagebreak()
#set page(columns: 2)

// song body

#pagebreak()
#set page(columns: 1)
```

If the title must remain full width, put the title before `#set page(columns: 2)`.

## Processing Steps

1. Read the existing `typ/songs/NNN-*.typ` file first. Treat it as the authoritative source for lyric content, line breaks, stanza breaks, and repeated section layout.
2. Always read both source/context inputs before editing a song: the existing `typ/songs/NNN-*.typ` and every matching rendered `.png` thumbnail page in `static/chord-thumbnails/`. The `.png` image pages are required context for every song, not optional.
3. Read the requested PDF or rendered thumbnail. Use it as the authoritative visual source for chord placement and chord rows.
4. Do not read or use the matching DOCX files unless the user explicitly asks for DOCX inspection. They are not an allowed source for normal correction work.
5. Read the existing matching file in `typ/songs/NNN-*.typ`.
6. Edit that one song by hand, preserving `#let song = [` module wrapping.
7. Preserve the numbered title, section order, lyrics, repeat markers, and source chord intent.
8. Merge chords into lyric lines using conchord syntax.
9. Add a trailing space after each `]`.
10. Add `\` manual line breaks.
11. Replace `H` notation with `B`.
12. Compile `typ/all.typ` after the edit when practical, and run `npm run songs` to regenerate the page and chord PDF.
13. Report only the file changed and verification result unless the user asks for the full Typst code.

## Quality Checks

Before responding, verify:

* No chord appears as `[Chord]` without a following space.
* No lyric line is missing a final `\`.
* The song title includes its number.
* Section headings are consistent.
* Repeats from the image are included.
* Transposition, if requested, is applied consistently.
* No source-only `:` line appears under a section heading.
* No leading `-` line renders as a Typst bullet.
* No adjacent chord tokens visually collide.
* Sharp chords have exactly one backslash before `#`.

```
