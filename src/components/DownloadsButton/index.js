import React from 'react';
import styles from './styles.module.css';

function FileIcon() {
    return (
        <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
            <path d="M6 2h8l6 6v14H6zm7 1.5V9h5.5zM9 13h8v1.5H9zm0 3.5h8V18H9z" />
        </svg>
    );
}

// A song's downloads, in the row under the lyrics (`.song-actions`).
export function DownloadsButton({pdf}) {
    return (
        <a href={pdf} target="_blank" rel="noopener" className={styles.action}>
            <FileIcon /> Текст (PDF)
        </a>
    );
}

export function DownloadChordsButton({pdf, label = 'Акорди'}) {
    return (
        <a href={pdf} target="_blank" rel="noopener" className={styles.action}>
            <FileIcon /> {label} (PDF)
        </a>
    );
}
