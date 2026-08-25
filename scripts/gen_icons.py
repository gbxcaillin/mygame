#!/usr/bin/env python3
"""Generates the PWA app icons (public/icons/) and favicon from the
Court of Beasts plaque art (scripts/icon-source.png — square gold frame
with gems on dark stone).

The master is used full-bleed for the standard icons; the maskable
variant scales the art down onto a matching dark ground so circular /
squircle launcher masks never crop the frame corners.

Run from the repo root:  python3 scripts/gen_icons.py
"""

import os

from PIL import Image

SOURCE = "scripts/icon-source.png"
OUT_DIR = "public/icons"
BG = (8, 8, 10)  # matches the master's near-black surround

master = Image.open(SOURCE).convert("RGB")


def save(img: Image.Image, size: int, path: str) -> None:
    out = img.resize((size, size), Image.LANCZOS)
    out.save(path, optimize=True)
    print(f"wrote {path} ({size}x{size})")


os.makedirs(OUT_DIR, exist_ok=True)

save(master, 512, f"{OUT_DIR}/icon-512.png")
save(master, 192, f"{OUT_DIR}/icon-192.png")
save(master, 180, f"{OUT_DIR}/icon-180.png")  # apple-touch-icon

# maskable: art at 78% centered, so the frame survives the ~80% safe zone
side = master.width
inner = int(side * 0.78)
maskable = Image.new("RGB", (side, side), BG)
maskable.paste(master.resize((inner, inner), Image.LANCZOS), ((side - inner) // 2,) * 2)
save(maskable, 512, f"{OUT_DIR}/icon-maskable-512.png")

# browser tab favicon
save(master, 128, "public/favicon.png")
