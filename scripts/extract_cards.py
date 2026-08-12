"""Extract 60 creature cards from the 10x6 source sheet into square PNGs.

Pure crop/pad/export: proportional grid boundaries, complete-cell crops,
black-padded to square, plus a 1024x1024 LANCZOS set, validation, and a zip.
No artwork, borders, names, or number boxes are modified.
"""
import os
import zipfile
from PIL import Image

SRC = "/root/.claude/uploads/b52cdc70-4740-5ae6-8457-a11a6b857399/5f427688-25695.png"
BASE = "/home/user/mygame"
OUT_SQUARE = os.path.join(BASE, "card_placeholders")
OUT_1024 = os.path.join(BASE, "card_placeholders_1024")
ZIP_PATH = os.path.join(BASE, "card_placeholders.zip")

COLS, ROWS = 10, 6

NAMES = [
    "giant_rat", "skeleton", "sprite", "zombie", "slime",
    "kobold", "cave_bat", "goblin", "imp", "gremlin",
    "orc", "dryad", "ghoul", "satyr", "harpy",
    "giant_spider", "gargoyle", "naga", "werewolf", "cockatrice",
    "ogre", "troll", "mermaid", "centaur", "wraith",
    "minotaur", "yeti", "golem", "manticore", "basilisk",
    "pegasus", "griffin", "cerberus", "roc", "wyvern",
    "sphinx", "dullahan", "chimera", "hydra", "thunderbird",
    "unicorn", "cyclops", "gorgon", "sea_serpent", "qilin",
    "phoenix", "frost_dragon", "dragon", "behemoth", "leviathan",
    "simurgh", "fafnir", "anzu", "kraken", "fenrir",
    "ancient_dragon", "ziz", "typhon", "nidhoggr", "jormungandr",
]
assert len(NAMES) == 60

os.makedirs(OUT_SQUARE, exist_ok=True)
os.makedirs(OUT_1024, exist_ok=True)

im = Image.open(SRC).convert("RGB")
W, H = im.size
print(f"Source: {os.path.basename(SRC)}  {W}x{H}  mode={im.mode}")
print(f"Cell size (informational): {W/COLS:.4f} x {H/ROWS:.4f} px\n")

square_paths = []
n_src = 0
for idx, name in enumerate(NAMES):
    row, col = divmod(idx, COLS)

    # Proportional grid boundaries — every pixel belongs to exactly one cell.
    x0 = round(col * W / COLS)
    x1 = round((col + 1) * W / COLS)
    y0 = round(row * H / ROWS)
    y1 = round((row + 1) * H / ROWS)

    crop = im.crop((x0, y0, x1, y1))
    n_src += 1

    # Pad the shorter dimension to make a square canvas; centre; black background.
    side = max(crop.width, crop.height)
    square = Image.new("RGB", (side, side), (0, 0, 0))
    square.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))

    fname = f"{idx + 1:02d}_{name}.png"
    sq_path = os.path.join(OUT_SQUARE, fname)
    square.save(sq_path)  # lossless PNG
    square_paths.append((fname, sq_path))

    # High-res placeholder — resize the square (no sharpening).
    big = square.resize((1024, 1024), Image.Resampling.LANCZOS)
    big.save(os.path.join(OUT_1024, fname))

# ---- Validation ----
sq_files = sorted(os.listdir(OUT_SQUARE))
big_files = sorted(os.listdir(OUT_1024))
print(f"Source crops:            {n_src}")
print(f"Square original exports: {len(sq_files)}")
print(f"1024x1024 exports:       {len(big_files)}\n")

print("Dimensions of every generated file:")
for fname, sq_path in square_paths:
    sw, sh = Image.open(sq_path).size
    bw, bh = Image.open(os.path.join(OUT_1024, fname)).size
    print(f"  {fname:<22} square={sw}x{sh}   1024set={bw}x{bh}")

checks = {1: "giant_rat", 10: "gremlin", 11: "orc", 20: "cockatrice",
          21: "ogre", 30: "basilisk", 31: "pegasus", 40: "thunderbird",
          41: "unicorn", 50: "leviathan", 51: "simurgh", 60: "jormungandr"}
print("\nOrder checks:")
all_ok = True
for num, expected in checks.items():
    actual = NAMES[num - 1]
    ok = actual == expected
    all_ok = all_ok and ok
    print(f"  Card {num:02d}: {actual:<14} {'OK' if ok else 'MISMATCH (expected ' + expected + ')'}")
print("All order checks passed." if all_ok else "ORDER CHECK FAILED")

# ---- Zip the 60 square PNGs ----
with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
    for fname, sq_path in square_paths:
        zf.write(sq_path, arcname=fname)
print(f"\nWrote {ZIP_PATH} with {len(square_paths)} files.")
