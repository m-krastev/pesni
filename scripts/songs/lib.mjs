// Pure conversions of a ChordPro song (songs/NNN-slug.cho) into what the site,
// the printed sheets and OpenLP need. File access lives in scripts/build-songs.mjs.
import chordsheet from 'chordsheetjs';

const {ChordProParser, Chord} = chordsheet;

// Metadata directives a song may use. `original` and `translator` are written
// `{meta: original Shine, Jesus, Shine}` / `{meta: translator ...}`.
export const META_FIELDS = ['title', 'artist', 'composer', 'lyricist', 'copyright', 'key', 'tempo', 'time',
    'capo', 'ccli', 'original', 'translator'];
const BARS_ONLY = /^[\s|:.]*$/;

export class SongError extends Error {}

// A chord, or a sequence on one syllable written the way the old sheets do: `D/Em`, `Em/D/C`.
export const isChord = (name) => Boolean(Chord.parse(name)) || name.split('/').every((part) => Chord.parse(part));

// Chord rows (intros, `||: [F#m] | [D] :||`) carry no lyrics.
export const isChordOnly = (line) => Array.isArray(line) && line.some(([chord]) => chord)
    && BARS_ONLY.test(line.map(([, text]) => text).join(''));

export const hasChords = (song) => song.sections.some((s) => s.lines.some((l) => Array.isArray(l) && l.some(([c]) => c)));

/**
 * Parses ChordPro into {title, meta, sections}. A section is
 * {title, kind, repeat?, lines}; a line is null (stanza break), {comment} or
 * an array of [chord | null, text] segments. Throws SongError on anything the
 * site would not render faithfully.
 */
export function parseSong(source) {
    let parsed;
    try {
        parsed = new ChordProParser().parse(source);
    } catch (e) {
        throw new SongError(e.message);
    }
    const song = {title: null, meta: {}, sections: []};
    let current = null;
    const fail = (lineNo, msg) => {
        throw new SongError(`line ${lineNo}: ${msg}`);
    };
    // Lyrics outside any {start_of_...} block go into an unnamed verse.
    const target = () => {
        if (current) return current;
        const last = song.sections[song.sections.length - 1];
        if (last && last.loose) return last;
        const loose = {title: '', kind: 'verse', loose: true, lines: []};
        song.sections.push(loose);
        return loose;
    };

    parsed.lines.forEach((line, i) => {
        const lineNo = i + 1;
        // `# ...` lines are notes for editors, not song content.
        const items = line.items.filter((item) => !('content' in item && !('chords' in item)));
        if (items.length < line.items.length && !items.length) return;
        const pairs = items.filter((item) => 'chords' in item);
        const tags = items.filter((item) => !('chords' in item) && item.name !== undefined);
        if (tags.length + pairs.length < items.length) fail(lineNo, 'unsupported ChordPro content');

        for (const {name, value} of tags) {
            if (name === 'title') song.title = value;
            else if (META_FIELDS.includes(name)) song.meta[name] = value;
            else if (name.startsWith('start_of_')) {
                if (current) fail(lineNo, `{${name}} inside {start_of_${current.kind}}`);
                current = {title: value || '', kind: name.slice('start_of_'.length), lines: []};
                song.sections.push(current);
            } else if (name.startsWith('end_of_')) {
                if (!current || name !== `end_of_${current.kind}`) fail(lineNo, `unexpected {${name}}`);
                current = null;
            } else if (name === 'chorus') {
                if (current) fail(lineNo, '{chorus} inside a section');
                song.sections.push({title: value || 'Припев', kind: 'chorus', repeat: true, lines: []});
            } else if (name === 'comment' || name === 'comment_italic') {
                target().lines.push({comment: value});
            } else {
                fail(lineNo, `unknown directive {${name}}`);
            }
        }
        if (!tags.length && !pairs.length) {
            const section = current;
            if (section && section.lines.length && section.lines[section.lines.length - 1] !== null) section.lines.push(null);
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
        target().lines.push(segments);
    });
    if (current) throw new SongError(`{start_of_${current.kind}} is never closed`);
    if (!song.title) throw new SongError('missing {title}');
    for (const section of song.sections) {
        delete section.loose;
        while (section.lines.length && section.lines[section.lines.length - 1] === null) section.lines.pop();
    }
    return song;
}

/** One line of credits, e.g. `Оригинал: „I Exalt Thee“ · Pete Sanchez Jr. · Превод: ...`. */
export function credits(meta) {
    const parts = [];
    if (meta.original) parts.push(`Оригинал: „${meta.original}“`);
    const authors = [meta.artist, meta.lyricist, meta.composer].filter(Boolean);
    if (authors.length) parts.push([...new Set(authors)].join(', '));
    if (meta.translator) parts.push(`Превод: ${meta.translator}`);
    return parts.join(' · ');
}

/** Plain lyrics of a song, for page descriptions and search. */
export function lyricLines(song) {
    return song.sections.flatMap((s) => s.lines.filter((l) => Array.isArray(l) && !isChordOnly(l))
        .map((l) => l.map(([, t]) => t).join('').replace(/\s+/g, ' ').trim()));
}

// --- Typst (conchord) ---------------------------------------------------------

export function typText(text) {
    let out = text.replace(/[\\#*_`$@<>\[\]~]/g, (c) => `\\${c}`).replace(/\/(?=[/*])/g, '\\/');
    out = out.replace(/^([-+=]|\/ )/, '\\$1').replace(/^(\d+)\.(\s)/, '$1\\.$2');
    return out;
}

function typChordLine(segments) {
    if (isChordOnly(segments) && segments.some(([, t]) => t.includes('|'))) {
        return `#strong[${typText(segments.map(([c, t]) => (c || '') + t).join('').trim())}] \\`;
    }
    let out = '';
    segments.forEach(([chord, text], i) => {
        // Two or more spaces keep a visible gap before the next chord.
        const gapped = (t) => typText(t).replace(/ {2,}/g, (gap, at, all) =>
            at + gap.length < all.length || i + 1 < segments.length ? ' `   ` ' : ' ');
        if (!chord) {
            out += gapped(text);
            return;
        }
        out += `[${chord.replace(/#/g, '\\#')}] `;
        if (!text.trim() && i + 1 < segments.length) out += '`   ` ';
        else out += gapped(text);
    });
    return `${out.trimEnd()} \\`;
}

function typBody(song, withChords) {
    const lines = [];
    for (const section of song.sections) {
        const body = [];
        for (const line of section.lines) {
            if (line === null) body.push('');
            else if (line.comment) body.push(`_(${typText(line.comment)})_ \\`);
            else if (withChords) body.push(typChordLine(line));
            else if (!isChordOnly(line)) body.push(`${typText(line.map(([, t]) => t).join('').replace(/\s+/g, ' ').trim())} \\`);
        }
        while (body.length && body[body.length - 1] === '') body.pop();
        lines.push('');
        if (withChords) {
            if (section.title) lines.push(`=== [[${section.title}]]`);
            lines.push(...body);
        } else if (section.repeat) {
            lines.push(`_(${typText(section.title)})_ \\`);
        } else if (body.length) {
            lines.push(section.kind === 'chorus' ? `#chorus[\n${body.join('\n')}\n]` : body.join('\n'));
        }
    }
    return lines.join('\n');
}

/** A Typst module exporting `song` (chord sheet), `lyrics` (lyrics only) and `info`. */
export function typModule(number, song, sourceName) {
    const info = credits(song.meta);
    return [
        `// Generated from songs/${sourceName} by scripts/build-songs.mjs: edit the .cho file.`,
        '#import "../style.typ": chorus, song-info',
        `#let title = [= ${number}. ${typText(song.title)}]`,
        `#let info = ${info ? `song-info[${typText(info)}]` : '[]'}`,
        `#let copyright = ${song.meta.copyright ? `song-info[${typText(song.meta.copyright)}]` : '[]'}`,
        '',
        `#let song = [\n#title\n#info\n${typBody(song, true)}\n\n#copyright\n]`,
        '',
        `#let lyrics = [\n#title\n#info\n${typBody(song, false)}\n\n#copyright\n]`,
        '',
    ].join('\n');
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

export function openLyrics(number, song) {
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
    const {meta} = song;
    const authors = [
        ...[meta.artist, meta.lyricist, meta.composer].filter(Boolean).map((a) => `      <author>${xml(a)}</author>`),
        ...(meta.translator ? [`      <author type="translation" lang="bg">${xml(meta.translator)}</author>`] : []),
    ];
    const optional = (tag, value) => (value ? `    <${tag}>${xml(value)}</${tag}>\n` : '');
    return `<?xml version="1.0" encoding="UTF-8"?>
<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8" createdIn="pesni.propovedi.org">
  <properties>
    <titles>
      <title>${xml(song.title)}</title>
${meta.original ? `      <title lang="en">${xml(meta.original)}</title>\n` : ''}    </titles>
${authors.length ? `    <authors>\n${[...new Set(authors)].join('\n')}\n    </authors>\n` : ''}${optional('copyright', meta.copyright)}${optional('ccliNo', meta.ccli)}${optional('key', meta.key)}    <verseOrder>${order.join(' ')}</verseOrder>
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

// --- Docusaurus page ------------------------------------------------------------

const yamlString = (s) => JSON.stringify(s);
const mdxText = (text) => text.replace(/[{}]/g, (c) => `\\${c}`).replace(/</g, '&lt;');

export function page(number, song, sourceName, downloads) {
    const id = String(number).padStart(3, '0');
    const description = lyricLines(song).slice(0, 2).join(' / ');
    return [
        '---',
        `# Generated from songs/${sourceName} by scripts/build-songs.mjs: edit the .cho file, not this page.`,
        `description: ${yamlString(description)}`,
        '---',
        '',
        `import song from '@site/src/data/songs/${id}.json';`,
        '',
        `# ${number}. ${mdxText(song.title)}`,
        '',
        '<ChordSheet song={song} />',
        ...downloads.flatMap((d) => ['', d]),
    ].join('\n') + '\n';
}

/** What the <ChordSheet> component gets. */
export function pageData(number, song) {
    const id = String(number).padStart(3, '0');
    return {id, credits: credits(song.meta), copyright: song.meta.copyright || '', sections: song.sections};
}
