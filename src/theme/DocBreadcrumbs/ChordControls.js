import React from 'react';
import {useChordState, toggleChords, toggleDiagrams, transposeBy} from '@site/src/components/ChordSheet/store';
import {noteNamesFor, transposeChord} from '@site/src/components/ChordSheet/transpose';
import styles from './styles.module.css';

// The chord menu of a song page: chords on/off, key and transposition, diagrams.
// Shown only on songs that have chords (<ChordSheet> registers the song).
export default function ChordControls() {
    const {song, show, diagrams, semitones} = useChordState();
    if (!song || !song.firstChord) return null;
    const key = transposeChord(song.firstChord, semitones, noteNamesFor(song.firstChord, semitones));
    return (
        <div className={styles.tools} role="group" aria-label="Акорди">
            <button type="button" className={styles.tool} onClick={toggleChords} aria-pressed={show}
                title={show ? 'Скрий акордите' : 'Покажи акордите'}>
                <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                    <path d="M9 3v10.6A3.5 3.5 0 1 0 11 17V7h8v6.6a3.5 3.5 0 1 0 2 3.4V3z" />
                </svg>
                <span className={styles.toolLabel}>Акорди</span>
            </button>
            {show && (
                <>
                    <span className={styles.divider} />
                    <button type="button" className={styles.tool} onClick={() => transposeBy(-1)}
                        title="Половин тон надолу" aria-label="Транспонирай половин тон надолу">−</button>
                    <span className={styles.key} title={semitones ? `Тоналност (${semitones > 0 ? '+' : ''}${semitones})` : 'Тоналност'}>
                        {key}
                        {semitones !== 0 && <sup>{semitones > 0 ? `+${semitones}` : semitones}</sup>}
                    </span>
                    <button type="button" className={styles.tool} onClick={() => transposeBy(1)}
                        title="Половин тон нагоре" aria-label="Транспонирай половин тон нагоре">+</button>
                    {semitones !== 0 && (
                        <button type="button" className={styles.tool} onClick={() => transposeBy(0)}
                            title="Оригиналната тоналност" aria-label="Оригиналната тоналност">↺</button>
                    )}
                    <span className={styles.divider} />
                    <button type="button" className={styles.tool} onClick={toggleDiagrams} aria-pressed={diagrams}
                        title={diagrams ? 'Скрий схемите' : 'Покажи схемите на акордите'}>
                        <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                            <path d="M5 3h14v2H5zm0 2h2v16H5zm4 0h2v16H9zm4 0h2v16h-2zm4 0h2v16h-2zM5 9h14v1.5H5zm0 5h14v1.5H5z" />
                            <circle cx="10" cy="12" r="2.2" />
                            <circle cx="14" cy="7" r="2.2" />
                        </svg>
                        <span className={styles.toolLabel}>Схеми</span>
                    </button>
                </>
            )}
        </div>
    );
}
