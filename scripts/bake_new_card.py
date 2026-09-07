"""Drop a newly supplied card painting into the set.

    python3 scripts/bake_new_card.py <source.png> "<Creature Name>"

The source must follow docs/card-art-spec.json: square, gold frame painted in,
four EMPTY rank plaques and an EMPTY name banner. This script

  1. bakes the creature name into the banner at full resolution and writes the
     result as the card's placeholder (card_placeholders/NN_slug.png), so the
     placeholder matches the rest of the set (name in art, numbers baked later);
  2. bakes the four ranks from scripts/creatures.json into the plaques exactly as
     bake_card_numbers.py does, writing the 512px game JPG (src/assets/cards/).

Rank plaques are detected from the art itself (see bake_card_numbers.detect_boxes).
"""
import glob
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake_card_numbers import (  # noqa: E402
    BASE, CREATURES, FILL, FONT, FONT_PX, OUT, OUT_DIR, PLACEHOLDERS, STROKE,
    detect_boxes, hyslug, rank_label,
)

# Name height as a fraction of the banner's flat interior. Matches how the
# existing set fills its banners (e.g. PHOENIX); lower reads as undersized.
NAME_FILL = 0.78


def find_banner(gray):
    """Centre y and height (canvas fractions) of the dark name banner.

    The banner interior is a flat near-black fill, whereas dark artwork around
    it (rock, shadow) is textured. So a banner row must be dark AND flat; then
    take the contiguous run of such rows nearest the spec position with a
    plausible height, so dark ground touching the banner can't merge into it.
    """
    size = gray.shape[0]
    band = gray[:, int(0.25 * size):int(0.75 * size)].astype(np.float32)
    lo, hi = int(0.62 * size), int(0.90 * size)
    flat_dark = [y for y in range(lo, hi) if band[y].mean() < 30 and band[y].std() < 12]
    runs = []
    for y in flat_dark:
        if runs and y == runs[-1][-1] + 1:
            runs[-1].append(y)
        else:
            runs.append([y])
    plausible = [r for r in runs if 0.03 * size <= len(r) <= 0.12 * size]
    if not plausible:
        return 0.770, 0.062  # spec defaults
    r = min(plausible, key=lambda r: abs((r[0] + r[-1]) / 2 / size - 0.770))
    return (r[0] + r[-1]) / 2 / size, len(r) / size


def draw_centered(draw, text, font, cx, cy, stroke):
    bb = draw.textbbox((0, 0), text, font=font)
    draw.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1]),
              text, font=font, fill=FILL, stroke_width=stroke, stroke_fill=(0, 0, 0))


def main(src, name):
    creatures = json.load(open(CREATURES))["creatures"]
    idx, creature = next(((i, c) for i, c in enumerate(creatures, 1)
                          if c["name"].lower() == name.lower()), (None, None))
    if creature is None:
        sys.exit(f"No creature named {name!r} in {CREATURES}")

    us_slug = re.sub(r"[^a-z0-9]+", "_", creature["name"].lower()).strip("_")
    matches = glob.glob(os.path.join(PLACEHOLDERS, f"*_{us_slug}.png"))
    placeholder = matches[0] if matches else os.path.join(PLACEHOLDERS, f"{idx:02d}_{us_slug}.png")

    # 1) placeholder: source art + name baked into the banner at full resolution
    im = Image.open(src).convert("RGB")
    if im.size[0] != im.size[1]:
        sys.exit(f"Source must be square, got {im.size}")
    size = im.size[0]
    gray = np.array(im.convert("L"))
    by, bh = find_banner(gray)
    draw = ImageDraw.Draw(im)
    name_font = ImageFont.truetype(FONT, int(size * bh * NAME_FILL))
    draw_centered(draw, creature["name"].upper(), name_font, 0.5 * size, by * size,
                  max(1, round(STROKE * size / OUT * 0.75)))
    os.makedirs(PLACEHOLDERS, exist_ok=True)
    im.save(placeholder)

    # 2) game JPG: ranks baked into the detected plaques, as bake_card_numbers.py does
    gray = np.array(im.convert("L"))
    boxes = detect_boxes(gray, size)
    img = im.resize((OUT, OUT), Image.LANCZOS)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, FONT_PX)
    for side, (fx, fy) in boxes.items():
        draw_centered(d, rank_label(creature[side]), font, fx * OUT, fy * OUT, STROKE)
    out = os.path.join(OUT_DIR, hyslug(creature["name"]) + ".jpg")
    img.save(out, quality=92, optimize=True)

    print(f"{creature['name']}: top {creature['top']} left {creature['left']} "
          f"right {creature['right']} bottom {creature['bottom']}")
    print("plaques:", {k: (round(x, 3), round(y, 3)) for k, (x, y) in boxes.items()})
    print(f"banner y={by:.3f} h={bh:.3f}")
    print("placeholder:", os.path.relpath(placeholder, BASE))
    print("baked:", os.path.relpath(out, BASE))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
