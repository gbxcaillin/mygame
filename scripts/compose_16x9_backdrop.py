#!/usr/bin/env python3
"""Composes the 16:9 backdrop from the supplied statue art.

Base art: scripts/bg-16x9-source.png — dragon statue with an orange
brazier left, unicorn with a blue brazier right, carved kraken
tentacles along the floor line, blank stone center (generated from
docs/wireframe-16x9.json). Scales to the spec canvas and composites
the interface dressing onto the measured zones: ornamental board
frame, red/blue card sockets, recessed panels behind the topbar and
controls, title glow, and the house hairline frame with gems.

16:9-and-wider always uses the same layout positions, so unlike the
squarish band the baked dressing stays aligned here.

Run from the repo root:  python3 scripts/compose_16x9_backdrop.py
"""

import numpy as np
from PIL import Image, ImageDraw

SRC = "scripts/bg-16x9-source.png"
OUT = "src/assets/bg-landscape.jpg"
W, H = 1920, 1080  # wireframe-16x9.json canvas

GOLD_MID = (215, 148, 37)
GOLD_DEEP = (138, 106, 37)
SAPPHIRE = (7, 83, 186)
SAPPHIRE_GLINT = (191, 227, 243)
EMERALD = (57, 131, 93)
EMERALD_GLINT = (102, 211, 184)
RED_SOCKET = (168, 62, 48)
BLUE_SOCKET = (66, 110, 220)

# measured zones from docs/wireframe-16x9.json
BOARD = (553, 317, 989, 753)
HAND_A = (405, 147, 1137, 305)   # opponent (red)
HAND_B = (405, 765, 1137, 923)   # player (blue)
TOPBAR = (1195, 9, 1515, 117)
BOTTOMBAR = (1195, 711, 1515, 1071)
TITLE_CENTER = (771, 74)
CARD = 140  # live card size at this canvas (no downscale at 16:9)


def draw_gem(d, x, y, r, core, glint):
    m = r * 1.55
    d.polygon([(x, y - m), (x + m * 0.72, y), (x, y + m), (x - m * 0.72, y)],
              fill=(*GOLD_DEEP, 200), outline=(*GOLD_MID, 230))
    d.polygon([(x, y - r), (x + r * 0.66, y), (x, y + r), (x - r * 0.66, y)],
              fill=(*core, 255))
    dark = tuple(int(c * 0.55) for c in core)
    d.polygon([(x, y), (x + r * 0.66, y), (x, y + r)], fill=(*dark, 255))
    d.ellipse([x - r * 0.28 - 1, y - r * 0.55 - 1, x - r * 0.28 + 1, y - r * 0.55 + 1],
              fill=(*glint, 255))


def radial(w, h, cx, cy, rad, color, strength):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / rad
    fall = np.clip(1.0 - d, 0.0, 1.0) ** 2 * strength
    return fall[..., None] * np.array(color, np.float32)


def screen(base, light):
    return 255.0 - (255.0 - base) * (255.0 - light) / 255.0


base = Image.open(SRC).convert("RGB").resize((W, H), Image.LANCZOS)
deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
glow = np.zeros((H, W, 3), np.float32)

# ── ornamental board frame ──
bx0, by0, bx1, by1 = BOARD
for inset, alpha, width in ((16, 110, 3), (9, 55, 1)):
    dd.rectangle([bx0 - inset, by0 - inset, bx1 + inset, by1 + inset],
                 outline=(*GOLD_DEEP, alpha), width=width)
dd.rectangle([bx0 - 16, by0 - 16, bx1 + 16, by1 + 16], fill=(0, 0, 0, 40))
for cx, cy in ((bx0 - 16, by0 - 16), (bx1 + 16, by0 - 16), (bx0 - 16, by1 + 16), (bx1 + 16, by1 + 16)):
    draw_gem(dd, cx, cy, 7, EMERALD, EMERALD_GLINT)
draw_gem(dd, (bx0 + bx1) // 2, by0 - 16, 8, SAPPHIRE, SAPPHIRE_GLINT)
draw_gem(dd, (bx0 + bx1) // 2, by1 + 16, 8, SAPPHIRE, SAPPHIRE_GLINT)

# ── card sockets ──
def socket_row(zone, tone):
    x0, y0, x1, y1 = zone
    gap = (x1 - x0 - 5 * CARD) / 4
    cy1 = y1
    cy0 = cy1 - CARD
    for i in range(5):
        sx = round(x0 + i * (CARD + gap))
        box = [sx, cy0, sx + CARD, cy1]
        dd.rounded_rectangle(box, radius=9, fill=(0, 0, 0, 42))
        dd.rounded_rectangle(box, radius=9, outline=(*tone, 130), width=2)
        dd.rounded_rectangle([box[0] + 4, box[1] + 4, box[2] - 4, box[3] - 4],
                             radius=7, outline=(*tone, 45), width=1)
        draw_gem(dd, sx + CARD // 2, cy0, 5, tone, tuple(min(255, c + 90) for c in tone))
    return (x0 + x1) // 2, (cy0 + cy1) // 2

ca = socket_row(HAND_A, RED_SOCKET)
cb = socket_row(HAND_B, BLUE_SOCKET)
glow += radial(W, H, *ca, 520, (150, 34, 26), 0.13)
glow += radial(W, H, *cb, 520, (30, 70, 190), 0.13)

# ── recessed panels ──
for (x0, y0, x1, y1) in (TOPBAR, BOTTOMBAR):
    dd.rounded_rectangle([x0 - 8, y0 - 6, x1 + 8, y1 + 6], radius=10, fill=(0, 0, 0, 60))
    dd.rounded_rectangle([x0 - 8, y0 - 6, x1 + 8, y1 + 6], radius=10,
                         outline=(*GOLD_DEEP, 100), width=2)
    dd.rounded_rectangle([x0 - 3, y0 - 1, x1 + 3, y1 + 1], radius=7,
                         outline=(*GOLD_MID, 36), width=1)

glow += radial(W, H, *TITLE_CENTER, 340, (108, 74, 26), 0.28)

# ── house frame + gems ──
inset = round(min(W, H) * 0.028)
dd.rectangle([inset, inset, W - inset, H - inset], outline=(*GOLD_DEEP, 120), width=3)
dd.rectangle([inset + 7, inset + 7, W - inset - 7, H - inset - 7], outline=(*GOLD_MID, 60), width=1)
gem_r = 12
draw_gem(dd, W // 2, inset, gem_r, SAPPHIRE, SAPPHIRE_GLINT)
draw_gem(dd, W // 2, H - inset, gem_r, SAPPHIRE, SAPPHIRE_GLINT)
for cx, cy in ((inset, inset), (W - inset, inset), (inset, H - inset), (W - inset, H - inset)):
    draw_gem(dd, cx, cy, round(gem_r * 0.8), EMERALD, EMERALD_GLINT)
glow += radial(W, H, W // 2, inset, 60, SAPPHIRE, 0.5)
glow += radial(W, H, W // 2, H - inset, 60, SAPPHIRE, 0.5)
for cx, cy in ((inset, inset), (W - inset, inset), (inset, H - inset), (W - inset, H - inset)):
    glow += radial(W, H, cx, cy, 50, EMERALD, 0.45)

out = Image.alpha_composite(base.convert("RGBA"), deco).convert("RGB")
out_arr = screen(np.asarray(out, np.float32), np.clip(glow, 0, 255))
Image.fromarray(np.clip(out_arr, 0, 255).astype(np.uint8), "RGB").save(OUT, quality=87, optimize=True)
print(f"wrote {OUT} ({W}x{H})")
