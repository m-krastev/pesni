import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

// Recordings, the printed score and links of a song: `{meta: melody|unison|score|youtube|source URL}` in its .cho.
export default function SongMedia({melody, unison, score, youtube, source}) {
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
            {(youtube || source) && (
                <div className={styles.links}>
                    {youtube && <a href={youtube} target="_blank" rel="noopener noreferrer">▶ Видео</a>}
                    {source && (
                        <a href={source} target="_blank" rel="noopener noreferrer">
                            Източник: {new URL(source).hostname.replace(/^www\./, '')}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
