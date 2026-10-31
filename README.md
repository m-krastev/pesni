# Песни

Bulgarian Christian worship songs with lyrics and chords: [pesni.propovedi.org](https://pesni.propovedi.org).

Every song is one [ChordPro](https://www.chordpro.org/) file in [`songs/`](songs). The website, the printable
lyrics and chord sheets, and the OpenLP song files are all generated from those files.

```
songs/NNN-slug.cho ──► docs/NNN.md + src/data/songs/NNN.json   website page (Docusaurus)
                   ├─► static/pdf/N-slug.pdf                    lyrics PDF   (Typst: typ/lyrics.typ)
                   ├─► static/chords/N-slug_akord.pdf           chord PDF    (Typst: typ/single.typ)
                   └─► static/openlp/*.xml, pesni-openlp.zip    OpenLyrics for OpenLP
```

On a song page you can show or hide the chords and transpose them; the choice is remembered per browser.

## Editing a song

A song looks like this:

```chordpro
{title: ВЕЛИЧАЯ ТЕ}
{meta: original I Exalt Thee}
{artist: Pete Sanchez Jr.}

{start_of_verse: Куплет 1}
[G]ЗАЩОТО ТИ, [C]ГОСПОДИ,
СИ [D]НАД ЦЯЛА ЗЕ[G]МЯ! [Em]
{end_of_verse}

{start_of_chorus: Припев}
[G]ВЕЛИЧАЯ ТЕ!
{end_of_chorus}

{chorus: Припев}
```

- The song number comes from the file name, `052-velichaq-te.cho`.
- A chord goes right before the syllable it is played on, also inside a word: `ЗЕ[G]МЯ`.
- `{chorus: Припев}` repeats the chorus; it becomes the verse order in OpenLP.
- Credits (`{meta: original}`, `{artist}`, `{meta: translator}`, `{copyright}`) appear under the title.
- Lines starting with `#` are notes for editors and are never shown.

[`AGENTS.md`](AGENTS.md) has the full conventions. [`songs/MISSING-CHORDS.md`](songs/MISSING-CHORDS.md) lists songs
that still need chords, and [`songs/CREDITS-TODO.md`](songs/CREDITS-TODO.md) credits waiting to be confirmed.

After editing, check the result locally:

```sh
npm start        # regenerates the songs, then opens the site at http://localhost:3000
npm test         # tests for the song build and the transposer
```

The build stops with the file and line of anything it cannot render faithfully: an unknown directive,
an unknown chord (including German `H`; write `B`), or a section that is never closed.

## Setup

Requires Node.js 18 or newer and [Typst](https://typst.app/) (for the PDFs; without it the site still builds
but the PDFs are not rendered).

```sh
npm ci
npm run build    # songs + PDFs + static site into build/
npm run serve    # preview build/
```

`npm run songs` regenerates only the songs; it re-renders a PDF only when its song or the Typst templates
changed (`node scripts/build-songs.mjs --force-pdf` renders all). The whole songbook as one PDF:

```sh
npm run songs && typst compile --root . typ/all.typ songbook.pdf
```

## Deployment

Pushing to `main` runs [the GitHub Actions workflow](.github/workflows/site.yml): tests, build, and upload to
the FTP server. Other branches and pull requests are only tested and built. The upload copies files and
never deletes anything on the server.

The workflow needs two repository secrets (Settings → Secrets and variables → Actions):

- `FTP_USER`: the FTP user name,
- `FTP_PASS_OBSCURED`: the password in rclone's obscured form, as it appears in `rclone.conf`
  (or `rclone obscure 'password'`).

To deploy by hand from a machine with an rclone remote called `propovedi`: `npm run build && npm run deploy`.

## Repository layout

| Path | Contents |
|------|----------|
| `songs/` | the songs (ChordPro), the source of truth |
| `scripts/build-songs.mjs`, `scripts/songs/` | the song build and its tests |
| `typ/` | Typst templates for the printed sheets (`style.typ` holds the look) |
| `src/components/ChordSheet/` | the song view: lyrics, chords, transposition |
| `static/old_chords/`, `static/old_pdf/` | the original chord and lyrics files, kept unchanged |

`docs/`, `src/data/songs/`, `typ/generated/`, `static/pdf/`, `static/chords/` and `static/openlp/` are generated
and not tracked in git.
