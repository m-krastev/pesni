import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

// The site's color palettes (src/css/palettes.css); '' is the default blue one.
// The swatches show the main color, the chord color and the page background.
export const PALETTES = [
    {id: '', label: 'Синьо', swatch: ['#24508a', '#b0412e', '#fcfbf8']},
    {id: 'green', label: 'Зелено', swatch: ['#2e7d4f', '#b0412e', '#fcfbf8']},
    {id: 'burgundy', label: 'Бордо', swatch: ['#8a2a3b', '#1f5f8b', '#fcfbf8']},
    {id: 'sepia', label: 'Сепия', swatch: ['#8a5a2b', '#a33a1f', '#f5eedf']},
    {id: 'contrast', label: 'Контраст', swatch: ['#0037a5', '#c00000', '#ffffff']},
];

function currentPalette() {
    return typeof document === 'undefined' ? '' : document.documentElement.dataset.palette || '';
}

function applyPalette(id) {
    if (id) document.documentElement.dataset.palette = id;
    else delete document.documentElement.dataset.palette;
    try {
        if (id) window.localStorage.setItem('palette', id);
        else window.localStorage.removeItem('palette');
    } catch (e) {
        // Without storage the palette lasts until the page is left.
    }
}

// A navbar item (type 'custom-paletteMenu'): a button that opens the list of palettes.
export default function PaletteMenu({mobile}) {
    const [open, setOpen] = useState(false);
    const [palette, setPalette] = useState('');
    const root = useRef(null);

    useEffect(() => setPalette(currentPalette()), []);
    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            if (event.type === 'keydown' ? event.key === 'Escape' : !root.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open]);

    const choose = (id) => {
        applyPalette(id);
        setPalette(id);
    };

    const list = (
        <ul className={styles.list} role="listbox" aria-label="Цветове">
            {PALETTES.map(({id, label, swatch}) => (
                <li key={id || 'default'}>
                    <button type="button" role="option" aria-selected={palette === id}
                        className={clsx(styles.option, palette === id && styles.selected)} onClick={() => choose(id)}>
                        <span className={styles.swatch} style={{background: swatch[2]}} aria-hidden="true">
                            <span style={{background: swatch[0]}} />
                            <span style={{background: swatch[1]}} />
                        </span>
                        {label}
                    </button>
                </li>
            ))}
        </ul>
    );

    if (mobile) {
        return (
            <li className={clsx('menu__list-item', styles.mobile)}>
                <div className={styles.mobileTitle}>Цветове</div>
                {list}
            </li>
        );
    }
    return (
        <div className={clsx('navbar__item', styles.menu)} ref={root}>
            <button type="button" className={styles.trigger} onClick={() => setOpen(!open)} aria-expanded={open}
                aria-haspopup="listbox" title="Цветове" aria-label="Цветове">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3m-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3" />
                </svg>
            </button>
            {open && <div className={styles.popup}>{list}</div>}
        </div>
    );
}
