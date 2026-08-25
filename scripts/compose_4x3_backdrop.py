#!/usr/bin/env python3
"""Composes the 4:3 backdrop from the supplied vault painting.

Base art: scripts/bg-4x3-source.png — dragon statue with an orange
brazier on the left, unicorn statue with a blue brazier on the right,
blank stone center (generated from docs/wireframe-4x3.json). This
script scales it to the spec canvas and composites the interface
dressing onto the measured zones: ornamental board frame, five red
card sockets for the opponent, five blue for the player, recessed
panels behind the topbar and controls, a warm title glow, and the
house hairline frame with sapphire finials and emerald corner gems.

Note: this art also serves the squarish 0.7–1.1 aspect band where the
UI sits elsewhere and cover-fit crops the sides, so all dressing is
kept low-alpha — aligned ornament at true 4:3, quiet decor elsewhere.

Run from the repo root:  python3 scripts/compose_4x3_backdrop.py
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = "scripts/bg-4x3-source.png"
OUT = "src/assets/bg-4x3.jpg"
W, H = 1440, 1080  # wireframe-4x3.json canvas

GOLD_MID = (215, 148, 37)
GOLD_DEEP = (138, 106, 37)
SAPPHIRE = (7, 83, 186)
SAPPHIRE_GLINT = (191, 227, 243)
EMERALD = (57, 131, 93)
EMERALD_GLINT = (102, 211, 184)
RED_SOCKET = (168, 62, 48)
BLUE_SOCKET = (66, 110, 220)

# measured zones from docs/wireframe-4x3.json
BOARD = (360, 285, 753, 678)
HAND_A = (227, 132, 886, 275)   # opponent (red)
HAND_B = (227, 689, 886, 832)   # player (blue)
TOPBAR = (925, 8, 1213, 105)
BOTTOMBAR = (925, 640, 1213, 964)
TITLE_CENTER = (556, 66)
CARD = 126  # live card size at this canvas (includes the 0.9 app scale)


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
def socket_row(zone, tone):
    x0, y0, x1, y1 = zone
    gap = (x1 - x0 - 5 * CARD) / 4
    cy1 = y1  # cards sit at the bottom of the shell (label above)
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
glow += radial(W, H, *ca, 480, (150, 34, 26), 0.13)
glow += radial(W, H, *cb, 480, (30, 70, 190), 0.13)

# ── recessed panels behind the topbar and controls ──
for (x0, y0, x1, y1) in (TOPBAR, BOTTOMBAR):
    dd.rounded_rectangle([x0 - 8, y0 - 6, x1 + 8, y1 + 6], radius=10, fill=(0, 0, 0, 60))
    dd.rounded_rectangle([x0 - 8, y0 - 6, x1 + 8, y1 + 6], radius=10,
                         outline=(*GOLD_DEEP, 100), width=2)
    dd.rounded_rectangle([x0 - 3, y0 - 1, x1 + 3, y1 + 1], radius=7,
                         outline=(*GOLD_MID, 36), width=1)

# warm glow cradling the title
glow += radial(W, H, *TITLE_CENTER, 320, (108, 74, 26), 0.28)

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

# ── squarish variant (bg-square.jpg, aspect 0.7–1.1 band) ─────────────
# The UI moves around in that band, so baked sockets/panels would ghost;
# and a plain center-crop of the 4:3 art would slice the statues off.
# Instead: keep both statue columns and re-join them across a narrower
# canvas with synthesized blank wall, then add only the house frame.
SQ_W, SQ_H = 970, 1080
STRIP = 346          # statue column width taken from each side
FADE = 44
arr = np.asarray(base, np.float32)
left = arr[:, :STRIP]
right = arr[:, W - STRIP:]
mid_w = SQ_W - 2 * STRIP
mid = np.asarray(
    Image.fromarray(arr[:, 620:620 + mid_w].astype(np.uint8), "RGB"), np.float32)

sq = np.zeros((SQ_H, SQ_W, 3), np.float32)
sq[:, :STRIP] = left
sq[:, STRIP:STRIP + mid_w] = mid
sq[:, SQ_W - STRIP:] = right
for seam in (STRIP, SQ_W - STRIP):
    band = np.linspace(0.0, 1.0, FADE)[None, :, None]
    seg = sq[:, seam - FADE // 2: seam + FADE // 2]
    blur = np.asarray(
        Image.fromarray(seg.astype(np.uint8), "RGB").filter(ImageFilter.GaussianBlur(7)),
        np.float32)
    sq[:, seam - FADE // 2: seam + FADE // 2] = seg * 0.35 + blur * 0.65

sq_deco = Image.new("RGBA", (SQ_W, SQ_H), (0, 0, 0, 0))
sd = ImageDraw.Draw(sq_deco)
sq_glow = np.zeros((SQ_H, SQ_W, 3), np.float32)
inset = round(min(SQ_W, SQ_H) * 0.028)
sd.rectangle([inset, inset, SQ_W - inset, SQ_H - inset], outline=(*GOLD_DEEP, 120), width=3)
sd.rectangle([inset + 7, inset + 7, SQ_W - inset - 7, SQ_H - inset - 7],
             outline=(*GOLD_MID, 60), width=1)
draw_gem(sd, SQ_W // 2, inset, 11, SAPPHIRE, SAPPHIRE_GLINT)
draw_gem(sd, SQ_W // 2, SQ_H - inset, 11, SAPPHIRE, SAPPHIRE_GLINT)
for cx, cy in ((inset, inset), (SQ_W - inset, inset), (inset, SQ_H - inset), (SQ_W - inset, SQ_H - inset)):
    draw_gem(sd, cx, cy, 9, EMERALD, EMERALD_GLINT)
    sq_glow += radial(SQ_W, SQ_H, cx, cy, 46, EMERALD, 0.45)
sq_glow += radial(SQ_W, SQ_H, SQ_W // 2, inset, 56, SAPPHIRE, 0.5)
sq_glow += radial(SQ_W, SQ_H, SQ_W // 2, SQ_H - inset, 56, SAPPHIRE, 0.5)

sq_out = Image.alpha_composite(
    Image.fromarray(np.clip(sq, 0, 255).astype(np.uint8), "RGB").convert("RGBA"), sq_deco
).convert("RGB")
sq_arr = screen(np.asarray(sq_out, np.float32), np.clip(sq_glow, 0, 255))
Image.fromarray(np.clip(sq_arr, 0, 255).astype(np.uint8), "RGB").save(
    "src/assets/bg-square.jpg", quality=87, optimize=True)
print(f"wrote src/assets/bg-square.jpg ({SQ_W}x{SQ_H})")
