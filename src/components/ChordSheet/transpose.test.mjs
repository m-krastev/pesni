import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noteNamesFor, transposeChord} from './transpose.js';

const up = (chord, semitones, key = chord) => transposeChord(chord, semitones, noteNamesFor(key, semitones));

test('transposes roots, qualities and bass notes', () => {
    assert.equal(up('G', 2), 'A');
    assert.equal(up('Em7', 2, 'G'), 'F#m7');
    assert.equal(up('F#m/B', 1, 'F#m'), 'Gm/C');
    assert.equal(up('Gsus', -2), 'Fsus');
});

test('uses flats in flat keys', () => {
    assert.equal(up('G', 3), 'Bb');
    assert.equal(up('D', 1, 'G'), 'Eb');
    assert.equal(up('C#m', 0), 'C#m');
});

test('transposes chord sequences on one syllable', () => {
    assert.equal(up('D/Em', 2, 'D'), 'E/F#m');
    assert.equal(up('Em/D/C', 2, 'Em'), 'F#m/E/D');
});

test('leaves what it cannot read untouched', () => {
    assert.equal(up('N.C.', 2, 'G'), 'N.C.');
});
