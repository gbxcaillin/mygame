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


def _blob(gray, size, cfx, cfy, half=0.11, thr=30):
    """Largest dark blob near (cfx, cfy): (fx, fy, height_frac, fill) or None."""
    cx, cy, hw = cfx * size, cfy * size, half * size
    x0, x1 = int(max(0, cx - hw)), int(min(size, cx + hw))
    y0, y1 = int(max(0, cy - hw)), int(min(size, cy + hw))
    lbl, n = ndimage.label(gray[y0:y1, x0:x1] < thr)
    best, best_score = None, -1.0
    for i in range(1, n + 1):
        ys, xs = np.where(lbl == i)
        area = len(xs)
        if area < 150:
            continue
        w = xs.max() - xs.min() + 1
        h = ys.max() - ys.min() + 1
        if not (0.4 <= w / h <= 2.2):
            continue
        ccx, ccy = xs.mean(), ys.mean()
        dist = ((ccx - (x1 - x0) / 2) ** 2 + (ccy - (y1 - y0) / 2) ** 2) ** 0.5
        score = area - dist * 4
        if score > best_score:
            best_score = score
            best = ((x0 + ccx) / size, (y0 + ccy) / size, h / size, area / (w * h))
    return best


def detect_boxes(gray, size):
    """Centre of each of the four number boxes as canvas fractions.

    Top/bottom are found independently. Left and right share one vertical
    centre taken from whichever of the two is a clean (unmerged) box, so a
    left/right box that blends into dark artwork still gets the right Y while
    keeping its own reliable X. Falls back to canonical positions if needed.
    """
    t = _blob(gray, size, *CANON["top"])
    b = _blob(gray, size, *CANON["bottom"])
    lft = _blob(gray, size, *CANON["left"])
    rgt = _blob(gray, size, *CANON["right"])
    clean = [c[1] for c in (lft, rgt) if c and c[3] > 0.82 and c[2] < 0.19]
    fy = float(np.mean(clean)) if clean else CANON["left"][1]
    return {
        "top": (t[0], t[1]) if t else CANON["top"],
        "bottom": (b[0], b[1]) if b else CANON["bottom"],
        "left": (lft[0], fy) if lft else (CANON["left"][0], fy),
        "right": (rgt[0], fy) if rgt else (CANON["right"][0], fy),
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    creatures = json.load(open(CREATURES))["creatures"]
    files = sorted(glob.glob(os.path.join(PLACEHOLDERS, "*.png")))
    assert len(files) == len(creatures) == 60, (len(files), len(creatures))

    font = ImageFont.truetype(FONT, FONT_PX)
    for creature, path in zip(creatures, files):
        gray = np.array(Image.open(path).convert("L"))
        boxes = detect_boxes(gray, gray.shape[0])
        img = Image.open(path).convert("RGB").resize((OUT, OUT), Image.LANCZOS)
        draw = ImageDraw.Draw(img)
        vals = {"top": creature["top"], "left": creature["left"],
                "right": creature["right"], "bottom": creature["bottom"]}
        for side, (fx, fy) in boxes.items():
            cx, cy = fx * OUT, fy * OUT
            text = rank_label(vals[side])
            bb = draw.textbbox((0, 0), text, font=font)
            tw, th = bb[2] - bb[0], bb[3] - bb[1]
            draw.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), text, font=font,
                      fill=FILL, stroke_width=STROKE, stroke_fill=(0, 0, 0))
        img.save(os.path.join(OUT_DIR, hyslug(creature["name"]) + ".jpg"),
                 quality=92, optimize=True)

    print(f"Baked {len(creatures)} cards -> {OUT_DIR}")


if __name__ == "__main__":
    main()
