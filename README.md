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
Short links by number lead to a song's page and files: `/52`, `/pdf/52`, `/chords/52`. Typing a number in
the search box finds that song.

## Songbooks

The site has one tab per songbook, listed in [`scripts/songs/books.mjs`](scripts/songs/books.mjs):

| Tab | Songs | Address |
|-----|-------|---------|
| Песни | `songs/` | `/052/` |
| Рождество | `books/rozhdestvo/` (the originals are kept in `static/pesni-rozhdestvo/`) | `/pesni-rozhdestvo/1/` |
| Песнарка | `books/pesnarka/` (imported once from the old hymnal site with `scripts/import_pesnarka.py`) | `/pesnarka/313/` |

Each book is its own Docusaurus docs instance with a generated sidebar and its own search index: the search box
searches the book you are in (from Песни it searches every book), and the search page can switch between them.
Песни keeps the paths it always had; the other books get theirs under their address (`/pesni-rozhdestvo/pdf/...`,
`static/openlp/rozhdestvo/`, `rozhdestvo-openlp.zip`). A new book is a folder of `.cho` files and an entry in
`books.mjs`.

Песнарка's hymns carry their hymnal reference, Bible reference and recordings as metadata
(`{meta: reference ...}`, `{meta: scripture ...}`, `{meta: melody|unison|score URL}`); the recordings and scores
are on hopeforthebalkans.org. Chords (from "Духовни песни" with chords) are over the first verse of 249 hymns.
The old address propovedi.org/pesnarka/ redirects here with
[`scripts/redirects/pesnarka.htaccess`](scripts/redirects/pesnarka.htaccess), copied by hand to
`public_html/pesnarka/.htaccess` on the server.

`static/.htaccess` replaces the site's `.htaccess` on the server: it keeps cPanel's lines and turns on
compression (the search index of all books is 5 MB of JSON, about 1 MB compressed).

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
the FTP server. Other branches and pull requests are only tested and built.

[`scripts/deploy.sh`](scripts/deploy.sh) uploads only the files whose content changed since the last deploy
(it keeps a copy of that build in `.deployed/`; CI keeps it in the Actions cache). It never deletes anything
on the server. Without a previous deploy it compares with the server by file size and re-uploads all pages.

The workflow needs two repository secrets (Settings → Secrets and variables → Actions):

- `FTP_USER`: the FTP user name,
- `FTP_PASS_OBSCURED`: the password in rclone's obscured form, as it appears in `rclone.conf`
  (or `rclone obscure 'password'`).

To deploy by hand from a machine with an rclone remote called `propovedi`: `npm run build && npm run deploy`.

## Correction suggestions

Every song page has a "Предложи корекция" button. It opens the song's `.cho` source (copied by the build to
`/cho/NNN-slug.cho`) in an editor with a live preview, drawn by the same parser as the build, so a broken chord
or section shows an error before anything is sent. The suggestion goes to
[`static/api/suggest.php`](static/api/suggest.php), which saves it in a SQLite database outside the web root
(`~/pesni-suggest-data/suggestions.sqlite`, created on first use). Nothing on the site changes by itself.

Review at <https://pesni.propovedi.org/api/suggestions.php>: each suggestion with its note, a diff against the
song as the site has it now, and the full proposed file to download. To accept one, put the change into
`songs/NNN-slug.cho` (or ask Claude to apply suggestion #N), push, and mark it "Приложено".

The review page needs a password. Make a hash of it (`htpasswd` comes with macOS):

```sh
htpasswd -bnBC 10 "" 'your password' | tr -d ':\n'
```

and put it in `~/pesni-suggest-config.php` on the server, next to the `pesni.propovedi.org` folder (not inside
it), for example through the cPanel file manager:

```php
<?php return ['admin_password_hash' => '$2y$10$...'];
```

The same file can point the suggestions to MySQL instead of SQLite with `'dsn' => 'mysql:host=localhost;dbname=...'`,
`'db_user'` and `'db_password'`. Limits against spam: 5 suggestions per hour from one address, 50 per day in all,
plus a hidden field that bots fill in.

## Repository layout

| Path | Contents |
|------|----------|
| `songs/` | the songs (ChordPro), the source of truth |
| `books/` | the other songbooks, one folder each |
| `scripts/build-songs.mjs`, `scripts/songs/` | the song build and its tests |
| `typ/` | Typst templates for the printed sheets (`style.typ` holds the look) |
| `src/components/ChordSheet/` | the song view: lyrics, chords, transposition |
| `src/components/SuggestEdit/`, `static/api/` | the correction editor and its PHP backend |
| `static/old_chords/`, `static/old_pdf/` | the original chord and lyrics files, kept unchanged |

`docs/`, `docs-*/`, `src/data/songs/`, `src/data/<book>/`, `src/data/sidebars/`, `typ/generated/`, `static/pdf/`,
`static/chords/`, `static/<book address>/pdf/` and `chords/`, `static/cho/` and `static/openlp/` are generated
and not tracked in git.
