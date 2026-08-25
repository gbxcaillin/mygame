#!/usr/bin/env python3
"""Painterly dungeon-vault backdrops for Court of Beasts.

Follows docs/title-art-style.json: torch-lit near-black ashlar stone,
fine cracks, a subtle gold hairline frame with sapphire finials and
emerald corner fittings (echoing the title plaque), warm/cool light
pools under the DOM brazier flames, and faint red/blue faction washes
on the opponent/player sides. Smooth high-res rendering — the old
pixel-art dragons, banners and chunky bricks are intentionally gone.

Outputs src/assets/bg-landscape.jpg (1920x1080, red left / blue right),
src/assets/bg-4x3.jpg (1440x1080, same composition at 4:3 so squarish
windows don't crop the edge jewelry), and src/assets/bg-portrait.jpg
(1080x2340, red top / blue bottom).

Run from the repo root:  python3 scripts/generate_backdrops.py
"""

import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# palette (docs/title-art-style.json)
STONE_BASE = np.array([15.0, 12.5, 17.0])
GOLD_MID = (215, 148, 37)
GOLD_DEEP = (138, 106, 37)
SAPPHIRE = (7, 83, 186)
SAPPHIRE_GLINT = (191, 227, 243)
EMERALD = (57, 131, 93)
EMERALD_GLINT = (102, 211, 184)
CRACK_WARM = (48, 24, 0)


def fbm(w: int, h: int, rng: np.random.Generator) -> np.ndarray:
    """Multi-octave value noise in ~[-0.5, 0.5]."""
    acc = np.zeros((h, w), np.float32)
    for cells, amp in ((6, 0.42), (14, 0.26), (30, 0.16), (64, 0.10), (140, 0.06)):
        sx = max(2, round(cells * w / max(w, h)))
        sy = max(2, round(cells * h / max(w, h)))
        grid = (rng.random((sy, sx)) * 255).astype(np.uint8)
        up = Image.fromarray(grid, "L").resize((w, h), Image.BICUBIC)
        acc += (np.asarray(up, np.float32) / 255.0 - 0.5) * amp
    return acc


def screen(base: np.ndarray, light: np.ndarray) -> np.ndarray:
    return 255.0 - (255.0 - base) * (255.0 - light) / 255.0


def radial_light(w, h, cx, cy, radius, color, strength) -> np.ndarray:
    """Soft radial glow layer (float RGB) for screen-blending."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / radius
    fall = np.clip(1.0 - d, 0.0, 1.0) ** 2 * strength
    return fall[..., None] * np.array(color, np.float32)


def draw_gem(d: ImageDraw.ImageDraw, x, y, r, core, glint):
    """Faceted diamond gem in a gold mount."""
    m = r * 1.55
    d.polygon([(x, y - m), (x + m * 0.72, y), (x, y + m), (x - m * 0.72, y)],
              fill=(*GOLD_DEEP, 200), outline=(*GOLD_MID, 230))
    d.polygon([(x, y - r), (x + r * 0.66, y), (x, y + r), (x - r * 0.66, y)],
              fill=(*core, 255))
    dark = tuple(int(c * 0.55) for c in core)
    d.polygon([(x, y), (x + r * 0.66, y), (x, y + r)], fill=(*dark, 255))
    d.line([(x, y - r), (x, y + r)], fill=(*glint, 120), width=1)
    d.ellipse([x - r * 0.28 - 1, y - r * 0.55 - 1, x - r * 0.28 + 1, y - r * 0.55 + 1],
              fill=(*glint, 255))


def make_backdrop(w: int, h: int, portrait: bool, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    prnd = random.Random(seed)

    # ── stone wall: fbm texture + ashlar block courses ──
    tex = fbm(w, h, rng)
    img = STONE_BASE[None, None, :] * (1.0 + tex[..., None] * 0.9)
    img += tex[..., None] * np.array([6.0, 3.5, 0.0])  # warm flecks in the grain

    block_h = round(h * (0.075 if portrait else 0.115))
    block_w = round(block_h * 2.05)
    bevel = np.zeros((h, w), np.float32)
    row = 0
    y = 0
    while y < h:
        y2 = min(h, y + block_h)
        xoff = -(block_w // 2) if row % 2 else 0
        x = xoff
        while x < w:
            x2 = min(w, x + block_w)
            if x2 > 0:
                x0 = max(0, x)
                bevel[y:y2, x0:x2] += float(rng.uniform(-7.0, 7.0))  # per-block value
                bevel[y:min(y + 3, h), x0:x2] += 7.0                  # top edge catches light
                bevel[max(0, y2 - 3):y2, x0:x2] -= 6.0                # bottom edge in shadow
            x += block_w
        # mortar between courses
        bevel[max(0, y - 2):min(y + 1, h), :] -= 13.0
        row += 1
        y += block_h
    # vertical mortar joints (redrawn with jitter so courses read hand-laid)
    row = 0
    y = 0
    while y < h:
        y2 = min(h, y + block_h)
        xoff = -(block_w // 2) if row % 2 else 0
        x = xoff
        while x < w:
            xj = x + prnd.randint(-3, 3)
            if 1 <= xj < w - 1:
                bevel[y:y2, xj - 1:xj + 2] -= 11.0
            x += block_w
        row += 1
        y += block_h
    img += bevel[..., None]

    # ── cracks: dark random walks, a few with a warm scorched tint ──
    crack = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(crack)
    for _ in range(round(14 * (w * h) / (1920 * 1080))):
        x = prnd.uniform(0.05 * w, 0.95 * w)
        y = prnd.uniform(0.05 * h, 0.95 * h)
        ang = prnd.uniform(0, math.tau)
        warm = prnd.random() < 0.3
        col = (*CRACK_WARM, 70) if warm else (4, 3, 6, 110)
        for _ in range(prnd.randint(14, 40)):
            ang += prnd.uniform(-0.7, 0.7)
            nx = x + math.cos(ang) * prnd.uniform(4, 14)
            ny = y + math.sin(ang) * prnd.uniform(4, 14)
            cd.line([(x, y), (nx, ny)], fill=col, width=prnd.choice((1, 1, 2)))
            x, y = nx, ny

    base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")
    base = base.filter(ImageFilter.GaussianBlur(0.5))
    base = Image.alpha_composite(base.convert("RGBA"), crack).convert("RGB")
    img = np.asarray(base, np.float32)

    # ── lighting ──
    light = radial_light(w, h, w * 0.5, h * 0.22, max(w, h) * 0.85, (52, 36, 16), 0.55)
    if portrait:
        pools = [(0.07, 0.635, (255, 140, 50), 0.30), (0.93, 0.635, (70, 130, 255), 0.30)]
        washes = [((0.5, -0.05), 0.55, (150, 26, 30), 0.16),   # opponent red, top
                  ((0.5, 1.05), 0.55, (36, 70, 200), 0.16)]    # player blue, bottom
    else:
        pools = [(0.055, 0.72, (255, 140, 50), 0.32), (0.945, 0.72, (70, 130, 255), 0.32)]
        washes = [((-0.05, 0.35), 0.5, (150, 26, 30), 0.17),   # red, left
                  ((1.05, 0.35), 0.5, (36, 70, 200), 0.17)]    # blue, right
    for fx, fy, col, s in pools:
        light += radial_light(w, h, w * fx, h * fy, max(w, h) * 0.24, col, s)
    for (fx, fy), rad, col, s in washes:
        light += radial_light(w, h, w * fx, h * fy, max(w, h) * rad, col, s)
    img = screen(img, np.clip(light, 0, 255))

    # ── gold hairline frame with gems (echoes the title plaque) ──
    deco = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    inset = round(min(w, h) * 0.028)
    dd.rectangle([inset, inset, w - inset, h - inset], outline=(*GOLD_DEEP, 120), width=3)
    in2 = inset + 7
    dd.rectangle([in2, in2, w - in2, h - in2], outline=(*GOLD_MID, 60), width=1)
    gem_r = round(min(w, h) * 0.012)
    draw_gem(dd, w // 2, inset, gem_r, SAPPHIRE, SAPPHIRE_GLINT)          # top finial
    draw_gem(dd, w // 2, h - inset, gem_r, SAPPHIRE, SAPPHIRE_GLINT)      # bottom finial
    for cx, cy in ((inset, inset), (w - inset, inset), (inset, h - inset), (w - inset, h - inset)):
        draw_gem(dd, cx, cy, round(gem_r * 0.8), EMERALD, EMERALD_GLINT)  # corner emeralds
    img_pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")
    img_pil = Image.alpha_composite(img_pil.convert("RGBA"), deco).convert("RGB")
    img = np.asarray(img_pil, np.float32)

    # gem glows so the fittings read as lit jewels
    glow = radial_light(w, h, w * 0.5, inset, min(w, h) * 0.06, SAPPHIRE, 0.5)
    glow += radial_light(w, h, w * 0.5, h - inset, min(w, h) * 0.06, SAPPHIRE, 0.5)
    for cx, cy in ((inset, inset), (w - inset, inset), (inset, h - inset), (w - inset, h - inset)):
        glow += radial_light(w, h, cx, cy, min(w, h) * 0.05, EMERALD, 0.45)
    img = screen(img, np.clip(glow, 0, 255))

    # ── stage: darken where the board sits so the gold grid pops ──
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    scx, scy = (0.5, 0.47) if portrait else (0.40, 0.52)
    sd = np.sqrt(((xs - w * scx) / (w * 0.42)) ** 2 + ((ys - h * scy) / (h * 0.34)) ** 2)
    img *= (1.0 - 0.16 * np.clip(1.0 - sd, 0, 1)[..., None])

    # ── vignette + grain ──
    vd = np.sqrt(((xs - w / 2) / (w / 2)) ** 2 + ((ys - h / 2) / (h / 2)) ** 2)
    img *= (1.0 - 0.46 * np.clip(vd - 0.5, 0, 1) ** 1.5)[..., None]
    img += rng.normal(0.0, 2.4, (h, w, 1)).astype(np.float32)

    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")


if __name__ == "__main__":
    make_backdrop(1920, 1080, portrait=False, seed=61).save(
        "src/assets/bg-landscape.jpg", quality=87, optimize=True)
    print("wrote src/assets/bg-landscape.jpg")
    make_backdrop(1440, 1080, portrait=False, seed=63).save(
        "src/assets/bg-4x3.jpg", quality=87, optimize=True)
    print("wrote src/assets/bg-4x3.jpg")
    make_backdrop(1080, 2340, portrait=True, seed=62).save(
        "src/assets/bg-portrait.jpg", quality=87, optimize=True)
    print("wrote src/assets/bg-portrait.jpg")
