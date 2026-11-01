#!/usr/bin/env python3
"""Scrape https://spodelenohvalenie.com/songs into spodeleno/.

Writes one Markdown file per song (spodeleno/NNNN.md), the raw API data
(spodeleno/songs.json), and downloads chord sheets into spodeleno/chords/.
Song numbers are kept stable across runs via spodeleno/index.json; new songs
get the next free number.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "spodeleno"
CHORDS_DIR = OUT_DIR / "chords"
INDEX_PATH = OUT_DIR / "index.json"
DATA_PATH = OUT_DIR / "songs.json"

API = "https://europe-west3-share-worship.cloudfunctions.net"
SITE = "https://spodelenohvalenie.com/songs/"
CHORD_EXTS = {".pdf", ".docx", ".doc"}
CHORUS_RE = re.compile(r"^(припев|рефрен|рефрейн)", re.I)

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n",
    "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f",
    "х": "h", "ц": "tz", "ч": "ch", "ш": "sh", "щ": "sht", "ъ": "y", "ь": "y",
    "ю": "yu", "я": "q",
}


def get_json(url, params):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"{url}?{urllib.parse.urlencode(params)}", timeout=30) as resp:
                return json.load(resp)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def list_songs():
    songs, after = [], None
    while True:
        params = {"sorting": "timestamp", "dir": "desc", "limit": "100"}
        if after:
            params["after"] = after
        batch = get_json(f"{API}/searchSongs", params).get("songs") or []
        songs += batch
        if len(batch) < 100:
            return songs
        after = batch[-1]["id"]


def fetch_song(song_id):
    song = get_json(f"{API}/getSongByID", {"songID": song_id})["song"]
    time.sleep(0.2)
    return song


def slugify(title):
    text = "".join(TRANSLIT.get(ch, ch) for ch in title.lower())
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "song"


def parse_parts(text):
    # Mirrors the site's generateSongParts(): sections are "Title>...<Title>...",
    # rows are separated by a literal backslash-n, chords sit in {Акорди}...{/Акорди}.
    parts = []
    for chunk in text.split("<"):
        title = chunk[: chunk.find(">")].strip() if ">" in chunk else ""
        body = chunk[chunk.find(">") + 1:] if ">" in chunk else chunk
        chords = []
        match = re.search(r"\{Акорди\}(.*?)\{/Акорди\}", body, re.S)
        if match:
            chords = [row.strip() for row in match.group(1).strip().split("\\n") if row.strip()]
            body = body[body.rfind("}") + 1:]
        rows = [re.sub(r"\s+", " ", row).strip() for row in body.strip().split("\\n")] if body.strip() else []
        parts.append({"title": title, "chords": chords, "rows": rows})
    return parts


def escape_line(line):
    if re.match(r"^([-*+#]|\d+[.)])", line):
        return "\\" + line
    return line


def clean_title(title):
    # Hymns on the site already carry their hymnbook number, e.g. "686. За Теб на кръст пострада".
    return re.sub(r"^\d+\.\s*", "", title.strip())


def render_markdown(number, song, chords_file):
    meta = {
        "id": song["id"],
        "number": number,
        "title": clean_title(song.get("bulgarianTitle", "")),
        "author": song.get("bulgarianAuthor", ""),
        "original_title": song.get("englishTitle", ""),
        "original_author": song.get("englishAuthor", ""),
        "youtube": song.get("bulgarianYoutubeLink", ""),
        "original_youtube": song.get("englishYoutubeLink", ""),
        "chords_file": chords_file or "",
        "source": SITE + song["id"],
        "updated": song.get("timestamp", ""),
    }
    lines = ["---"]
    lines += [f"{key}: {json.dumps(value, ensure_ascii=False)}" for key, value in meta.items() if value != ""]
    lines += ["---", f"# {number}. {clean_title(song['bulgarianTitle'])}  ", "  "]
    for part in parse_parts(song.get("text", "")):
        quote = "> " if CHORUS_RE.match(part["title"]) else ""
        block = []
        if part["title"]:
            block.append(f"**{part['title']}**")
        block += [f"`{row}`" for row in part["chords"]]
        block += [escape_line(row) if row else "" for row in part["rows"]]
        lines += [f"{quote}{row}  " if row else quote.rstrip() for row in block]
        lines.append("  ")
    return "\n".join(lines).rstrip() + "\n"


def download(url, path):
    if path.exists():
        return
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                path.write_bytes(resp.read())
            return
        except Exception:
            if attempt == 3:
                print(f"failed to download {url}", file=sys.stderr)
                return
            time.sleep(2 * (attempt + 1))


def main():
    OUT_DIR.mkdir(exist_ok=True)
    CHORDS_DIR.mkdir(exist_ok=True)
    index = json.loads(INDEX_PATH.read_text()) if INDEX_PATH.exists() else {}

    listed = list_songs()
    print(f"{len(listed)} songs listed")
    with ThreadPoolExecutor(4) as pool:
        songs = list(pool.map(fetch_song, [s["id"] for s in listed]))

    next_number = max(index.values(), default=0) + 1
    for song in sorted(songs, key=lambda s: s.get("timestamp", "")):
        if song["id"] not in index:
            index[song["id"]] = next_number
            next_number += 1
    songs.sort(key=lambda s: index[s["id"]])

    jobs = []
    for song in songs:
        number = index[song["id"]]
        name = f"{number:04d}-{slugify(clean_title(song['bulgarianTitle']))}"
        chords_url = song.get("downloadBulgarianChordsUrl") or ""
        ext = Path(urllib.parse.unquote(chords_url.split("?")[0])).suffix.lower()
        chords_file = f"chords/{name}_akord{ext}" if ext in CHORD_EXTS else None
        if chords_file:
            jobs.append((chords_url, OUT_DIR / chords_file))
        (OUT_DIR / f"{number:04d}.md").write_text(render_markdown(number, song, chords_file))

    with ThreadPoolExecutor(4) as pool:
        list(pool.map(lambda job: download(*job), jobs))

    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n")
    DATA_PATH.write_text(json.dumps(songs, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(songs)} songs, {len(jobs)} chord files")


if __name__ == "__main__":
    main()
