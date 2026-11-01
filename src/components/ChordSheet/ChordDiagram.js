import React from 'react';
import styles from './styles.module.css';

const STRINGS = 6;
const FRETS = 4;
const W = 64;
const H = 72;
const LEFT = 10;
const TOP = 16;
const GAP_X = (W - LEFT - 6) / (STRINGS - 1);
const GAP_Y = (H - TOP - 6) / FRETS;

// A guitar chord box: strings left (low E) to right, open strings (o) and muted ones (x)
// above the nut, fingers as dots, barres as bars; `shape` is a chords-db position.
export default function ChordDiagram({name, shape}) {
    const x = (string) => LEFT + string * GAP_X;
    const y = (fret) => TOP + (fret - 0.5) * GAP_Y;
    return (
        <figure className={styles.diagram}>
            <figcaption className={styles.diagramName}>{name}</figcaption>
            {shape ? (
                <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name}: ${shape.frets.map((f) => (f < 0 ? 'x' : f + (f > 0 ? shape.baseFret - 1 : 0))).join(' ')}`}>
                    {shape.baseFret > 1 ? (
                        <text x={LEFT - 3} y={y(1) + 3} className={styles.diagramFret} textAnchor="end">{shape.baseFret}</text>
                    ) : (
                        <rect x={LEFT - 0.5} y={TOP - 2.5} width={x(STRINGS - 1) - LEFT + 1} height={2.5} className={styles.diagramNut} />
                    )}
                    {Array.from({length: FRETS + 1}, (_, f) => (
                        <line key={`f${f}`} x1={LEFT} x2={x(STRINGS - 1)} y1={TOP + f * GAP_Y} y2={TOP + f * GAP_Y} className={styles.diagramLine} />
                    ))}
                    {Array.from({length: STRINGS}, (_, s) => (
                        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + FRETS * GAP_Y} className={styles.diagramLine} />
                    ))}
                    {shape.barres.map((fret) => {
                        const on = shape.frets.map((f, s) => (f === fret ? s : -1)).filter((s) => s >= 0);
                        return (
                            <rect key={`b${fret}`} x={x(on[0]) - 3.2} y={y(fret) - 3.2} width={x(on[on.length - 1]) - x(on[0]) + 6.4}
                                height={6.4} rx={3.2} className={styles.diagramDot} />
                        );
                    })}
                    {shape.frets.map((fret, s) => {
                        if (fret < 0) return <text key={s} x={x(s)} y={TOP - 5} className={styles.diagramMark} textAnchor="middle">×</text>;
                        if (fret === 0) return <circle key={s} cx={x(s)} cy={TOP - 7} r={2.2} className={styles.diagramOpen} />;
                        if (shape.barres.includes(fret)) return null;
                        return <circle key={s} cx={x(s)} cy={y(fret)} r={3.2} className={styles.diagramDot} />;
                    })}
                </svg>
            ) : (
                <div className={styles.diagramMissing}>няма схема</div>
            )}
        </figure>
    );
}
