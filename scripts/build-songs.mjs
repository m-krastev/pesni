#!/usr/bin/env node
// Builds everything the site needs from songs/NNN-slug.cho (ChordPro), the
// single source of truth for every song:
//   src/data/songs/NNN.json      lyrics, sections, chords and credits for <ChordSheet>
//   docs/NNN.md                  the song page
//   typ/generated/*.typ          Typst modules for typ/single.typ, typ/lyrics.typ, typ/all.typ
//   static/pdf/N-slug.pdf        printable lyrics
//   static/chords/N-slug_akord.pdf  printable chord sheet (songs with chords)
//   static/openlp/*.xml          OpenLyrics for OpenLP, plus pesni-openlp.zip with all songs
//   static/{pdf,chords,}/N/      short links: /pdf/52, /chords/52 and /52 lead to the song's files and page
//
// Runs before `npm run build` / `npm start`. A song that does not parse, uses an
// unknown directive or an unknown chord stops the build. PDFs are re-rendered
// only when their Typst module or the templates changed.
//
//   node scripts/build-songs.mjs              # everything
//   node scripts/build-songs.mjs 23 218       # selected song numbers
//   node scripts/build-songs.mjs --force-pdf  # re-render the PDFs even if up to date
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SongError, hasChords, openLyrics, page, pageData, parseSong, redirectPage, typModule} from './songs/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SONGS = path.join(ROOT, 'songs');
const DOCS = path.join(ROOT, 'docs');
const STATIC = path.join(ROOT, 'static');
const DATA = path.join(ROOT, 'src', 'data', 'songs');
const TYP = path.join(ROOT, 'typ');
const GENERATED = path.join(TYP, 'generated');
const OPENLP = path.join(STATIC, 'openlp');
const STYLE = path.join(TYP, 'style.typ');

function writeIfChanged(file, text) {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, text);
    return true;
}

function hasCommand(cmd) {
    try {
        execFileSync(cmd, ['--version'], {stdio: 'ignore'});
        return true;
    } catch (e) {
        return false;
    }
}

function isStale(sources, target) {
    if (!fs.existsSync(target)) return true;
    const built = fs.statSync(target).mtimeMs;
    return sources.some((s) => fs.statSync(s).mtimeMs > built);
}

function renderPdf(template, modulePath, pdfPath, force) {
    const templatePath = path.join(TYP, template);
    if (!force && !isStale([modulePath, templatePath, STYLE], pdfPath)) return false;
    fs.mkdirSync(path.dirname(pdfPath), {recursive: true});
    execFileSync('typst', ['compile', '--root', ROOT, '--input',
        `song=${path.relative(TYP, modulePath).split(path.sep).join('/')}`, templatePath, pdfPath], {stdio: 'inherit'});
    return true;
}

// The song's chord PDF from the old site, archived in static/old_chords (matched by
// slug, or by number when only one file has it).
function originalChords(number, slug) {
    const dir = path.join(STATIC, 'old_chords');
    const pdfs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /_akord\.pdf$/i.test(f)) : [];
    const exact = pdfs.find((f) => f.toLowerCase() === `${number}-${slug}_akord.pdf`);
    const byNumber = pdfs.filter((f) => f.startsWith(`${number}-`));
    const file = exact || (byNumber.length === 1 ? byNumber[0] : null);
    return file && `/old_chords/${file}`;
}

function main() {
    const args = process.argv.slice(2);
    const forcePdf = args.includes('--force-pdf');
    const wanted = new Set(args.filter((a) => /^\d+$/.test(a)).map(Number));
    const typst = hasCommand('typst');
    if (!typst) console.warn('warning: typst not found, PDFs are not rendered');

    const files = fs.readdirSync(SONGS).filter((f) => /^\d{3}-.+\.cho$/.test(f)).sort();
    const errors = [];
    const modules = [];
    let rendered = 0;
    let changedXml = false;
    for (const file of files) {
        const number = parseInt(file, 10);
        const id = file.slice(0, 3);
        const slug = file.slice(4, -4);
        let song;
        try {
            song = parseSong(fs.readFileSync(path.join(SONGS, file), 'utf8'));
        } catch (e) {
            if (!(e instanceof SongError)) throw e;
            errors.push(`songs/${file}: ${e.message}`);
            continue;
        }
        const modulePath = path.join(GENERATED, `${id}-${slug}.typ`);
        writeIfChanged(modulePath, typModule(number, song, file));
        modules.push([id, path.basename(modulePath)]);
        if (wanted.size && !wanted.has(number)) continue;

        writeIfChanged(path.join(DATA, `${id}.json`), JSON.stringify(pageData(number, song)) + '\n');
        changedXml = writeIfChanged(path.join(OPENLP, `${number}-${slug}.xml`), openLyrics(number, song)) || changedXml;

        const lyricsPdf = `/pdf/${number}-${slug}.pdf`;
        const chordsPdf = hasChords(song) ? `/chords/${number}-${slug}_akord.pdf` : null;
        if (typst) {
            rendered += renderPdf('lyrics.typ', modulePath, path.join(STATIC, lyricsPdf), forcePdf);
            if (chordsPdf) rendered += renderPdf('single.typ', modulePath, path.join(STATIC, chordsPdf), forcePdf);
        }
        const downloads = [`<DownloadsButton pdf="${lyricsPdf}" />`];
        if (chordsPdf) downloads.push(`<DownloadChordsButton pdf="${chordsPdf}"/>`);
        const original = originalChords(number, slug);
        if (original) downloads.push(`<DownloadChordsButton pdf="${original}" label="Акорди (оригинал)"/>`);
        writeIfChanged(path.join(DOCS, `${id}.md`), page(number, song, file, downloads));

        // Short links by number. Song pages already answer to /100../239/.
        writeIfChanged(path.join(STATIC, 'pdf', String(number), 'index.html'), redirectPage(lyricsPdf));
        if (chordsPdf) writeIfChanged(path.join(STATIC, 'chords', String(number), 'index.html'), redirectPage(chordsPdf));
        if (String(number) !== id) writeIfChanged(path.join(STATIC, String(number), 'index.html'), redirectPage(`/${id}/`));
    }
    if (errors.length) {
        console.error(`\n${errors.length} song(s) could not be built:\n  ${errors.join('\n  ')}`);
        process.exit(1);
    }

    writeIfChanged(path.join(GENERATED, 'songs.typ'),
        '// Generated by scripts/build-songs.mjs: every song module, in order.\n' +
        modules.map(([id, f]) => `#import "${f}" as song${id}`).join('\n') +
        `\n\n#let songs = (\n${modules.map(([id]) => `  song${id},`).join('\n')}\n)\n`);

    const zip = path.join(OPENLP, 'pesni-openlp.zip');
    if ((changedXml || !fs.existsSync(zip)) && hasCommand('zip')) {
        fs.rmSync(zip, {force: true});
        execFileSync('zip', ['-q', '-X', '-j', zip, ...fs.readdirSync(OPENLP).filter((f) => f.endsWith('.xml')).sort()
            .map((f) => path.join(OPENLP, f))]);
    }
    console.log(`built ${wanted.size || files.length} songs, rendered ${rendered} PDFs`);
}

main();
