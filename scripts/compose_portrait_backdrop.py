#!/usr/bin/env python3
"""Composes the portrait backdrop from the supplied vault painting.

Base art: scripts/bg-portrait-source.png — an AI-rendered stone vault
with arch columns, orange/blue braziers, red/blue faction washes and a
painted 3x3 board frame, but otherwise a blank canvas. This script:

  1. crops off the painting's baked-in border frame,
  2. scales to 1080 wide and extends the wall top/bottom (reflected,
     blurred, darkened stone) so the canvas is the wireframe spec's
     1080x2340 with the painted board frame landing on the spec's
     board zone,
  3. dresses the UI zones per docs/wireframe-portrait.json: five
     red-toned card sockets for the opponent hand, five blue for the
     player, recessed panels behind the topbar and controls, a warm
     glow behind the title, and
  4. adds the house hairline frame with sapphire finials and emerald
     corner gems (matching the title plaque and the other backdrops).

Run from the repo root:  python3 scripts/compose_portrait_backdrop.py
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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

# measured in the source painting (fractions of its full canvas)
SRC_GRID_TOP = 0.307
CROP_X = 0.023   # side crop: removes the painted hairline border
CROP_Y = 0.080   # top/bottom crop: removes the painted gem crests
SPEC_BOARD_TOP = 835  # px at 1080x2340, from wireframe-portrait.json


def extend_strip(strip: np.ndarray, out_h: int, darken_toward_edge: bool, rng) -> np.ndarray:
    """Continues the wall past the frame: reflect, blur, darken, re-grain."""
    src = Image.fromarray(strip[::-1].astype(np.uint8), "RGB")  # mirrored continuation
    src = src.resize((strip.shape[1], out_h), Image.BICUBIC)
    src = src.filter(ImageFilter.GaussianBlur(6))
    a = np.asarray(src, np.float32)
    fade = np.linspace(1.0, 0.35, out_h)[:, None, None]
    if not darken_toward_edge:
        fade = fade[::-1]
    a = a * fade + rng.normal(0, 2.0, a.shape)
    return a


def rounded_rect(d: ImageDraw.ImageDraw, box, radius, color, width):
    d.rounded_rectangle(box, radius=radius, outline=color, width=width)


def draw_gem(d: ImageDraw.ImageDraw, x, y, r, core, glint):
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


rng = np.random.default_rng(7)

# ── 1-2. crop, scale, extend ──
src = Image.open(SRC).convert("RGB")
sw, sh = src.size
core = src.crop((round(sw * CROP_X), round(sh * CROP_Y),
                 round(sw * (1 - CROP_X)), round(sh * (1 - CROP_Y))))
scale = W / core.width
content = core.resize((W, round(core.height * scale)), Image.LANCZOS)
ch = content.height

# land the painted grid's top edge on the spec board top
grid_top_in_content = round((SRC_GRID_TOP - CROP_Y) / (1 - 2 * CROP_Y) * ch)
top_ext = max(0, SPEC_BOARD_TOP - grid_top_in_content)
bot_ext = H - ch - top_ext
canvas = np.zeros((H, W, 3), np.float32)
carr = np.asarray(content, np.float32)
canvas[top_ext:top_ext + ch] = carr
canvas[:top_ext] = extend_strip(carr[:top_ext], top_ext, darken_toward_edge=True, rng=rng)
canvas[top_ext + ch:] = extend_strip(carr[ch - bot_ext:], bot_ext, darken_toward_edge=False, rng=rng)[::-1]

# crossfade the extension seams so no hard line shows
FEATHER = 70
for seam, into_content in ((top_ext, True), (top_ext + ch, False)):
    band = np.linspace(0.0, 1.0, FEATHER)[:, None, None]
    if into_content:
        blur = np.asarray(
            Image.fromarray(canvas[seam - 8:seam + FEATHER + 8].astype(np.uint8), "RGB")
            .filter(ImageFilter.GaussianBlur(5)), np.float32)[8:-8]
        canvas[seam:seam + FEATHER] = blur * (1 - band) + canvas[seam:seam + FEATHER] * band
    else:
        blur = np.asarray(
            Image.fromarray(canvas[seam - FEATHER - 8:seam + 8].astype(np.uint8), "RGB")
            .filter(ImageFilter.GaussianBlur(5)), np.float32)[8:-8]
        canvas[seam - FEATHER:seam] = canvas[seam - FEATHER:seam] * (1 - band) + blur * band

# ── 3. dress the UI zones (spec: docs/wireframe-portrait.json) ──
deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
glow = np.zeros((H, W, 3), np.float32)

# recessed panels behind the topbar and the controls cluster
for (x0, y0, x1, y1) in ((32, 219, 1047, 331), (32, 1934, 1047, 2308)):
    dd.rounded_rectangle([x0, y0, x1, y1], radius=10, fill=(0, 0, 0, 66))
    rounded_rect(dd, [x0, y0, x1, y1], 10, (*GOLD_DEEP, 110), 2)
    rounded_rect(dd, [x0 + 5, y0 + 5, x1 - 5, y1 - 5], 7, (*GOLD_MID, 40), 1)

# card sockets: five per hand row, crest diamond on each
def socket_row(y_top: int, y_bot: int, tone, label_gap=26):
    size = 189
    cy0 = y_top + label_gap
    for i in range(5):
        x0 = 39 + i * 203
        box = [x0, cy0, x0 + size, cy0 + size]
        dd.rounded_rectangle(box, radius=12, fill=(0, 0, 0, 48))
        rounded_rect(dd, box, 12, (*tone, 150), 2)
        rounded_rect(dd, [box[0] + 5, box[1] + 5, box[2] - 5, box[3] - 5], 9, (*tone, 55), 1)
        # tiny crest gem centered on the socket's top edge
        draw_gem(dd, x0 + size // 2, cy0, 6, tone, tuple(min(255, c + 90) for c in tone))
    return cy0 + size // 2

mid_a = socket_row(566, 792, RED_SOCKET)
mid_b = socket_row(1473, 1699, BLUE_SOCKET)
glow += radial(W, H, 540, mid_a, 620, (150, 34, 26), 0.16)   # red ambience on the row
glow += radial(W, H, 540, mid_b, 620, (30, 70, 190), 0.16)   # blue ambience

# warm glow cradling the title plaque
glow += radial(W, H, 540, 115, 430, (108, 74, 26), 0.30)

# ── 4. house frame + gems ──
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

out = Image.alpha_composite(
    Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), "RGB").convert("RGBA"), deco
).convert("RGB")
out_arr = screen(np.asarray(out, np.float32), np.clip(glow, 0, 255))
Image.fromarray(np.clip(out_arr, 0, 255).astype(np.uint8), "RGB").save(OUT, quality=87, optimize=True)
print(f"wrote {OUT} ({W}x{H}); grid top landed at {grid_top_in_content + top_ext} (spec {SPEC_BOARD_TOP})")
