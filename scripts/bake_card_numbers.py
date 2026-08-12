"""Bake the four stat numbers into each card's black number boxes.

Input : card_placeholders/NN_name.png  (uniform square crops from extract_cards.py)
Stats : scripts/creatures.json          (authoritative top/right/bottom/left, 10 -> "X")
Output: src/assets/cards/<hyphen-slug>.jpg  (what the game loads)

Numbers are centred in each card's OWN detected black box (not a fixed position),
so every number sits in its box even though the source art places the boxes a few
pixels differently per card. Detection is a local-window search around each box so
a box that blends into dark artwork is still isolated; the rare miss falls back to
the median detected position for that box.
"""
import glob
import json
import os
import re

import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLACEHOLDERS = os.path.join(BASE, "card_placeholders")
CREATURES = os.path.join(BASE, "scripts", "creatures.json")
OUT_DIR = os.path.join(BASE, "src", "assets", "cards")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

OUT = 512                     # baked resolution
FONT_PX = int(OUT * 0.112)
FILL = (247, 233, 206)        # warm cream to match the gold card trim
STROKE = 4

# Approximate box centres (canvas fractions) — only used to seed the local search
# and as a fallback when a box can't be isolated.
CANON = {"top": (0.500, 0.112), "left": (0.160, 0.520),
         "right": (0.842, 0.520), "bottom": (0.500, 0.943)}


def hyslug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def rank_label(n):
    return "X" if n == 10 else str(n)


def local_box(gray, size, cfx, cfy, half=0.11):
    """Return the (fx, fy) centre of the black box near (cfx, cfy), or None."""
    cx, cy, hw = cfx * size, cfy * size, half * size
    x0, x1 = int(max(0, cx - hw)), int(min(size, cx + hw))
    y0, y1 = int(max(0, cy - hw)), int(min(size, cy + hw))
    lbl, n = ndimage.label(gray[y0:y1, x0:x1] < 45)
    best, best_score = None, -1.0
    for i in range(1, n + 1):
        ys, xs = np.where(lbl == i)
        area = len(xs)
        if area < 120:
            continue
        w = xs.max() - xs.min() + 1
        h = ys.max() - ys.min() + 1
        fill = area / (w * h)
        if fill < 0.75 or not (0.5 <= w / h <= 2.0):
            continue
        ccx, ccy = xs.mean(), ys.mean()
        dist = ((ccx - (x1 - x0) / 2) ** 2 + (ccy - (y1 - y0) / 2) ** 2) ** 0.5
        score = fill * area - dist * 3
        if score > best_score:
            best_score, best = score, ((x0 + ccx) / size, (y0 + ccy) / size)
    return best


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    creatures = json.load(open(CREATURES))["creatures"]
    files = sorted(glob.glob(os.path.join(PLACEHOLDERS, "*.png")))
    assert len(files) == len(creatures) == 60, (len(files), len(creatures))

    # Pass 1: detect every box; build a median fallback per side.
    detected = []
    for path in files:
        gray = np.array(Image.open(path).convert("L"))
        size = gray.shape[0]
        detected.append({k: local_box(gray, size, *CANON[k]) for k in CANON})
    median = {}
    for k in CANON:
        xs = [d[k][0] for d in detected if d[k]]
        ys = [d[k][1] for d in detected if d[k]]
        median[k] = (float(np.median(xs)), float(np.median(ys)))

    font = ImageFont.truetype(FONT, FONT_PX)
    misses = 0
    for creature, path, boxes in zip(creatures, files, detected):
        img = Image.open(path).convert("RGB").resize((OUT, OUT), Image.LANCZOS)
        draw = ImageDraw.Draw(img)
        vals = {"top": creature["top"], "left": creature["left"],
                "right": creature["right"], "bottom": creature["bottom"]}
        for side in CANON:
            pos = boxes[side] or median[side]
            if boxes[side] is None:
                misses += 1
            cx, cy = pos[0] * OUT, pos[1] * OUT
            text = rank_label(vals[side])
            bb = draw.textbbox((0, 0), text, font=font)
            tw, th = bb[2] - bb[0], bb[3] - bb[1]
            draw.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), text, font=font,
                      fill=FILL, stroke_width=STROKE, stroke_fill=(0, 0, 0))
        img.save(os.path.join(OUT_DIR, hyslug(creature["name"]) + ".jpg"),
                 quality=92, optimize=True)

    print(f"Baked {len(creatures)} cards -> {OUT_DIR}")
    print(f"Boxes placed by detection: {240 - misses}/240 (fallback: {misses})")


if __name__ == "__main__":
    main()
