import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SongError, credits, isChord, openLyrics, page, parseSong, redirectPage, typModule} from './lib.mjs';

const SONGS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../songs');

const SAMPLE = `# Акорди: бележка за редактора
{title: АЛЕЛУЯ}
{meta: original I Exalt Thee}
{artist: Pete Sanchez Jr.}

{start_of_verse: Куплет 1}
АЛЕ[Em]ЛУЯ! [C#m]ТИ СИ ЦАР!

[E] [A] [E]
{comment: 2x}
{end_of_verse}

{start_of_chorus: Припев}
[G]ВЪЗКРЪСНА <С МОЩ> [D/Em]
{end_of_chorus}

{chorus: Припев}
`;

test('parses sections, chords inside words, stanza breaks and repeats', () => {
    const song = parseSong(SAMPLE);
    assert.equal(song.title, 'АЛЕЛУЯ');
    assert.deepEqual(song.meta, {original: 'I Exalt Thee', artist: 'Pete Sanchez Jr.'});
    const [verse, chorus, repeat] = song.sections;
    assert.equal(verse.title, 'Куплет 1');
    assert.deepEqual(verse.lines[0], [[null, 'АЛЕ'], ['Em', 'ЛУЯ! '], ['C#m', 'ТИ СИ ЦАР!']]);
    assert.equal(verse.lines[1], null);
    assert.deepEqual(verse.lines[3], {comment: '2x'});
    assert.equal(chorus.kind, 'chorus');
    assert.deepEqual(repeat, {title: 'Припев', kind: 'chorus', repeat: true, lines: []});
});

test('rejects what the site could not render faithfully', () => {
    const errors = {
        '{title: X}\n{start_of_verse}\n[H]ДА\n{end_of_verse}\n': /unknown chord \[H\]/,
        '{title: X}\n{columns: 2}\n': /unknown directive \{columns\}/,
        '{title: X}\n{start_of_verse}\nДА\n': /never closed/,
        '{start_of_verse}\nДА\n{end_of_verse}\n': /missing \{title\}/,
        '{title: X}\n{start_of_verse}\nДА\n{end_of_chorus}\n': /unexpected \{end_of_chorus\}/,
    };
    for (const [source, message] of Object.entries(errors)) {
        assert.throws(() => parseSong(source), (e) => e instanceof SongError && message.test(e.message), source);
    }
});

test('accepts chord sequences written as on the old sheets', () => {
    assert.ok(isChord('D/Em'));
    assert.ok(isChord('Em/D/C'));
    assert.ok(isChord('F#m/B'));
    assert.ok(!isChord('Gem/Xy'));
});

test('writes conchord Typst for the chord sheet and plain lyrics', () => {
    const typ = typModule(52, parseSong(SAMPLE), '052-x.cho');
    assert.match(typ, /#let title = \[= 52\. АЛЕЛУЯ\]/);
    assert.match(typ, /АЛЕ\[Em\] ЛУЯ! \[C\\#m\] ТИ СИ ЦАР! \\/);
    assert.match(typ, /\[E\] `   ` \[A\] `   ` \[E\] \\/);
    assert.match(typ, /ВЪЗКРЪСНА \\<С МОЩ\\> \[D\/Em\] \\/);
    assert.match(typ, /song-info\[Оригинал: I Exalt Thee · Pete Sanchez Jr\.\]/);
    const lyrics = typ.slice(typ.indexOf('#let lyrics'));
    assert.doesNotMatch(lyrics, /\[Em\]|\[E\]/);
    assert.match(lyrics, /#chorus\[\nВЪЗКРЪСНА \\<С МОЩ\\> \\\n\]/);
    assert.match(lyrics, /_\(Припев\)_ \\/);
});

test('keeps a double space as a visible gap before the next chord', () => {
    const song = parseSong('{title: X}\n{start_of_verse}\n[Bm]ДНЕС!  [A4-5] [D]\n{end_of_verse}\n');
    assert.match(typModule(1, song, 'x.cho'), /\[Bm\] ДНЕС! `   ` \[A4-5\] `   ` \[D\] \\/);
});

test('writes OpenLyrics with verse order, chords and credits', () => {
    const xml = openLyrics(52, parseSong(SAMPLE));
    assert.match(xml, /<verseOrder>v1 c1 c1<\/verseOrder>/);
    assert.match(xml, /АЛЕ<chord name="Em"\/>ЛУЯ!/);
    assert.match(xml, /&lt;С МОЩ&gt;/);
    assert.match(xml, /<title lang="en">I Exalt Thee<\/title>/);
    assert.match(xml, /<author>Pete Sanchez Jr\.<\/author>/);
    assert.match(xml, /<songbook name="Песни" entry="52"\/>/);
    assert.doesNotMatch(xml, /<chord name="A"\/>/, 'chord-only rows are left out');
});

test('writes a page that MDX can compile', () => {
    const song = parseSong('{title: ТИ <СИ> #1}\n{start_of_verse}\nПЪРВИ РЕД\nВТОРИ РЕД\n{end_of_verse}\n');
    const md = page(7, song, '007-x.cho', ['<DownloadsButton pdf="/pdf/7-x.pdf" />']);
    assert.match(md, /^# 7\. ТИ &lt;СИ> #1$/m);
    assert.match(md, /^description: "ПЪРВИ РЕД \/ ВТОРИ РЕД"$/m);
    assert.match(md, /import song from '@site\/src\/data\/songs\/007\.json';/);
    assert.match(md, /^<SuggestEdit file="007-x\.cho" \/>$/m);
});

test('formats credits', () => {
    assert.equal(credits({}), '');
    assert.equal(credits({original: 'Creo en Ti', artist: 'Julio Melgar', translator: 'Х'}),
        'Оригинал: Creo en Ti · Julio Melgar · Превод: Х');
});

test('every song in songs/ builds', () => {
    const files = fs.readdirSync(SONGS).filter((f) => f.endsWith('.cho'));
    assert.ok(files.length > 200);
    for (const file of files) {
        assert.doesNotThrow(() => parseSong(fs.readFileSync(path.join(SONGS, file), 'utf8')), file);
    }
});

test('writes redirect pages for short links', () => {
    const html = redirectPage('/pdf/1-mir-kato-reka.pdf');
    assert.match(html, /<meta http-equiv="refresh" content="0; url=\/pdf\/1-mir-kato-reka\.pdf">/);
    assert.match(html, /location\.replace\("\/pdf\/1-mir-kato-reka\.pdf"\)/);
});

