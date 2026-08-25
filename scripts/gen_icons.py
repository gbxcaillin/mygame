#!/usr/bin/env python3
"""Generates the PWA app icons (public/icons/) from the gold crown coin.

The crown coin is the game's signature emblem (it opens every match), and
it reads clearly at home-screen sizes where the full title banner would
not. Icons are composed on a dark arcane radial gradient matching the
game's gold-on-black look.

Run from the repo root:  python3 scripts/gen_icons.py
"""

import os

from PIL import Image, ImageDraw

COIN = "src/assets/coin-crown.png"
OUT_DIR = "public/icons"

BASE = 1024  # master canvas, downsampled per size


def dark_background(size: int) -> Image.Image:
    """Deep purple-black radial gradient with a faint gold vignette ring."""
    small = 128
    img = Image.new("RGB", (small, small))
    cx = cy = (small - 1) / 2
    max_d = (2 * cx * cx) ** 0.5
    inner = (26, 16, 40)   # arcane purple
    outer = (5, 3, 10)     # near black
    px = img.load()
    for y in range(small):
        for x in range(small):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / max_d
            px[x, y] = tuple(int(i + (o - i) * d) for i, o in zip(inner, outer))
    return img.resize((size, size), Image.BICUBIC)


def compose(coin_scale: float) -> Image.Image:
    """Coin centered on the dark backdrop at the given fraction of width."""
    canvas = dark_background(BASE).convert("RGBA")
    coin = Image.open(COIN).convert("RGBA")
    side = int(BASE * coin_scale)
    coin = coin.resize((side, side), Image.LANCZOS)
    # soft gold halo behind the coin so it pops on the dark ground
    halo = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    d = ImageDraw.Draw(halo)
    for r, alpha in ((int(side * 0.56), 26), (int(side * 0.52), 36)):
        d.ellipse([BASE // 2 - r, BASE // 2 - r, BASE // 2 + r, BASE // 2 + r],
                  fill=(212, 168, 67, alpha))
    canvas = Image.alpha_composite(canvas, halo)
    off = (BASE - side) // 2
    canvas.alpha_composite(coin, (off, off))
    return canvas


def save(img: Image.Image, size: int, name: str, opaque: bool = False) -> None:
    out = img.resize((size, size), Image.LANCZOS)
    if opaque:
        out = out.convert("RGB")
    path = os.path.join(OUT_DIR, name)
    out.save(path, optimize=True)
    print(f"wrote {path} ({size}x{size})")


os.makedirs(OUT_DIR, exist_ok=True)

standard = compose(coin_scale=0.84)
save(standard, 512, "icon-512.png", opaque=True)
save(standard, 192, "icon-192.png", opaque=True)
save(standard, 180, "icon-180.png", opaque=True)  # apple-touch-icon

# maskable: extra padding so circular/squircle masks never crop the coin
maskable = compose(coin_scale=0.62)
save(maskable, 512, "icon-maskable-512.png", opaque=True)
