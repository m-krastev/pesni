// The whole songbook, one song per page. Run `npm run songs` first so typ/generated is current:
//   typst compile --root . typ/all.typ songbook.pdf
#import "style.typ": songbook
#import "generated/songs.typ": songs

#set document(title: "Песни", date: none)
#show: songbook

#for (i, s) in songs.enumerate() {
  if i > 0 { pagebreak() }
  s.song
}
