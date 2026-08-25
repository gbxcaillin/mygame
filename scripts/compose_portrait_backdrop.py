#!/usr/bin/env python3
"""Composes the portrait backdrop from the supplied statue art.

Base art: scripts/bg-portrait-source.png — dragon statue coiled on the
left column with an orange brazier, unicorn rearing on the right with
a blue brazier, beast-skull relief on the arch lintel (it hides behind
the title plaque), blank stone center per docs/wireframe-portrait.json.

The source is slightly taller than the 1080x2340 spec canvas, so it is
scaled to width and cropped at the floor. Dressing is composited onto
the measured zones: ornamental board frame with gems, five red card
sockets for the opponent, five blue for the player, recessed panels
behind the topbar and controls, a warm title glow, and the house
hairline frame with sapphire finials and emerald corner gems.

Run from the repo root:  python3 scripts/compose_portrait_backdrop.py
"""

import numpy as np
from PIL import Image, ImageDraw

SRC = "scripts/bg-portrait-source.png"
OUT = "src/assets/bg-portrait.jpg"
W, H = 1080, 2340  # wireframe-portrait.json canvas

GOLD_MID = (215, 148, 37)
GOLD_DEEP = (138, 106, 37)
SAPPHIRE = (7, 83, 186)
SAPPHIRE_GLINT = (191, 227, 243)
EMERALD = (57, 131, 93)
EMERALD_GLINT = (102, 211, 184)
RED_SOCKET = (168, 62, 48)
BLUE_SOCKET = (66, 110, 220)

# measured zones from docs/wireframe-portrait.json
BOARD = (242, 835, 837, 1430)
HAND_A = (39, 566, 1040, 792)     # opponent (red)
HAND_B = (39, 1473, 1040, 1699)   # player (blue)
TOPBAR = (32, 219, 1047, 331)
BOTTOMBAR = (32, 1934, 1047, 2308)
TITLE_CENTER = (540, 115)
CARD = 189  # live card size at this canvas (17.5vw)


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


src = Image.open(SRC).convert("RGB")
scaled = src.resize((W, round(src.height * W / src.width)), Image.LANCZOS)
base = scaled.crop((0, 0, W, H))  # crop the excess at the floor; braziers stay clear

deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
glow = np.zeros((H, W, 3), np.float32)

# ── ornamental board frame (the live gold grid renders inside it) ──
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
def socket_row(zone, tone, label_gap=26):
    x0, y0, x1, y1 = zone
    gap = (x1 - x0 - 5 * CARD) / 4
    cy0 = y0 + label_gap
    cy1 = cy0 + CARD
    for i in range(5):
        sx = round(x0 + i * (CARD + gap))
        box = [sx, cy0, sx + CARD, cy1]
        dd.rounded_rectangle(box, radius=12, fill=(0, 0, 0, 48))
        dd.rounded_rectangle(box, radius=12, outline=(*tone, 150), width=2)
        dd.rounded_rectangle([box[0] + 5, box[1] + 5, box[2] - 5, box[3] - 5],
                             radius=9, outline=(*tone, 55), width=1)
        draw_gem(dd, sx + CARD // 2, cy0, 6, tone, tuple(min(255, c + 90) for c in tone))
    return (x0 + x1) // 2, (cy0 + cy1) // 2

ca = socket_row(HAND_A, RED_SOCKET)
cb = socket_row(HAND_B, BLUE_SOCKET)
glow += radial(W, H, *ca, 620, (150, 34, 26), 0.14)
glow += radial(W, H, *cb, 620, (30, 70, 190), 0.14)

# ── recessed panels behind the topbar and controls ──
for (x0, y0, x1, y1) in (TOPBAR, BOTTOMBAR):
    dd.rounded_rectangle([x0, y0, x1, y1], radius=10, fill=(0, 0, 0, 66))
    dd.rounded_rectangle([x0, y0, x1, y1], radius=10, outline=(*GOLD_DEEP, 110), width=2)
    dd.rounded_rectangle([x0 + 5, y0 + 5, x1 - 5, y1 - 5], radius=7,
                         outline=(*GOLD_MID, 40), width=1)

# warm glow cradling the title plaque
glow += radial(W, H, *TITLE_CENTER, 430, (108, 74, 26), 0.30)

# ── house frame + gems ──
inset = round(W * 0.028)
dd.rectangle([inset, inset, W - inset, H - inset], outline=(*GOLD_DEEP, 120), width=3)
dd.rectangle([inset + 7, inset + 7, W - inset - 7, H - inset - 7], outline=(*GOLD_MID, 60), width=1)
gem_r = 13
draw_gem(dd, W // 2, inset, gem_r, SAPPHIRE, SAPPHIRE_GLINT)
draw_gem(dd, W // 2, H - inset, gem_r, SAPPHIRE, SAPPHIRE_GLINT)
for cx, cy in ((inset, inset), (W - inset, inset), (inset, H - inset), (W - inset, H - inset)):
    draw_gem(dd, cx, cy, round(gem_r * 0.8), EMERALD, EMERALD_GLINT)
glow += radial(W, H, W // 2, inset, 66, SAPPHIRE, 0.5)
glow += radial(W, H, W // 2, H - inset, 66, SAPPHIRE, 0.5)
for cx, cy in ((inset, inset), (W - inset, inset), (inset, H - inset), (W - inset, H - inset)):
    glow += radial(W, H, cx, cy, 55, EMERALD, 0.45)

out = Image.alpha_composite(base.convert("RGBA"), deco).convert("RGB")
out_arr = screen(np.asarray(out, np.float32), np.clip(glow, 0, 255))
Image.fromarray(np.clip(out_arr, 0, 255).astype(np.uint8), "RGB").save(OUT, quality=87, optimize=True)
print(f"wrote {OUT} ({W}x{H})")
