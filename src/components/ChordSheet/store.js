import {useSyncExternalStore} from 'react';

// Chord settings of the song on the page, shared by <ChordSheet> (which registers
// the song) and the chord menu beside the breadcrumbs (src/theme/DocBreadcrumbs).
// Showing chords and diagrams is remembered for every song, the transposition per song.
const SHOW_KEY = 'showChords';
const DIAGRAMS_KEY = 'chordDiagrams';
const transposeKey = (id) => `transpose:${id}`;

function readStorage(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch (e) {
        // Storage can be unavailable (private mode); the controls still work for this page.
    }
}

const INITIAL = {song: null, show: false, diagrams: false, semitones: 0};
let state = INITIAL;
const listeners = new Set();

function update(patch) {
    state = {...state, ...patch};
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useChordState() {
    return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

/** Makes `song` ({id, firstChord}) the page's song; returns the function that unregisters it. */
export function registerSong(song) {
    update({
        song,
        show: readStorage(SHOW_KEY) === '1',
        diagrams: readStorage(DIAGRAMS_KEY) === '1',
        semitones: parseInt(readStorage(transposeKey(song.id)), 10) || 0,
    });
    return () => {
        if (state.song && state.song.id === song.id) update({song: null});
    };
}

export function toggleChords() {
    writeStorage(SHOW_KEY, state.show ? '0' : '1');
    update({show: !state.show});
}

export function toggleDiagrams() {
    writeStorage(DIAGRAMS_KEY, state.diagrams ? '0' : '1');
    update({diagrams: !state.diagrams});
}

/** Transposes by `delta` semitones (0 goes back to the original key), within -6..+5. */
export function transposeBy(delta) {
    if (!state.song) return;
    const next = delta === 0 ? 0 : ((state.semitones + delta + 18) % 12) - 6;
    writeStorage(transposeKey(state.song.id), next === 0 ? null : String(next));
    update({semitones: next});
}
