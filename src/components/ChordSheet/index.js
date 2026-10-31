import React, {useEffect, useMemo, useState} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import {noteNamesFor, transposeChord, transposeProgression} from './transpose';

const SHOW_KEY = 'showChords';
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

function firstChordOf(song) {
    for (const section of song.sections) {
        for (const line of section.lines) {
            const seg = Array.isArray(line) && line.find(([chord]) => chord);
            if (seg) return seg[0];
        }
    }
    return null;
}

// Groups a line into words: each word keeps the chords that sit inside or at the
// start of it, so the browser can wrap between words without a chord drifting
// away from its syllable.
function wordsOf(segments) {
    const words = [];
    let word = [];
    const flush = () => {
        if (word.length) words.push(word);
        word = [];
    };
    segments.forEach(([chord, text]) => {
        // A chord with no lyric under it (line end, between phrases) stays with
        // the previous word instead of wrapping onto a line of its own.
        if (chord && !text.trim() && !word.length && words[words.length - 1] === ' ' && Array.isArray(words[words.length - 2])) {
            words.pop();
            word = words.pop();
            word.push({text: ' '});
        }
        const parts = text.split(/(\s+)/);
        parts.forEach((part, i) => {
            if (/^\s+$/.test(part)) {
                flush();
                words.push(' ');
            } else if (i === 0 && chord) {
                word.push({chord, text: part});
            } else if (part) {
                word.push({text: part});
            }
        });
    });
    flush();
    return words;
}

function LyricLine({segments, renderChord}) {
    if (!renderChord || !segments.some(([chord]) => chord)) {
        return <div className={styles.plainLine}>{segments.map(([, text]) => text).join('')}</div>;
    }
    return (
        <div className={styles.line}>
            {wordsOf(segments).map((word, i) => (word === ' ' ? ' ' : (
                <span key={i} className={styles.word}>
                    {word.map((piece, j) => (piece.chord ? (
                        <span key={j} className={styles.anchor}>
                            <span className={styles.chord}>{renderChord(piece.chord)}</span>
                            <span>{piece.text || '\u00a0'}</span>
                        </span>
                    ) : piece.text))}
                </span>
            )))}
        </div>
    );
}

const isChordOnly = (line) => line.progression || line.every(([, text]) => !text.trim());

// The whole song page: lyrics always (rendered on the server, so search and
// no-JS readers get them), chords and transposition when switched on.
export default function ChordSheet({song}) {
    const [show, setShow] = useState(false);
    const [semitones, setSemitones] = useState(0);
    const firstChord = useMemo(() => firstChordOf(song), [song]);
    const names = noteNamesFor(firstChord, semitones);
    const chordsOn = show && firstChord !== null;
    const renderChord = chordsOn ? (chord) => transposeChord(chord, semitones, names) : null;

    useEffect(() => {
        setShow(readStorage(SHOW_KEY) === '1');
        setSemitones(parseInt(readStorage(transposeKey(song.id)), 10) || 0);
    }, [song.id]);

    const toggle = () => {
        writeStorage(SHOW_KEY, show ? '0' : '1');
        setShow(!show);
    };
    const shift = (delta) => {
        const next = delta === 0 ? 0 : ((semitones + delta + 18) % 12) - 6;
        writeStorage(transposeKey(song.id), next === 0 ? null : String(next));
        setSemitones(next);
    };

    return (
        <div className={styles.chordSheet}>
            {firstChord && (
                <div className={styles.toolbar}>
                    <button
                        type="button"
                        className={clsx('button button--sm', show ? 'button--primary' : 'button--outline button--primary')}
                        aria-pressed={show}
                        onClick={toggle}>
                        🎼 {show ? 'Скрий акордите' : 'Покажи акордите'}
                    </button>
                    {show && (
                        <span className={styles.transpose}>
                            <button type="button" className="button button--sm button--secondary"
                                aria-label="Транспонирай половин тон надолу" onClick={() => shift(-1)}>−</button>
                            <span className={styles.key} title="Тоналност">
                                {renderChord(firstChord)}
                                {semitones !== 0 && ` (${semitones > 0 ? '+' : ''}${semitones})`}
                            </span>
                            <button type="button" className="button button--sm button--secondary"
                                aria-label="Транспонирай половин тон нагоре" onClick={() => shift(1)}>+</button>
                            {semitones !== 0 && (
                                <button type="button" className="button button--sm button--link" onClick={() => shift(0)}>
                                    Оригинал
                                </button>
                            )}
                        </span>
                    )}
                </div>
            )}
            {song.sections.map((section, s) => {
                const lines = chordsOn ? section.lines : section.lines.filter((line) => line === null || !isChordOnly(line));
                // Sections with only chords (an intro) disappear without chords;
                // a heading with no lines at all is a repeat marker and stays.
                if (section.lines.length && !lines.some((line) => line !== null)) return null;
                return (
                    <section key={s} className={clsx(styles.section, /^припев/i.test(section.title) && styles.chorus)}>
                        {section.title && <div className={styles.sectionTitle}>{section.title}</div>}
                        {lines.map((line, i) => {
                            if (line === null) {
                                return i > 0 && lines[i - 1] !== null ? <div key={i} className={styles.stanzaBreak} /> : null;
                            }
                            if (line.progression) {
                                return (
                                    <div key={i} className={styles.progression}>
                                        {transposeProgression(line.progression, semitones, names)}
                                    </div>
                                );
                            }
                            return <LyricLine key={i} segments={line} renderChord={renderChord} />;
                        })}
                    </section>
                );
            })}
        </div>
    );
}
