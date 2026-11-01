import React, {useEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import {noteNamesFor, transposeChord} from './transpose';
import {registerSong, useChordState} from './store';
import {chordsIn, loadShapes, shapeOf, shapesLoaded} from './shapes';
import ChordDiagram from './ChordDiagram';

function firstChordOf(song) {
    for (const section of song.sections) {
        for (const line of section.lines) {
            const seg = Array.isArray(line) && line.find(([chord]) => chord);
            if (seg) return seg[0];
        }
    }
    return null;
}

// Chord rows (an intro, `||: [F#m] | [D] :||`) carry no lyrics and are hidden without chords.
// (The same rule as BARS_ONLY in scripts/songs/lib.mjs.)
const BARS_ONLY = /^(?:[\s|:./%()]|[xх×]\s*\d+|\d+\s*[xх×])*$/iu;
const isChordOnly = (line) => Array.isArray(line) && BARS_ONLY.test(line.map(([, text]) => text).join(''));

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

// A chord name in the lyrics: hovering, focusing or tapping it shows its diagram.
function Chord({name}) {
    return <span className={styles.chord} data-chord={name} tabIndex={0}>{name}</span>;
}

function LyricLine({segments, renderChord}) {
    if (renderChord && isChordOnly(segments)) {
        // An intro or interlude: just the chords (and bar lines), no empty lyric row under them.
        return (
            <div className={styles.chordRow}>
                {segments.map(([chord, text], i) => (
                    <React.Fragment key={i}>
                        {chord && <Chord name={renderChord(chord)} />}
                        {text.trim() && <span className={styles.bars}>{text.trim()}</span>}
                    </React.Fragment>
                ))}
            </div>
        );
    }
    if (!renderChord || !segments.some(([chord]) => chord)) {
        return <div className={styles.plainLine}>{segments.map(([, text]) => text).join('')}</div>;
    }
    return (
        <div className={styles.line}>
            {wordsOf(segments).map((word, i) => (word === ' ' ? ' ' : (
                <span key={i} className={styles.word}>
                    {word.map((piece, j) => (piece.chord ? (
                        <span key={j} className={styles.anchor}>
                            <Chord name={renderChord(piece.chord)} />
                            <span>{piece.text || '\u00a0'}</span>
                        </span>
                    ) : piece.text))}
                </span>
            )))}
        </div>
    );
}

const isChorus = (section) => section.kind === 'chorus' || /^припев/i.test(section.title);

// What the left margin shows for a section: the verse number, nothing for a
// chorus (it gets a bar instead), or the section's name (Интро, Мост, Край).
function sectionMarker(section) {
    if (isChorus(section)) return '';
    const verse = /^куплет\s*(\d+)/i.exec(section.title);
    if (verse) return verse[1];
    return section.title;
}

// First lyric line of the section with this title, shown where it is repeated.
function firstLineOf(song, title) {
    const source = song.sections.find((s) => s.title === title && !s.repeat);
    const line = source && source.lines.find((l) => Array.isArray(l) && !isChordOnly(l));
    return line ? line.map(([, text]) => text).join('').replace(/\s+/g, ' ').replace(/[\s,.;:!?–-]+$/, '').trim() : '';
}

// Every chord of the song once, in order of appearance (sequences split up).
function uniqueChords(song, renderChord) {
    const seen = new Set();
    for (const section of song.sections) {
        for (const line of section.lines) {
            if (!Array.isArray(line)) continue;
            for (const [chord] of line) {
                if (chord) chordsIn(renderChord(chord)).forEach((name) => seen.add(name));
            }
        }
    }
    return [...seen];
}

// Diagrams need the shapes database: this loads it and re-renders when it is in.
function useShapes(wanted) {
    const [, setLoaded] = useState(shapesLoaded());
    useEffect(() => {
        if (wanted && !shapesLoaded()) loadShapes().then(() => setLoaded(true));
    }, [wanted]);
    return shapesLoaded();
}

// The diagram of the chord under the pointer (or focused, or tapped), below it.
function useChordPopover(container) {
    const [popover, setPopover] = useState(null);
    const show = (target) => {
        const chord = target && target.closest && target.closest('[data-chord]');
        if (!chord || !container.current) return;
        const box = container.current.getBoundingClientRect();
        const at = chord.getBoundingClientRect();
        if (!shapesLoaded()) loadShapes().then(() => setPopover((current) => current && {...current}));
        setPopover({name: chord.dataset.chord, left: at.left - box.left, top: at.bottom - box.top + 4});
    };
    const hide = (event) => {
        const to = event.relatedTarget;
        if (!to || !to.closest || !to.closest('[data-chord]')) setPopover(null);
    };
    return {
        popover,
        handlers: {
            onMouseOver: (e) => show(e.target),
            onFocus: (e) => show(e.target),
            onClick: (e) => (e.target.closest('[data-chord]') ? show(e.target) : setPopover(null)),
            onMouseOut: hide,
            onBlur: hide,
        },
    };
}

// The whole song page: lyrics always (rendered on the server, so search and
// no-JS readers get them), chords, transposition and diagrams as the chord menu
// beside the breadcrumbs sets them. `preview` (the correction editor) always shows
// the chords as written and leaves the page's settings alone.
export default function ChordSheet({song, preview = false}) {
    const settings = useChordState();
    const firstChord = useMemo(() => firstChordOf(song), [song]);
    const show = preview || settings.show;
    const semitones = preview ? 0 : settings.semitones;
    const names = noteNamesFor(firstChord, semitones);
    const chordsOn = show && firstChord !== null;
    const renderChord = chordsOn ? (chord) => transposeChord(chord, semitones, names) : null;
    const diagramsOn = chordsOn && !preview && settings.diagrams;
    const container = useRef(null);
    const {popover, handlers} = useChordPopover(container);
    const shapes = useShapes(diagramsOn);

    useEffect(() => (preview ? undefined : registerSong({id: song.id, firstChord})), [preview, song.id, firstChord]);

    return (
        <div className={styles.chordSheet} ref={container} {...(chordsOn ? handlers : {})}>
            {song.credits && <div className={styles.credits}>{song.credits}</div>}
            {diagramsOn && shapes && (
                <div className={clsx(styles.diagrams, 'chordsheet-controls')} aria-label="Схеми на акордите">
                    {uniqueChords(song, renderChord).map((name) => (
                        <ChordDiagram key={name} name={name} shape={shapeOf(name)} />
                    ))}
                </div>
            )}
            {chordsOn && popover && shapesLoaded() && (
                <div className={clsx(styles.popover, 'chordsheet-controls')} style={{left: popover.left, top: popover.top}}>
                    {chordsIn(popover.name).map((name) => (
                        <ChordDiagram key={name} name={name} shape={shapeOf(name)} />
                    ))}
                </div>
            )}
            {song.sections.map((section, s) => {
                const lines = chordsOn ? section.lines : section.lines.filter((line) => line === null || !isChordOnly(line));
                // Sections with only chords (an intro) disappear without chords.
                if (section.lines.length && !lines.some((line) => line !== null)) return null;
                const chorus = isChorus(section);
                const marker = sectionMarker(section);
                return (
                    <section
                        key={s}
                        aria-label={section.title || undefined}
                        className={clsx(styles.section, chorus && styles.chorus, chordsOn && styles.withChords)}>
                        <div
                            className={clsx(styles.marker, marker.length > 2 && styles.markerLong, 'chordsheet-label')}
                            title={section.title || undefined}
                            aria-hidden="true">
                            {marker}
                        </div>
                        <div className={styles.body}>
                            {section.repeat ? (
                                <div className={clsx(styles.repeat, 'chordsheet-label')} title={`Повтаря се: ${section.title}`}>
                                    ↻ {firstLineOf(song, section.title) || section.title}…
                                </div>
                            ) : lines.map((line, i) => {
                                if (line === null) {
                                    return i > 0 && lines[i - 1] !== null ? <div key={i} className={styles.stanzaBreak} /> : null;
                                }
                                if (line.comment) {
                                    return <div key={i} className={styles.comment}>({line.comment})</div>;
                                }
                                return <LyricLine key={i} segments={line} renderChord={renderChord} />;
                            })}
                        </div>
                    </section>
                );
            })}
            {song.copyright && <div className={styles.credits}>{song.copyright}</div>}
        </div>
    );
}
