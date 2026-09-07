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
from scipy import ndimage

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
    # A light blur first: a mottled (textured) banner fill averages into a
    # flat dark band, while textured dark artwork keeps larger-scale structure
    # and still fails the flatness test. Verified on a clean banner (Kraken),
    # a banner over dark ground (Fafnir) and the mottled Common template.
    blurred = ndimage.gaussian_filter(gray.astype(np.float32), sigma=size / 250)
    band = blurred[:, int(0.25 * size):int(0.75 * size)]
    lo, hi = int(0.62 * size), int(0.90 * size)
    flat_dark = [y for y in range(lo, hi) if band[y].mean() < 45 and band[y].std() < 20]
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


BOXES = os.path.join(BASE, "scripts", "card_boxes.json")


def record_boxes(slug, boxes):
    """Pin this card's measured plaque centres so a full re-bake
    (bake_card_numbers.py) reproduces it exactly, whatever the detector does."""
    pinned = json.load(open(BOXES)) if os.path.exists(BOXES) else {}
    pinned[slug] = {side: [float(x), float(y)] for side, (x, y) in boxes.items()}
    with open(BOXES, "w") as f:
        json.dump(dict(sorted(pinned.items())), f, indent=1)
        f.write("\n")


def main(src, name, detect_from=None):
    creatures = json.load(open(CREATURES))["creatures"]
    idx, creature = next(((i, c) for i, c in enumerate(creatures, 1)
                          if c["name"].lower() == name.lower()), (None, None))
    if creature is None:
        sys.exit(f"No creature named {name!r} in {CREATURES}")

    us_slug = re.sub(r"[^a-z0-9]+", "_", creature["name"].lower()).strip("_")
    # Match the exact NN_slug.png name. A looser "*_slug.png" would also match
    # names this one is a suffix of ("Dragon" -> "Ancient Dragon"), and then
    # baking one card could silently overwrite another's placeholder.
    matches = glob.glob(os.path.join(PLACEHOLDERS, f"[0-9][0-9]_{us_slug}.png"))
    placeholder = matches[0] if matches else os.path.join(PLACEHOLDERS, f"{idx:02d}_{us_slug}.png")

    # 1) placeholder: source art + name baked into the banner at full resolution
    im = Image.open(src).convert("RGB")
    if im.size[0] != im.size[1]:
        sys.exit(f"Source must be square, got {im.size}")
    size = im.size[0]
    # Plaques and banner are measured on the card itself, or on a reference
    # image of the same template (e.g. the per-pixel median of a batch, where
    # the identical frame stays crisp and the differing paintings average
    # away) when per-card detection is unreliable, as on a mottled fill.
    if detect_from:
        ref_gray = np.array(Image.open(detect_from).convert("L"))
        if ref_gray.shape[0] != size:
            sys.exit(f"Reference must match the source size {size}, got {ref_gray.shape[0]}")
    else:
        ref_gray = np.array(im.convert("L"))
    by, bh = find_banner(ref_gray)
    draw = ImageDraw.Draw(im)
    name_font = ImageFont.truetype(FONT, int(size * bh * NAME_FILL))
    draw_centered(draw, creature["name"].upper(), name_font, 0.5 * size, by * size,
                  max(1, round(STROKE * size / OUT * 0.75)))
    os.makedirs(PLACEHOLDERS, exist_ok=True)
    im.save(placeholder)

    # 2) game JPG: ranks baked into the detected plaques, as bake_card_numbers.py does
    boxes = detect_boxes(ref_gray if detect_from else np.array(im.convert("L")), size)
    record_boxes(hyslug(creature["name"]), boxes)
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
    # usage: bake_new_card.py <source.png> "<Creature Name>" [--detect-from ref.png]
    args = sys.argv[1:]
    ref = None
    if "--detect-from" in args:
        i = args.index("--detect-from")
        ref = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    main(args[0], args[1], ref)
