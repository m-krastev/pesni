import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

// Recordings and the printed score of a hymn (Песнарка): `{meta: melody|unison|score URL}` in its .cho.
export default function SongMedia({melody, unison, score}) {
    return (
        <div className={clsx(styles.media, 'chordsheet-controls')}>
            {[['Мелодия', melody], ['Едноглас', unison]].filter(([, src]) => src).map(([label, src]) => (
                <div key={label} className={styles.audio}>
                    <span className={styles.label}>{label}</span>
                    <audio controls preload="none" src={src} />
                </div>
            ))}
            {score && (
                <details className={styles.score}>
                    <summary>Ноти</summary>
                    <a href={score} target="_blank" rel="noopener noreferrer">
                        <img src={score} alt="Ноти" loading="lazy" />
                    </a>
                </details>
            )}
        </div>
    );
}
