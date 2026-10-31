#!/usr/bin/env node
// Builds everything the site needs from songs/NNN-slug.cho (ChordPro), the
// single source of truth for every song:
//   src/data/songs/NNN.json   lyrics, sections and chords for <ChordSheet>
//   docs/NNN.md               the song page
//   typ/generated/*.typ       conchord modules for typ/single.typ and typ/all.typ
//   static/chords/*_akord.pdf printable chord sheet (re-rendered when its .typ changed)
//   static/openlp/*.xml       OpenLyrics for OpenLP, plus pesni-openlp.zip with all songs
//
// Runs before `npm run build` / `npm start`. A song that does not parse, uses an
// unknown directive or an unknown chord stops the build.
//
//   node scripts/build-songs.mjs              # everything
//   node scripts/build-songs.mjs 23 218       # selected song numbers
//   node scripts/build-songs.mjs --force-pdf  # re-render the PDFs even if up to date
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import chordsheet from 'chordsheetjs';

const {ChordProParser, Chord} = chordsheet;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SONGS = path.join(ROOT, 'songs');
const DOCS = path.join(ROOT, 'docs');
const STATIC = path.join(ROOT, 'static');
const DATA = path.join(ROOT, 'src', 'data', 'songs');
const TYP = path.join(ROOT, 'typ');
const GENERATED = path.join(TYP, 'generated');
const OPENLP = path.join(STATIC, 'openlp');
const TEMPLATES = ['single.typ', 'style.typ'].map((f) => path.join(TYP, f));

const META_TAGS = new Set(['title', 'subtitle', 'artist', 'composer', 'lyricist', 'copyright', 'album',
    'year', 'key', 'time', 'tempo', 'capo', 'duration', 'meta']);
const BARS_ONLY = /^[\s|:.]*$/;

class SongError extends Error {}

// A chord, or a sequence on one syllable written the way the old sheets do: `D/Em`, `Em/D/C`.
const isChord = (name) => Boolean(Chord.parse(name)) || name.split('/').every((part) => Chord.parse(part));

function writeIfChanged(file, text) {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, text);
    return true;
}

// --- ChordPro -> song model ---------------------------------------------------

function sectionKind(tagName) {
    return tagName.replace(/^start_of_/, '');
}

function parseSong(file) {
    const source = fs.readFileSync(file, 'utf8');
    let parsed;
    try {
        parsed = new ChordProParser().parse(source);
    } catch (e) {
        throw new SongError(`${e.message}`);
    }
    const song = {title: null, meta: {}, sections: []};
    let current = null;
    const fail = (lineNo, msg) => {
        throw new SongError(`line ${lineNo}: ${msg}`);
    };
    parsed.lines.forEach((line, i) => {
        const lineNo = i + 1;
        // `# ...` source comments are notes for editors, not song content.
        const items = line.items.filter((item) => !('content' in item && !('chords' in item)));
        if (items.length < line.items.length && !items.length) return;
        const tags = items.filter((item) => 'chords' in item ? false : item.name !== undefined);
        const pairs = items.filter((item) => 'chords' in item);
        if (tags.length + pairs.length < items.length) fail(lineNo, 'unsupported ChordPro content');
        for (const tag of tags) {
            const {name, value} = tag;
            if (name === 'title') song.title = value;
            else if (META_TAGS.has(name)) song.meta[name] = value;
            else if (name.startsWith('start_of_')) {
                if (current) fail(lineNo, `{${name}} inside {start_of_${current.kind}}`);
                current = {title: value || '', kind: sectionKind(name), lines: []};
                song.sections.push(current);
            } else if (name.startsWith('end_of_')) {
                if (!current || name !== `end_of_${current.kind}`) fail(lineNo, `unexpected {${name}}`);
                current = null;
            } else if (name === 'chorus') {
                if (current) fail(lineNo, '{chorus} inside a section');
                song.sections.push({title: value || 'Припев', kind: 'chorus', repeat: true, lines: []});
            } else if (name === 'comment' || name === 'comment_italic') {
                (current || pushLoose()).lines.push({comment: value});
            } else {
                fail(lineNo, `unknown directive {${name}}`);
            }
        }
        if (!tags.length && !pairs.length) {
            if (current && current.lines.length && current.lines[current.lines.length - 1] !== null) current.lines.push(null);
            return;
        }
        if (!pairs.length) return;
        const segments = [];
        for (const pair of pairs) {
            const chord = pair.chords || null;
            if (chord && !isChord(chord)) fail(lineNo, `unknown chord [${chord}]`);
            if (chord || !segments.length) segments.push([chord, pair.lyrics || '']);
            else segments[segments.length - 1][1] += pair.lyrics || '';
        }
        (current || pushLoose()).lines.push(segments);
    });
    if (current) throw new SongError(`{start_of_${current.kind}} is never closed`);
    if (!song.title) throw new SongError('missing {title}');
    for (const section of song.sections) {
        while (section.lines.length && section.lines[section.lines.length - 1] === null) section.lines.pop();
    }
    return song;

    // Lyrics outside any {start_of_...} block go into an unnamed verse.
    function pushLoose() {
        const last = song.sections[song.sections.length - 1];
        if (last && last.loose) return last;
        const loose = {title: '', kind: 'verse', loose: true, lines: []};
        song.sections.push(loose);
        return loose;
    }
}

const isChordOnly = (line) => Array.isArray(line) && line.some(([c]) => c) && BARS_ONLY.test(line.map(([, t]) => t).join(''));
const hasChords = (song) => song.sections.some((s) => s.lines.some((l) => Array.isArray(l) && l.some(([c]) => c)));

// --- Typst (conchord) ---------------------------------------------------------

function typText(text) {
    let out = text.replace(/[\\#*_`$@<>\[\]~]/g, (c) => `\\${c}`).replace(/\/(?=[/*])/g, '\\/');
    out = out.replace(/^([-+=]|\/ )/, '\\$1').replace(/^(\d+)\.(\s)/, '$1\\.$2');
    return out;
}

function typChord(chord) {
    return chord.replace(/#/g, '\\#');
}

function typLine(segments) {
    if (isChordOnly(segments) && segments.some(([, t]) => t.includes('|'))) {
        return `#strong[${typText(segments.map(([c, t]) => (c || '') + t).join('').trim())}] \\`;
    }
    let out = '';
    segments.forEach(([chord, text], i) => {
        // Two or more spaces in the .cho keep a visible gap before the next chord.
        const gapped = (t) => typText(t).replace(/ {2,}/g, (gap, at, all) =>
            at + gap.length < all.length || i + 1 < segments.length ? ' `   ` ' : ' ');
        if (!chord) {
            out += gapped(text);
            return;
        }
        out += `[${typChord(chord)}] `;
        if (!text.trim() && i + 1 < segments.length) out += '`   ` ';
        else out += gapped(text);
    });
    return `${out.trimEnd()} \\`;
}

function typModule(number, song, sourceName) {
    const lines = [`// Generated from songs/${sourceName} by scripts/build-songs.mjs: edit the .cho file.`,
        '#let song = [', `= ${number}. ${typText(song.title)}`];
    for (const section of song.sections) {
        lines.push('');
        if (section.title) lines.push(`=== [[${section.title}]]`);
        for (const line of section.lines) {
            if (line === null) lines.push('');
            else if (line.comment) lines.push(`_(${typText(line.comment)})_ \\`);
            else lines.push(typLine(line));
        }
    }
    lines.push(']');
    return lines.join('\n') + '\n';
}

// --- OpenLyrics (OpenLP) ------------------------------------------------------

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function verseType(section) {
    const label = section.title.toLowerCase();
    if (section.kind === 'chorus' || label.startsWith('припев')) return 'c';
    if (section.kind === 'bridge' || /^(мост|бридж)/.test(label)) return 'b';
    if (/^пред/.test(label)) return 'p';
    if (/^интро/.test(label)) return 'i';
    if (/^(край|финал|аутро)/.test(label)) return 'e';
    if (/^куплет/.test(label) || !label) return 'v';
    return 'o';
}

function openLyrics(number, song) {
    const names = new Map();
    const counters = {};
    const verses = [];
    const order = [];
    for (const section of song.sections) {
        if (section.repeat) {
            if (names.has(section.title)) order.push(names.get(section.title));
            continue;
        }
        const blocks = [[]];
        for (const line of section.lines) {
            if (line === null) blocks.push([]);
            else if (Array.isArray(line) && !isChordOnly(line)) {
                blocks[blocks.length - 1].push(line.map(([chord, text]) =>
                    (chord ? `<chord name="${xml(chord)}"/>` : '') + xml(text)).join('').trim());
            }
        }
        const filled = blocks.filter((b) => b.length);
        if (!filled.length) continue;
        const type = verseType(section);
        counters[type] = (counters[type] || 0) + 1;
        const name = `${type}${counters[type]}`;
        if (section.title) names.set(section.title, name);
        order.push(name);
        verses.push(`    <verse name="${name}">\n${filled.map((b) => `      <lines>${b.join('<br/>')}</lines>`).join('\n')}\n    </verse>`);
    }
    const authors = ['lyricist', 'composer', 'artist'].filter((k) => song.meta[k])
        .map((k) => `      <author>${xml(song.meta[k])}</author>`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8" createdIn="pesni.propovedi.org">
  <properties>
    <titles>
      <title>${xml(song.title)}</title>
    </titles>
${authors.length ? `    <authors>\n${authors.join('\n')}\n    </authors>\n` : ''}    <verseOrder>${order.join(' ')}</verseOrder>
    <songbooks>
      <songbook name="Песни" entry="${number}"/>
    </songbooks>
  </properties>
  <lyrics>
${verses.join('\n')}
  </lyrics>
</song>
`;
}

// --- pages ----------------------------------------------------------------------

function findStatic(folder, number, slug, suffix) {
    const dir = path.join(STATIC, folder);
    const names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const exact = names.find((n) => n.toLowerCase() === `${number}-${slug}${suffix}`.toLowerCase());
    if (exact) return `/${folder}/${exact}`;
    const matches = names.filter((n) => n.toLowerCase().startsWith(`${number}-`) && n.toLowerCase().endsWith(suffix.toLowerCase()));
    return matches.length === 1 ? `/${folder}/${matches[0]}` : null;
}

function mdxText(text) {
    return text.replace(/[{}]/g, (c) => `\\${c}`).replace(/</g, '&lt;');
}

function page(number, song, sourceName, buttons) {
    const id = String(number).padStart(3, '0');
    return [
        `import song from '@site/src/data/songs/${id}.json';`,
        '',
        `# ${number}. ${mdxText(song.title)}`,
        '',
        `<!-- Generated from songs/${sourceName} by scripts/build-songs.mjs: edit the .cho file, not this page. -->`,
        '',
        '<ChordSheet song={song} />',
        ...buttons.flatMap((b) => ['', b]),
    ].join('\n') + '\n';
}

// --- main -----------------------------------------------------------------------

function compile(typModulePath, pdfPath) {
    execFileSync('typst', ['compile', '--root', ROOT, '--input',
        `song=${path.relative(TYP, typModulePath).split(path.sep).join('/')}`,
        path.join(TYP, 'single.typ'), pdfPath], {stdio: 'inherit'});
}

function isStale(sources, target) {
    if (!fs.existsSync(target)) return true;
    const built = fs.statSync(target).mtimeMs;
    return sources.some((s) => fs.statSync(s).mtimeMs > built);
}

function hasCommand(cmd) {
    try {
        execFileSync(cmd, ['--version'], {stdio: 'ignore'});
        return true;
    } catch (e) {
        return false;
    }
}

function main() {
    const args = process.argv.slice(2);
    const forcePdf = args.includes('--force-pdf');
    const wanted = new Set(args.filter((a) => /^\d+$/.test(a)).map(Number));
    const typst = hasCommand('typst');
    if (!typst) console.warn('warning: typst not found, chord PDFs are not re-rendered');

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
            song = parseSong(path.join(SONGS, file));
        } catch (e) {
            if (!(e instanceof SongError)) throw e;
            errors.push(`songs/${file}: ${e.message}`);
            continue;
        }
        const typPath = path.join(GENERATED, `${id}-${slug}.typ`);
        writeIfChanged(typPath, typModule(number, song, file));
        modules.push([id, `${id}-${slug}.typ`]);
        if (wanted.size && !wanted.has(number)) continue;

        writeIfChanged(path.join(DATA, `${id}.json`), JSON.stringify({id, sections: song.sections}) + '\n');
        changedXml = writeIfChanged(path.join(OPENLP, `${number}-${slug}.xml`), openLyrics(number, song)) || changedXml;

        let chordsPdf = findStatic('chords', number, slug, '_akord.pdf');
        if (hasChords(song)) {
            chordsPdf = chordsPdf || `/chords/${number}-${slug}_akord.pdf`;
            const pdfPath = path.join(STATIC, chordsPdf);
            if (typst && (forcePdf || isStale([typPath, ...TEMPLATES], pdfPath))) {
                compile(typPath, pdfPath);
                rendered += 1;
            }
        }
        const lyricsPdf = findStatic('pdf', number, slug, '.pdf');
        const buttons = [];
        if (lyricsPdf) buttons.push(`<DownloadsButton pdf="${lyricsPdf}" />`);
        if (chordsPdf) buttons.push(`<DownloadChordsButton pdf="${chordsPdf}"/>`);
        buttons.push(`<DownloadOpenLPButton xml="/openlp/${number}-${slug}.xml" />`);
        writeIfChanged(path.join(DOCS, `${id}.md`), page(number, song, file, buttons));
    }
    if (errors.length) {
        console.error(`\n${errors.length} song(s) could not be built:\n  ${errors.join('\n  ')}`);
        process.exit(1);
    }

    writeIfChanged(path.join(GENERATED, 'songs.typ'),
        '// Generated by scripts/build-songs.mjs: every song module, in order.\n' +
        modules.map(([id, f]) => `#import "${f}": song as song${id}`).join('\n') +
        `\n\n#let songs = (\n${modules.map(([id]) => `  song${id},`).join('\n')}\n)\n`);

    const zip = path.join(OPENLP, 'pesni-openlp.zip');
    if ((changedXml || !fs.existsSync(zip)) && hasCommand('zip')) {
        fs.rmSync(zip, {force: true});
        execFileSync('zip', ['-q', '-X', '-j', zip, ...fs.readdirSync(OPENLP).filter((f) => f.endsWith('.xml')).sort()
            .map((f) => path.join(OPENLP, f))]);
    }
    console.log(`built ${wanted.size || files.length} songs, rendered ${rendered} chord PDFs`);
}

main();
