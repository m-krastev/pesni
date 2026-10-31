#!/usr/bin/env python3
import html
import re
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "static" / "chords"
OUT_DIR = ROOT / "static" / "chord-thumbnails"


def sort_key(path):
    match = re.match(r"^(\d+)", path.name)
    return (int(match.group(1)) if match else 99999, path.name.lower())


def render_pdf(pdf_path, zoom=2.0):
    doc = fitz.open(pdf_path)
    outputs = []
    matrix = fitz.Matrix(zoom, zoom)
    base = pdf_path.stem
    for index, page in enumerate(doc, 1):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        out_path = OUT_DIR / f"{base}-p{index:02d}.png"
        pix.save(out_path)
        outputs.append(out_path)
    doc.close()
    return outputs


def write_index(groups):
    cards = []
    for pdf_path, images in groups:
        title = html.escape(pdf_path.stem)
        links = "\n".join(
            f'<a href="{html.escape(img.name)}"><img src="{html.escape(img.name)}" alt="{title} page {i}" loading="lazy"></a>'
            for i, img in enumerate(images, 1)
        )
        pages = "page" if len(images) == 1 else "pages"
        cards.append(f'<section><h2>{title} <small>{len(images)} {pages}</small></h2><div class="pages">{links}</div></section>')

    (OUT_DIR / "index.html").write_text(
        """<!doctype html>
<meta charset="utf-8">
<title>Chord PDF Thumbnails</title>
<style>
body { font-family: system-ui, sans-serif; margin: 24px; background: #f7f7f7; color: #111; }
h1 { margin: 0 0 24px; }
h2 { font-size: 16px; margin: 0 0 8px; }
small { color: #666; font-weight: 400; }
section { margin: 0 0 24px; padding: 12px; background: white; border: 1px solid #ddd; }
.pages { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
img { width: 220px; border: 1px solid #ccc; box-shadow: 0 1px 4px #0002; }
</style>
<h1>Chord PDF Thumbnails</h1>
"""
        + "\n".join(cards)
        + "\n",
        encoding="utf-8",
    )


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.png"):
        old.unlink()

    groups = []
    for pdf_path in sorted(PDF_DIR.glob("*.pdf"), key=sort_key):
        images = render_pdf(pdf_path)
        groups.append((pdf_path, images))
        print(f"{pdf_path.name}: {len(images)} page(s)")

    write_index(groups)
    print(f"wrote {OUT_DIR.relative_to(ROOT)}/index.html")


if __name__ == "__main__":
    main()
