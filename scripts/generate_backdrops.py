"""Procedural 90s-Sega-style arcane/beast backdrops.

Renders at low resolution with ordered (Bayer) dithering and hand-placed
pixel silhouettes, then upscales with nearest-neighbour so the result has
crunchy 16-bit-era pixels. Two compositions:
  - landscape (480x270 -> 1920x1080) for 16:9 and 4:3
  - portrait  (270x585 -> 1080x2340) for 9:19.5
"""
from PIL import Image, ImageDraw
import math, random

random.seed(77)

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def dither_gradient(img, stops, y0, y1):
    """Vertical gradient between color stops with 4x4 Bayer dithering."""
    W, H = img.size
    px = img.load()
    n = len(stops) - 1
    for y in range(y0, y1):
        t = (y - y0) / max(1, (y1 - y0 - 1))
        ft = t * n
        i = min(int(ft), n - 1)
        frac = ft - i
        for x in range(W):
            th = (BAYER[y % 4][x % 4] + 0.5) / 16.0
            f = 1.0 if frac > th else 0.0
            px[x, y] = lerp(stops[i], stops[i + 1], f)


def scatter_stars(draw, W, y_max, count, colors):
    for _ in range(count):
        x = random.randrange(0, W)
        y = random.randrange(0, y_max)
        c = random.choice(colors)
        draw.point((x, y), fill=c)
        if random.random() < 0.2:
            draw.point((x + 1, y), fill=c)


def rune_ring(draw, cx, cy, r, color, glow):
    """Arcane circle: two rings + tick runes."""
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=glow)
    r2 = r - 3
    draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=color)
    for k in range(24):
        a = k * math.tau / 24
        x1, y1 = cx + math.cos(a) * (r - 1), cy + math.sin(a) * (r - 1)
        x2, y2 = cx + math.cos(a) * (r - 6), cy + math.sin(a) * (r - 6)
        if k % 2 == 0:
            draw.line([x1, y1, x2, y2], fill=color)
    # inner sigil triangle pair
    r3 = r - 8
    pts1 = [(cx + math.cos(a) * r3, cy + math.sin(a) * r3)
            for a in (math.radians(90), math.radians(210), math.radians(330))]
    pts2 = [(cx + math.cos(a) * r3, cy + math.sin(a) * r3)
            for a in (math.radians(270), math.radians(30), math.radians(150))]
    draw.polygon(pts1, outline=color)
    draw.polygon(pts2, outline=color)


def moon_disc(img, cx, cy, r, core, edge):
    """Dithered glowing disc."""
    px = img.load()
    W, H = img.size
    for y in range(max(0, cy - r), min(H, cy + r + 1)):
        for x in range(max(0, cx - r), min(W, cx + r + 1)):
            d = math.hypot(x - cx, y - cy) / r
            if d <= 1.0:
                th = (BAYER[y % 4][x % 4] + 0.5) / 16.0
                t = d * d
                px[x, y] = core if t + (th - 0.5) * 0.35 < 0.55 else edge


# ── Dragon silhouette (rearing wyvern, facing right), unit 100x100 ──
DRAGON_BODY = [
    (12, 96), (20, 88), (28, 82), (34, 74),  # tail
    (36, 64), (40, 54),                       # back
    (44, 46), (50, 38),                       # shoulder→neck
    (54, 28), (56, 20),                       # neck
    (60, 14), (68, 12), (76, 15),             # skull
    (84, 18), (83, 22),                       # snout
    (72, 23), (78, 30), (70, 30),             # open jaw
    (64, 34), (60, 42),                       # throat
    (58, 52), (54, 62),                       # chest
    (50, 72), (52, 82), (46, 92),             # hind leg
    (40, 90), (40, 96), (34, 96),             # feet
    (30, 90), (22, 94), (12, 100),
]
DRAGON_WING = [
    (44, 46), (34, 26), (22, 10),             # leading edge to tip
    (28, 30), (16, 22),                       # finger 1 + scallop
    (26, 40), (12, 38),                       # finger 2
    (26, 50), (18, 56),                       # finger 3
    (32, 56), (40, 54),
]
DRAGON_HORNS = [(60, 14), (52, 6), (58, 13), (56, 2), (62, 12), (68, 12)]


def draw_dragon(img, ox, oy, scale, color, flip=False, eye=(255, 210, 90)):
    """Paste a solid pixel dragon silhouette at ox,oy with given scale."""
    def tx(p):
        x, y = p
        if flip:
            x = 100 - x
        return (ox + x * scale, oy + y * scale)

    d = ImageDraw.Draw(img)
    d.polygon([tx(p) for p in DRAGON_WING], fill=color)
    d.polygon([tx(p) for p in DRAGON_BODY], fill=color)
    d.polygon([tx(p) for p in DRAGON_HORNS], fill=color)
    ex, ey = tx((66, 18))
    d.rectangle([ex, ey, ex + max(1, scale), ey + max(1, scale)], fill=eye)


def mountains(draw, W, base_y, amp, color, seed, step=14):
    rnd = random.Random(seed)
    pts = [(0, base_y)]
    x = 0
    while x < W:
        x += rnd.randrange(step, step * 2)
        pts.append((x, base_y - rnd.randrange(2, amp)))
    pts += [(W, base_y), (W, base_y + amp * 2), (0, base_y + amp * 2)]
    draw.polygon(pts, fill=color)


def floor_grid(draw, W, H, horizon, color):
    cx = W // 2
    for k in range(-12, 13):
        draw.line([cx + k * 10, horizon, cx + k * 46, H], fill=color)
    y = horizon
    dy = 2
    while y < H:
        draw.line([0, y, W, y], fill=color)
        y += dy
        dy = int(dy * 1.6) + 1


def brazier(draw, x, y, color_fire, color_stone):
    draw.rectangle([x - 2, y - 2, x + 2, y], fill=color_stone)
    draw.rectangle([x - 1, y - 6, x + 1, y - 3], fill=color_fire)
    draw.point((x, y - 8), fill=color_fire)
    draw.point((x - 1, y - 7), fill=(255, 230, 150))


def vignette(img, strength=0.55):
    W, H = img.size
    px = img.load()
    for y in range(H):
        for x in range(W):
            dx = (x - W / 2) / (W / 2)
            dy = (y - H / 2) / (H / 2)
            d = min(1.0, (dx * dx + dy * dy) ** 0.5)
            f = 1.0 - strength * (d ** 2.2)
            r, g, b = px[x, y][:3]
            px[x, y] = (int(r * f), int(g * f), int(b * f))


# ═══════════════ LANDSCAPE ═══════════════
def make_landscape():
    W, H = 480, 270
    img = Image.new("RGB", (W, H))
    HORIZON = 186

    sky = [(8, 6, 20), (16, 10, 38), (34, 14, 58), (74, 26, 66), (120, 48, 52)]
    dither_gradient(img, sky, 0, HORIZON)
    d = ImageDraw.Draw(img)
    scatter_stars(d, W, 120, 90, [(90, 80, 130), (140, 130, 180), (200, 190, 220)])

    # arcane moon + rune ring behind centre
    moon_disc(img, W // 2, 96, 46, (66, 42, 86), (44, 24, 62))
    rune_ring(d, W // 2, 96, 52, (150, 110, 60), (96, 62, 40))

    # mountain layers
    mountains(d, W, HORIZON - 26, 26, (26, 12, 40), seed=5)
    mountains(d, W, HORIZON - 8, 18, (18, 8, 30), seed=9)

    # floor
    dither_gradient(img, [(24, 14, 26), (10, 6, 14)], HORIZON, H)
    floor_grid(d, W, H, HORIZON, (52, 34, 26))
    d.line([0, HORIZON, W, HORIZON], fill=(150, 96, 40))
    d.line([0, HORIZON + 1, W, HORIZON + 1], fill=(80, 46, 24))

    # flanking dragons on rock pedestals
    d.polygon([(6, HORIZON), (86, HORIZON), (72, 250), (0, 258)], fill=(16, 10, 18))
    d.polygon([(W - 6, HORIZON), (W - 86, HORIZON), (W - 72, 250), (W, 258)], fill=(16, 10, 18))
    draw_dragon(img, 4, 78, 1.05, (34, 10, 14), flip=False, eye=(255, 90, 60))
    draw_dragon(img, W - 109, 78, 1.05, (8, 14, 34), flip=True, eye=(90, 160, 255))
    brazier(d, 92, HORIZON - 2, (255, 140, 40), (40, 30, 34))
    brazier(d, W - 92, HORIZON - 2, (90, 160, 255), (40, 30, 34))

    vignette(img, 0.6)
    return img.resize((1920, 1080), Image.NEAREST)


# ═══════════════ PORTRAIT ═══════════════
def make_portrait():
    W, H = 270, 585
    img = Image.new("RGB", (W, H))
    HORIZON = 430

    sky = [(8, 6, 20), (14, 10, 34), (26, 12, 50), (52, 20, 62), (96, 38, 56)]
    dither_gradient(img, sky, 0, HORIZON)
    d = ImageDraw.Draw(img)
    scatter_stars(d, W, 300, 110, [(90, 80, 130), (140, 130, 180), (200, 190, 220)])

    # big arcane moon behind the title zone
    moon_disc(img, W // 2, 74, 52, (66, 42, 86), (44, 24, 62))
    rune_ring(d, W // 2, 74, 60, (150, 110, 60), (96, 62, 40))

    # mountains
    mountains(d, W, HORIZON - 22, 22, (26, 12, 40), seed=3)
    mountains(d, W, HORIZON - 6, 14, (18, 8, 30), seed=8)

    # floor
    dither_gradient(img, [(24, 14, 26), (10, 6, 14)], HORIZON, H)
    floor_grid(d, W, H, HORIZON, (52, 34, 26))
    d.line([0, HORIZON, W, HORIZON], fill=(150, 96, 40))
    d.line([0, HORIZON + 1, W, HORIZON + 1], fill=(80, 46, 24))

    # dragons flank the mid board zone, perched on side crags
    d.polygon([(0, 285), (36, 294), (30, 415), (0, 424)], fill=(16, 10, 18))
    d.polygon([(W, 285), (W - 36, 294), (W - 30, 415), (W, 424)], fill=(16, 10, 18))
    draw_dragon(img, -6, 200, 0.85, (34, 10, 14), flip=False, eye=(255, 90, 60))
    draw_dragon(img, W - 79, 200, 0.85, (8, 14, 34), flip=True, eye=(90, 160, 255))
    brazier(d, 12, HORIZON - 2, (255, 140, 40), (40, 30, 34))
    brazier(d, W - 12, HORIZON - 2, (90, 160, 255), (40, 30, 34))

    vignette(img, 0.6)
    return img.resize((1080, 2340), Image.NEAREST)


if __name__ == "__main__":
    out = "/tmp/claude-0/-home-user-mygame/b52cdc70-4740-5ae6-8457-a11a6b857399/scratchpad"
    make_landscape().save(out + "/bg-landscape.png")
    make_portrait().save(out + "/bg-portrait.png")
    print("done")
