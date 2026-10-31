// Renders one song's lyrics (no chords), as the "Текст" PDF on the website:
//   typst compile --root . --input song=generated/001-mir-kato-reka.typ typ/lyrics.typ out.pdf
#import "style.typ": songbook
#import sys.inputs.song: lyrics

#set document(title: "Текст", date: none)
#show: songbook
#set text(size: 20pt)

#lyrics
