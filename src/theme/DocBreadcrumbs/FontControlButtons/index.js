import React, {useState} from 'react';
import styles from '../styles.module.css';

// Text size, weight and line spacing of the lyrics: CSS variables on :root, kept in
// localStorage and restored before the page paints (the load-font-settings plugin
// in docusaurus.config.js).
const LINE_HEIGHTS = [1.2, 1.5, 2.0];

function rootVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setRootVar(name, storageKey, value) {
    document.documentElement.style.setProperty(name, value);
    try {
        window.localStorage.setItem(storageKey, value);
    } catch (e) {
        // Without storage the setting lasts until the page is left.
    }
}

function changeSize(step) {
    const factor = Math.round((parseFloat(rootVar('--custom-font-factor')) || 1) * 10 + step) / 10;
    if (factor >= 0.8 && factor <= 2.5) setRootVar('--custom-font-factor', 'fontSizeFactor', String(factor));
}

function nextLineHeight() {
    const current = parseFloat(rootVar('--custom-line-height')) || 1.5;
    const next = LINE_HEIGHTS[(LINE_HEIGHTS.indexOf(current) + 1) % LINE_HEIGHTS.length] || 1.5;
    setRootVar('--custom-line-height', 'lineHeight', String(next));
}

export default function FontControlButtons() {
    const [bold, setBold] = useState(() => rootVar('--custom-font-weight') === 'bold');
    const toggleBold = () => {
        setRootVar('--custom-font-weight', 'fontWeight', bold ? 'normal' : 'bold');
        setBold(!bold);
    };
    return (
        <div className={styles.tools} role="group" aria-label="Текст">
            <button type="button" className={styles.tool} onClick={() => changeSize(-1)} title="По-малък текст" aria-label="По-малък текст">
                <span className={styles.smallA}>A</span>
            </button>
            <button type="button" className={styles.tool} onClick={() => changeSize(1)} title="По-голям текст" aria-label="По-голям текст">
                <span className={styles.bigA}>A</span>
            </button>
            <button type="button" className={styles.tool} onClick={toggleBold} aria-pressed={bold} title="Удебелен текст" aria-label="Удебелен текст">
                <b>B</b>
            </button>
            <button type="button" className={styles.tool} onClick={nextLineHeight} title="Разстояние между редовете" aria-label="Разстояние между редовете">
                <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                    <path d="M6 3 2.5 6.5h2.5v11H2.5L6 21l3.5-3.5H7v-11h2.5zM12 5h10v2H12zm0 6h10v2H12zm0 6h10v2H12z" />
                </svg>
            </button>
        </div>
    );
}
