"""Pixel-art (16-bit console style) dungeon backdrops replicating the
game's original ornate art: dark stone dungeon walls, red/blue heraldic
banners with dragon crests, metal dragon statues on pedestals, Gothic
arch pillars, and flaming braziers. Rendered low-res and upscaled
nearest-neighbour. Card-slot frames and title are handled in CSS, so
they are intentionally omitted here.
"""
from PIL import Image, ImageDraw
import math, random

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

# ── palettes ──
STONE = [(10, 9, 12), (16, 14, 18), (22, 19, 24), (30, 26, 32)]
MORTAR = (5, 4, 6)
GOLD = (200, 162, 74)
GOLD_HI = (238, 206, 120)
RED = dict(cloth=(146, 30, 34), dark=(84, 14, 20), rim=(206, 60, 46),
           eye=(255, 96, 60), f1=(255, 150, 50), f2=(226, 70, 34), f3=(255, 220, 150))
BLUE = dict(cloth=(38, 66, 158), dark=(18, 30, 96), rim=(70, 128, 232),
            eye=(120, 190, 255), f1=(96, 168, 255), f2=(58, 96, 230), f3=(190, 224, 255))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def clampc(c):
    return tuple(max(0, min(255, int(v))) for v in c)


# ── dungeon stone wall with brick courses ──
def stone_wall(img, x0, y0, x1, y1, rnd, bw=21, bh=12):
    d = ImageDraw.Draw(img)
    d.rectangle([x0, y0, x1, y1], fill=MORTAR)
    for by in range(y0, y1, bh):
        row = by // bh
        xoff = (bw // 2) if row % 2 else 0
        for bx in range(x0 - xoff, x1, bw):
            shade = STONE[rnd.randrange(len(STONE))]
            x2, y2 = min(bx + bw - 2, x1), min(by + bh - 2, y1)
            if bx + 1 > x1 or by + 1 > y1:
                continue
            d.rectangle([max(bx + 1, x0), by + 1, x2, y2], fill=shade)
            # top bevel highlight, occasional crack
            d.line([max(bx + 1, x0), by + 1, x2, by + 1], fill=lerp(shade, (60, 54, 60), 0.5))
            if rnd.random() < 0.12:
                cx = rnd.randrange(bx + 2, max(bx + 3, x2))
                d.line([cx, by + 2, cx + rnd.randrange(-2, 3), y2 - 1], fill=MORTAR)


def warm_glow(img, cx, cy, r, tint, strength=0.5):
    px = img.load()
    W, H = img.size
    for y in range(max(0, cy - r), min(H, cy + r)):
        for x in range(max(0, cx - r), min(W, cx + r)):
            d = math.hypot(x - cx, y - cy) / r
            if d < 1.0:
                th = (BAYER[y % 4][x % 4] + 0.5) / 16.0
                f = (1 - d) * strength
                if f > th * 0.25:
                    r0, g0, b0 = px[x, y][:3]
                    px[x, y] = clampc((r0 + tint[0] * f, g0 + tint[1] * f, b0 + tint[2] * f))


# ── heraldic banner: pole, cloth with notched base, gold trim, crest ──
def crest(d, cx, cy, s, col):
    # stylised double-headed dragon emblem (dark silhouette)
    d.polygon([(cx, cy - 3 * s), (cx + s, cy), (cx, cy + 4 * s), (cx - s, cy)], fill=col)  # body
    for sgn in (-1, 1):
        d.polygon([(cx, cy - s), (cx + sgn * 3 * s, cy - 3 * s), (cx + sgn * s, cy)], fill=col)  # head
        d.polygon([(cx, cy + s), (cx + sgn * 4 * s, cy), (cx + sgn * s, cy + 2 * s)], fill=col)  # wing


def banner(img, x, y, w, h, pal):
    d = ImageDraw.Draw(img)
    # pole across top
    d.rectangle([x - 5, y - 4, x + w + 5, y - 1], fill=(58, 50, 40))
    d.rectangle([x - 5, y - 4, x + w + 5, y - 3], fill=GOLD)
    for fx in (x - 5, x + w + 3):
        d.polygon([(fx, y - 6), (fx + 3, y - 6), (fx + 1, y - 10)], fill=GOLD_HI)  # spear finial
    # cloth with notched bottom
    cloth = [(x, y), (x + w, y), (x + w, y + h - 7), (x + w // 2, y + h), (x, y + h - 7)]
    d.polygon(cloth, fill=pal["cloth"])
    # vertical shading bands
    d.rectangle([x, y, x + 3, y + h - 8], fill=pal["dark"])
    d.rectangle([x + w - 3, y, x + w, y + h - 8], fill=pal["dark"])
    # gold top + fringe
    d.rectangle([x, y, x + w, y + 2], fill=GOLD)
    crest(d, x + w // 2, y + h // 2 - 2, max(1, w // 8), (12, 10, 12))


# ── Gothic arch pillar ──
def arch_pillar(img, x, y0, y1, w, rnd):
    d = ImageDraw.Draw(img)
    stone_wall(img, x, y0, x + w, y1, rnd, bw=10, bh=9)
    d.rectangle([x, y0, x + w, y1], outline=(40, 34, 40))
    # pointed arch alcove (dark)
    ax0, ax1 = x + 3, x + w - 3
    ay = y0 + w
    apex = y0 + 4
    d.polygon([(ax0, y1), (ax0, ay), ((ax0 + ax1) // 2, apex), (ax1, ay), (ax1, y1)], fill=(4, 4, 7))
    d.line([ax0, ay, (ax0 + ax1) // 2, apex], fill=(46, 40, 46))
    d.line([ax1, ay, (ax0 + ax1) // 2, apex], fill=(46, 40, 46))


# ── brazier: goblet on stand with layered flame + glow ──
def brazier(img, x, ybase, pal, fh=16):
    d = ImageDraw.Draw(img)
    d.polygon([(x - 3, ybase), (x + 3, ybase), (x + 5, ybase - 9), (x - 5, ybase - 9)], fill=(46, 40, 40))
    d.rectangle([x - 7, ybase - 13, x + 7, ybase - 9], fill=(58, 52, 52))
    d.rectangle([x - 7, ybase - 13, x + 7, ybase - 12], fill=(96, 88, 80))
    top = ybase - 13
    rnd = random.Random(x * 7 + ybase)
    for k in range(fh):
        t = k / fh
        half = max(1, int((1 - t) * 6) + rnd.randrange(-1, 2))
        yy = top - k
        col = pal["f2"] if t < 0.4 else (pal["f1"] if t < 0.75 else pal["f3"])
        d.line([x - half, yy, x + half, yy], fill=col)
    warm_glow(img, x, top - fh // 2, fh + 14, (pal["f1"][0] // 3, pal["f1"][1] // 3, pal["f1"][2] // 3), 0.9)


# ── dragon statue (rim-lit dark metal), reuse silhouette ──
DRAGON_BODY = [(12, 96), (20, 88), (28, 82), (34, 74), (36, 64), (40, 54), (44, 46), (50, 38),
               (54, 28), (56, 20), (60, 14), (68, 12), (76, 15), (84, 18), (83, 22), (72, 23),
               (78, 30), (70, 30), (64, 34), (60, 42), (58, 52), (54, 62), (50, 72), (52, 82),
               (46, 92), (40, 90), (40, 96), (34, 96), (30, 90), (22, 94), (12, 100)]
DRAGON_WING = [(44, 46), (34, 26), (22, 10), (28, 30), (16, 22), (26, 40), (12, 38), (26, 50),
               (18, 56), (32, 56), (40, 54)]
DRAGON_HORNS = [(60, 14), (52, 6), (58, 13), (56, 2), (62, 12), (68, 12)]


def dragon_statue(img, ox, oy, scale, pal, flip=False):
    def tx(p):
        x, y = p
        if flip:
            x = 100 - x
        return (ox + x * scale, oy + y * scale)
    # team-coloured backlight halo so the silhouette reads off the brick
    cx = ox + 50 * scale
    cy = oy + 50 * scale
    warm_glow(img, int(cx), int(cy), int(52 * scale),
              (pal["rim"][0] // 4, pal["rim"][1] // 4, pal["rim"][2] // 4), 0.7)
    d = ImageDraw.Draw(img)
    metal = (40, 36, 46)
    dark = (20, 18, 24)
    d.polygon([tx(p) for p in DRAGON_WING], fill=dark)
    d.polygon([tx(p) for p in DRAGON_BODY], fill=metal)
    d.polygon([tx(p) for p in DRAGON_HORNS], fill=metal)
    # wing membrane a touch of team tint
    d.polygon([tx(p) for p in DRAGON_WING], outline=lerp(pal["rim"], dark, 0.5))
    # rim light along back + neck + wing leading edge
    rim = pal["rim"]
    d.line([tx((44, 46)), tx((54, 28)), tx((60, 14)), tx((76, 15))], fill=rim, width=1)
    d.line([tx((44, 46)), tx((34, 26)), tx((22, 10))], fill=rim, width=1)
    d.line([tx((36, 64)), tx((44, 46))], fill=lerp(rim, metal, 0.3))
    d.line([tx((50, 72)), tx((46, 92))], fill=lerp(rim, metal, 0.5))  # hind leg edge
    ex, ey = tx((66, 18))
    s = max(1, int(scale) + 1)
    d.rectangle([ex, ey, ex + s, ey + s], fill=pal["eye"])


def pedestal(img, x0, ytop, x1, ybot, rnd):
    d = ImageDraw.Draw(img)
    # solid lighter stone block so the statue clearly stands on it
    for yy in range(ytop, ybot):
        t = (yy - ytop) / max(1, ybot - ytop)
        d.line([x0, yy, x1, yy], fill=lerp((54, 48, 52), (26, 22, 26), t))
    # mortar courses + cap
    for yy in range(ytop + 8, ybot, 9):
        d.line([x0, yy, x1, yy], fill=(14, 12, 14))
    d.rectangle([x0 - 3, ytop, x1 + 3, ytop + 4], fill=(46, 42, 46))
    d.rectangle([x0 - 3, ytop, x1 + 3, ytop + 1], fill=(84, 76, 72))
    d.rectangle([x0, ytop, x1, ybot - 1], outline=(12, 10, 12))


def spires(d, W, base_y, color, rnd, n=9):
    x = 0
    while x < W:
        w = rnd.randrange(16, 34)
        h = rnd.randrange(20, 70)
        d.rectangle([x, base_y - h, x + w, base_y], fill=color)
        d.polygon([(x, base_y - h), (x + w, base_y - h), (x + w // 2, base_y - h - rnd.randrange(4, 12))], fill=color)
        x += w + rnd.randrange(4, 20)


def floor(img, W, H, y0, rnd):
    d = ImageDraw.Draw(img)
    for y in range(y0, H):
        t = (y - y0) / max(1, H - y0)
        d.line([0, y, W, y], fill=lerp((20, 16, 16), (6, 5, 6), t))
    cx = W // 2
    for k in range(-8, 9):
        d.line([cx + k * 12, y0, cx + k * 60, H], fill=(30, 24, 22))
    yy = y0
    step = 3
    while yy < H:
        d.line([0, yy, W, yy], fill=(30, 24, 22))
        yy += step
        step += 2


def vignette(img, strength=0.6):
    W, H = img.size
    px = img.load()
    for y in range(H):
        for x in range(W):
            dx = (x - W / 2) / (W / 2)
            dy = (y - H / 2) / (H / 2)
            dd = min(1.0, (dx * dx + dy * dy) ** 0.5)
            f = 1.0 - strength * (dd ** 2.4)
            r, g, b = px[x, y][:3]
            px[x, y] = (int(r * f), int(g * f), int(b * f))


# ═══════════════ LANDSCAPE ═══════════════
def make_landscape():
    W, H = 480, 270
    img = Image.new("RGB", (W, H), (8, 7, 10))
    d = ImageDraw.Draw(img)
    rnd = random.Random(41)
    stone_wall(img, 0, 0, W, H, rnd)
    spires(d, W, 150, (12, 11, 15), random.Random(3))
    warm_glow(img, W // 2, 150, 150, (26, 12, 6), 0.5)
    FLOOR = 210
    floor(img, W, H, FLOOR, rnd)

    # side pillars
    arch_pillar(img, 96, 150, FLOOR, 30, random.Random(11))
    arch_pillar(img, W - 126, 150, FLOOR, 30, random.Random(12))

    # pedestals + dragon statues
    pedestal(img, 40, 150, 96, FLOOR, random.Random(21))
    pedestal(img, W - 96, 150, W - 40, FLOOR, random.Random(22))
    dragon_statue(img, 22, 66, 1.0, RED, flip=False)
    dragon_statue(img, W - 122, 66, 1.0, BLUE, flip=True)

    # banners (hang from top, over the pillars)
    banner(img, 8, 12, 46, 96, RED)
    banner(img, W - 54, 12, 46, 96, BLUE)

    # braziers at pillar bases
    brazier(img, 111, FLOOR - 2, RED, fh=18)
    brazier(img, W - 111, FLOOR - 2, BLUE, fh=18)

    vignette(img, 0.55)
    return img.resize((1920, 1080), Image.NEAREST)


# ═══════════════ PORTRAIT ═══════════════
def make_portrait():
    W, H = 270, 585
    img = Image.new("RGB", (W, H), (8, 7, 10))
    d = ImageDraw.Draw(img)
    rnd = random.Random(51)
    stone_wall(img, 0, 0, W, H, rnd)
    spires(d, W, 110, (12, 11, 15), random.Random(7))
    warm_glow(img, W // 2, 300, 220, (24, 11, 6), 0.4)
    FLOOR = 470
    floor(img, W, H, FLOOR, rnd)

    # tall side pillars down both edges
    arch_pillar(img, 0, 150, FLOOR, 30, random.Random(13))
    arch_pillar(img, W - 30, 150, FLOOR, 30, random.Random(14))

    # dragon statues on side pedestals below the banners
    pedestal(img, 0, 300, 44, 360, random.Random(23))
    pedestal(img, W - 44, 300, W, 360, random.Random(24))
    dragon_statue(img, -6, 214, 0.9, RED, flip=False)
    dragon_statue(img, W - 84, 214, 0.9, BLUE, flip=True)

    # banners top corners
    banner(img, 4, 16, 44, 92, RED)
    banner(img, W - 48, 16, 44, 92, BLUE)

    # braziers lower on the pillars
    brazier(img, 15, FLOOR - 6, RED, fh=20)
    brazier(img, W - 15, FLOOR - 6, BLUE, fh=20)

    vignette(img, 0.5)
    return img.resize((1080, 2340), Image.NEAREST)


if __name__ == "__main__":
    out = "/tmp/claude-0/-home-user-mygame/b52cdc70-4740-5ae6-8457-a11a6b857399/scratchpad"
    make_landscape().save(out + "/bg-landscape.png")
    make_portrait().save(out + "/bg-portrait.png")
    print("done")
