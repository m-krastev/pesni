// Renders one song as a standalone chord sheet (scripts/build-songs.mjs does this for every song):
//   typst compile --root . --input song=generated/001-mir-kato-reka.typ typ/single.typ out.pdf
#import "style.typ": songbook
#import sys.inputs.song: song

#set document(title: "Акорди", date: none)
#show: songbook

#song
