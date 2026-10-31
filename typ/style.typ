// Shared look of the printed chord sheets (typ/single.typ, typ/all.typ).
#import "@preview/conchord:0.4.0": chordify, overchord

#let och = overchord.with(styling: it => text(it, fill: maroon, weight: "bold"))

#let songbook(body) = {
  set page(paper: "a4", margin: 3em)
  set text(size: 16pt, weight: "bold", lang: "bg")
  show heading.where(level: 1): it => stack(spacing: 1%, text(it), line(length: 100%, stroke: 2pt))
  // Whitespace-only raw text between chord tokens (`   `) becomes a real gap so chords don't overlap.
  show raw.where(block: false): it => if it.text.trim() == "" {
    box(width: calc.min(calc.max(1, it.text.len()), 4) * 1.1em)
  } else { it }
  show: chordify.with(line-chord: och)
  body
}
