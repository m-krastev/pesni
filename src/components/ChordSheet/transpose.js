const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX = {
    C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, H: 11,
};
// Keys that are conventionally written with flats.
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]);
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]);
const CHORD_RE = /^([A-H][#b]?)([^/]*)(?:\/([A-H][#b]?))?$/;

function shiftNote(note, semitones, names) {
    return names[(NOTE_INDEX[note] + semitones + 120) % 12];
}

export function parseChord(chord) {
    const match = CHORD_RE.exec(chord);
    return match && {root: match[1], quality: match[2], bass: match[3]};
}

// Note names to use for a song whose first chord is `firstChord`, after shifting.
export function noteNamesFor(firstChord, semitones) {
    const parsed = firstChord && parseChord(firstChord);
    if (!parsed) return SHARPS;
    const key = (NOTE_INDEX[parsed.root] + semitones + 120) % 12;
    const minor = /^m(?!aj)/.test(parsed.quality);
    return (minor ? FLAT_MINOR : FLAT_MAJOR).has(key) ? FLATS : SHARPS;
}

export function transposeChord(chord, semitones, names) {
    if (semitones % 12 === 0) return chord;
    const parsed = parseChord(chord);
    if (!parsed) {
        // A sequence on one syllable, written `D/Em` or `Em/D/C` on the old sheets.
        const parts = chord.split('/');
        return parts.length > 1 && parts.every(parseChord)
            ? parts.map((part) => transposeChord(part, semitones, names)).join('/')
            : chord;
    }
    const bass = parsed.bass ? '/' + shiftNote(parsed.bass, semitones, names) : '';
    return shiftNote(parsed.root, semitones, names) + parsed.quality + bass;
}
