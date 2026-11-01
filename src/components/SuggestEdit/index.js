import React, {useEffect, useMemo, useState} from 'react';
import clsx from 'clsx';
import ChordSheet from '@site/src/components/ChordSheet';
import styles from './styles.module.css';

// static/api/suggest.php: saves a suggestion for review on /api/suggestions.php.
const ENDPOINT = '/api/suggest.php';

// "Предложи корекция" under a song: the song's ChordPro source in an editor, a
// live preview drawn by the same parser as the build, and a form that sends the
// edited text for review. Nothing changes on the site until the suggestion is merged.
export default function SuggestEdit({file}) {
    const [open, setOpen] = useState(false);
    const [original, setOriginal] = useState(null);
    const [lib, setLib] = useState(null);
    const [text, setText] = useState('');
    const [name, setName] = useState('');
    const [note, setNote] = useState('');
    const [website, setWebsite] = useState('');
    const [status, setStatus] = useState({state: 'idle'});

    useEffect(() => {
        if (!open || original !== null) return;
        setStatus({state: 'loading'});
        Promise.all([
            fetch(`/cho/${file}`).then((r) => {
                if (!r.ok) throw new Error(r.statusText);
                return r.text();
            }),
            // The parser (with ChordSheetJS) loads only when someone opens the editor.
            import('@site/scripts/songs/lib.mjs'),
        ]).then(([source, mod]) => {
            setOriginal(source);
            setText(source);
            setLib(mod);
            setStatus({state: 'idle'});
        }).catch(() => setStatus({state: 'error', message: 'Текстът на песента не можа да се зареди.'}));
    }, [open, original, file]);

    const preview = useMemo(() => {
        if (!lib) return null;
        try {
            const song = lib.parseSong(text);
            return {song: {id: 'preview', credits: lib.credits(song.meta), copyright: song.meta.copyright || '', sections: song.sections}};
        } catch (e) {
            return {error: e.message};
        }
    }, [lib, text]);

    const changed = original !== null && text !== original;
    const sending = status.state === 'sending';

    const submit = (event) => {
        event.preventDefault();
        setStatus({state: 'sending'});
        fetch(ENDPOINT, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file, text, original, name, note, website}),
        })
            .then((r) => r.json().catch(() => ({})).then((body) => ({ok: r.ok, body})))
            .then(({ok, body}) => setStatus(ok
                ? {state: 'sent'}
                : {state: 'error', message: body.error || 'Предложението не можа да се изпрати.'}))
            .catch(() => setStatus({state: 'error', message: 'Няма връзка със сървъра. Опитайте пак по-късно.'}));
    };

    if (!open) {
        return (
            <button type="button" className={clsx(styles.trigger, 'chordsheet-controls')} onClick={() => setOpen(true)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.3V20h2.7l8-8L12 9.3zM19.7 7a1 1 0 0 0 0-1.4L18.4 4.3a1 1 0 0 0-1.4 0l-1.6 1.6L18.1 8.6z" /></svg>
                Предложи корекция
            </button>
        );
    }

    if (status.state === 'sent') {
        return (
            <div className={clsx(styles.suggest, styles.panel, 'chordsheet-controls')}>
                <p>Благодарим! Предложението е изпратено и ще бъде прегледано преди да се появи на сайта.</p>
            </div>
        );
    }

    return (
        <form className={clsx(styles.suggest, styles.panel, 'chordsheet-controls')} onSubmit={submit}>
            <h2 className={styles.heading}>Предложи корекция</h2>
            <p className={styles.help}>
                Поправете текста или акордите. Акордът стои в квадратни скоби точно преди сричката, на която се
                свири: <code>[G]Мир като [D]река</code>. Редовете с <code>#</code> са бележки, <code>{'{...}'}</code>{' '}
                отбелязва куплети и припеви. Отдолу виждате как ще изглежда песента.
            </p>
            {original === null ? (
                <p>{status.state === 'error' ? status.message : 'Зареждане…'}</p>
            ) : (
                <>
                    <textarea
                        className={styles.source}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        spellCheck={false}
                        rows={Math.min(30, Math.max(12, text.split('\n').length + 1))}
                        aria-label="Текст на песента (ChordPro)"
                    />
                    <div className={styles.preview} aria-live="polite">
                        <div className={styles.previewLabel}>Преглед</div>
                        {preview && preview.error
                            ? <p className={styles.error}>Грешка: {preview.error}</p>
                            : preview && <ChordSheet song={preview.song} preview />}
                    </div>
                    <label className={styles.field}>
                        Какво поправихте? (по желание)
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} />
                    </label>
                    <label className={styles.field}>
                        Име (по желание)
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                    </label>
                    {/* Hidden from people; bots fill it in and are ignored. */}
                    <label className={styles.trap} aria-hidden="true">
                        Website
                        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </label>
                    {status.state === 'error' && <p className={styles.error}>{status.message}</p>}
                    <div className={styles.actions}>
                        <button type="submit" className="button button--primary"
                            disabled={!changed || sending || !preview || Boolean(preview.error)}>
                            {sending ? 'Изпращане…' : 'Изпрати предложението'}
                        </button>
                        <button type="button" className="button button--secondary" onClick={() => setText(original)} disabled={!changed || sending}>
                            Върни оригинала
                        </button>
                        <button type="button" className="button button--link" onClick={() => setOpen(false)} disabled={sending}>
                            Затвори
                        </button>
                    </div>
                </>
            )}
        </form>
    );
}
