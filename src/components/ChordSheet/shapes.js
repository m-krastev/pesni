import {parseChord} from './transpose';

// Guitar shapes for chord names, from @tombatossals/chords-db (MIT). The database
// (240 KB) loads only when someone asks for a diagram.

// The database's key names (C#, Eb, F#, Ab, Bb) for every spelling.
const DB_KEY = {
    C: 'C', 'B#': 'C', 'C#': 'C#', Db: 'C#', D: 'D', 'D#': 'Eb', Eb: 'Eb', E: 'E', Fb: 'E', 'E#': 'F', F: 'F',
    'F#': 'F#', Gb: 'F#', G: 'G', 'G#': 'Ab', Ab: 'Ab', A: 'A', 'A#': 'Bb', Bb: 'Bb', B: 'B', Cb: 'B', H: 'B',
};
// Bass notes as the database's slash chords spell them (/G#, /D#, /Bb).
const DB_BASS = {...DB_KEY, 'G#': 'G#', Ab: 'G#', 'D#': 'D#', Eb: 'D#', 'C#': 'C#', Db: 'C#', 'A#': 'Bb', Bb: 'Bb'};

// Chord qualities as the songs write them, and the database's suffix for each.
const SUFFIX = {
    '': 'major', M: 'major', maj: 'major', m: 'minor', min: 'minor', '-': 'minor',
    7: '7', m7: 'm7', min7: 'm7', maj7: 'maj7', M7: 'maj7', '7+': 'maj7', m7b5: 'm7b5', ø: 'm7b5', 'm7+': 'mmaj7', mmaj7: 'mmaj7',
    sus: 'sus4', sus4: 'sus4', 4: 'sus4', sus2: 'sus2', 2: 'sus2', '7sus4': '7sus4', '7sus': '7sus4', 74: '7sus4',
    add9: 'add9', add2: 'add9', madd9: 'madd9', m2: 'madd9', 9: '9', m9: 'm9', maj9: 'maj9',
    6: '6', m6: 'm6', 69: '69', '6/9': '69', 11: '11', m11: 'm11', 13: '13',
    dim: 'dim', '°': 'dim', dim7: 'dim7', aug: 'aug', '+': 'aug', '7b9': '7b9', '7#9': '7#9', '7b5': '7b5',
};

let database = null;
let loading = null;

/** Loads the shapes; resolves when `shapeOf` can answer. */
export function loadShapes() {
    if (!loading) {
        loading = import('@tombatossals/chords-db/lib/guitar.json').then((module) => {
            database = module.default || module;
        });
    }
    return loading;
}

export const shapesLoaded = () => database !== null;

function lookup(key, suffix) {
    const chords = database && database.chords[key.replace('#', 'sharp')];
    const chord = chords && chords.find((c) => c.suffix === suffix);
    return chord ? chord.positions[0] : null;
}

/**
 * The chords a name stands for: one for "Am7" or "D/F#", several for a sequence
 * on one syllable such as "D/Em".
 */
export function chordsIn(name) {
    if (parseChord(name)) return [name];
    const parts = name.split('/');
    return parts.every(parseChord) ? parts : [];
}

/** The guitar shape of one chord ({frets, fingers, baseFret, barres}), or null. */
export function shapeOf(name) {
    const parsed = parseChord(name);
    const key = parsed && DB_KEY[parsed.root];
    const suffix = parsed && SUFFIX[parsed.quality];
    if (!key || !suffix || !database) return null;
    if (parsed.bass) {
        const bass = DB_BASS[parsed.bass];
        const slash = suffix === 'major' ? `/${bass}` : suffix === 'minor' ? `m/${bass}` : null;
        const withBass = slash && lookup(key, slash);
        if (withBass) return withBass;
    }
    return lookup(key, suffix);
}
