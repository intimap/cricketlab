"""Generate Lord's layered pixel scenery: python3 tools/art/make_lords.py.

Pillow is the only dependency. Paths are relative to this script, and seeded
crowds/brickwork make regeneration byte-for-byte repeatable.
"""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parents[2]
TRANSPARENT = (0, 0, 0, 0)
PAL = {
    "brick": "#9c3826", "brick_dark": "#702d24", "brick_light": "#b6553b",
    "roof": "#38414a", "roof_light": "#58636c", "stone": "#ded8c4",
    "stone_dark": "#aaa891", "window": "#263d46", "gold": "#d4b45d",
    "pod": "#eff2f6", "glass": "#52829a", "glass_dark": "#345868",
    "fence": "#f5f4e8", "shadow": "#294b28", "board": "#162a1e",
}
BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
SHIRTS = ("#e8e8e8", "#8c2222", "#203864", "#2d5a32")
SKIN = ("#e7bb91", "#bd8960", "#845b3d", "#f0cfac")
FONT = {
    "L": ("100", "100", "100", "100", "111"),
    "O": ("111", "101", "101", "101", "111"),
    "R": ("110", "101", "110", "101", "101"),
    "D": ("110", "101", "101", "101", "110"),
    "S": ("111", "100", "111", "001", "111"),
    "'": ("1", "1", "0", "0", "0"),
}


def canvas(width, height):
    return Image.new("RGBA", (width, height), TRANSPARENT)


def rgb(colour):
    return tuple(bytes.fromhex(colour.lstrip("#")))


def sky(height):
    image = canvas(640, height)
    pixels = image.load()
    start, end = rgb("#729ecb"), rgb("#c4d8ea")
    for y in range(height):
        level = y / (height - 1) * 16
        low = math.floor(level)
        for x in range(640):
            t = min(16, low + (BAYER[y % 4][x % 4] / 16 < level - low)) / 16
            pixels[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(start, end)) + (255,)
    return image


def crowd(draw, box, rng, tiny=False):
    x0, y0, x1, y1 = box
    step = 3 if tiny else 4
    draw.rectangle(box, fill="#344d3c")
    for row, y in enumerate(range(y0, y1 - 2, step)):
        draw.line((x0, y + step - 1, x1, y + step - 1), fill="#23382c")
        for x in range(x0 + row % 2, x1 - 1, 3):
            if rng.random() < 0.12:
                continue
            draw.point((x, y), fill=rng.choice(SKIN))
            draw.line((x, y + 1, x + 1, y + 1), fill=rng.choice(SHIRTS))
            if rng.random() < 0.55:
                draw.line((x - 1, y - 1, x + 1, y - 1), fill="#e8e8e8")


def lettering(draw, text, x, y):
    for char in text:
        for row, bits in enumerate(FONT[char]):
            for col, bit in enumerate(bits):
                if bit == "1":
                    draw.point((x + col, y + row), fill=PAL["stone"])
        x += 2 if char == "'" else 4


def arched_window(draw, x, y, width=7, height=9):
    draw.ellipse((x, y, x + width - 1, y + 5), fill=PAL["stone"])
    draw.rectangle((x, y + 3, x + width - 1, y + height), fill=PAL["stone"])
    draw.ellipse((x + 1, y + 1, x + width - 2, y + 5), fill=PAL["window"])
    draw.rectangle((x + 1, y + 3, x + width - 2, y + height - 1), fill=PAL["window"])
    draw.line((x + width // 2, y + 2, x + width // 2, y + height - 1), fill=PAL["stone_dark"])
    draw.line((x + 1, y + 5, x + width - 2, y + 5), fill=PAL["stone_dark"])


def pavilion(width=360, height=60):
    image = canvas(360, 60)
    d = ImageDraw.Draw(image)
    rng = random.Random(1877)
    d.rectangle((4, 27, 355, 59), fill=PAL["brick"])
    # Short mortar runs, rather than a flat red facade.
    for y in range(29, 59, 3):
        d.line((5, y, 354, y), fill=PAL["brick_dark"])
        for x in range(5 + (y % 2) * 3, 354, 7):
            d.point((x, y + 1), fill=PAL["brick_light"])
    for x0, x1, peak in [(3, 83, 17), (79, 158, 20), (201, 280, 20), (276, 356, 17)]:
        center = (x0 + x1) // 2
        d.polygon([(x0, 28), (x0 + 5, 23), (center, peak), (x1 - 5, 23), (x1, 28)], fill=PAL["roof"])
        d.line((x0 + 4, 24, center, peak, x1 - 4, 24), fill=PAL["roof_light"])
        for chimney in (x0 + 15, x1 - 15):
            d.rectangle((chimney, peak - 2, chimney + 3, peak + 5), fill=PAL["brick_dark"])
            d.line((chimney - 1, peak - 2, chimney + 4, peak - 2), fill=PAL["stone_dark"])
    for x in range(14, 349, 13):
        arched_window(d, x, 30, 7, 9)
        arched_window(d, x, 44, 7, 10)
    # Cream galleries and their individual stone balusters.
    for y in (41, 56):
        d.line((3, y, 356, y), fill=PAL["stone"])
        d.line((3, y + 2, 356, y + 2), fill=PAL["stone_dark"])
        for x in range(5, 356, 5):
            d.line((x, y, x, y + 2), fill=PAL["stone"])
    # Projecting gables and corner pavilions break up the long gallery frontage.
    for cx in (42, 112, 247, 317):
        d.rectangle((cx - 10, 25, cx + 10, 57), fill=PAL["brick"])
        d.polygon([(cx - 13, 26), (cx, 15), (cx + 13, 26)], fill=PAL["roof"])
        d.line((cx - 11, 26, cx + 11, 26), fill=PAL["stone"])
        arched_window(d, cx - 3, 30)
        arched_window(d, cx - 3, 44)
        d.line((cx - 10, 42, cx + 10, 42), fill=PAL["stone"])
    # Central clock tower, slate cap and a miniature Father Time with his scythe.
    cx = 180
    d.rectangle((cx - 12, 17, cx + 12, 58), fill=PAL["brick_dark"])
    d.rectangle((cx - 10, 16, cx + 10, 57), fill=PAL["brick"])
    d.polygon([(cx - 15, 17), (cx, 8), (cx + 15, 17)], fill=PAL["roof"])
    d.line((cx - 13, 17, cx + 13, 17), fill=PAL["stone"])
    d.ellipse((cx - 5, 19, cx + 5, 29), fill=PAL["stone_dark"])
    d.ellipse((cx - 4, 20, cx + 4, 28), fill=PAL["stone"])
    d.line((cx, 21, cx, 24, cx + 3, 25), fill=PAL["roof"])
    for dx, dy in ((0, -4), (4, 0), (0, 4), (-4, 0)):
        d.point((cx + dx, 24 + dy), fill=PAL["brick_dark"])
    arched_window(d, cx - 3, 33, 7, 10)
    d.rectangle((cx - 16, 47, cx + 16, 54), fill=PAL["brick_dark"])
    lettering(d, "LORD'S", cx - 11, 48)
    d.line((cx, 6, cx, 10), fill=PAL["gold"])
    d.line((cx - 5, 7, cx + 5, 7), fill=PAL["gold"])
    d.rectangle((cx - 3, 0, cx - 2, 1), fill=PAL["gold"])  # head
    d.polygon([(cx - 3, 2), (cx - 1, 3), (cx - 2, 5), (cx - 4, 4)], fill=PAL["gold"])
    d.line((cx - 3, 4, cx - 4, 6), fill=PAL["gold"])
    d.line((cx - 2, 4, cx, 6), fill=PAL["gold"])
    d.line((cx - 1, 3, cx + 2, 2), fill=PAL["gold"])
    d.line((cx + 2, 0, cx + 2, 6), fill=PAL["gold"])  # scythe handle
    d.line((cx + 2, 0, cx + 6, 0, cx + 7, 1), fill=PAL["gold"])
    crowd(d, (6, 58, 354, 59), rng)
    return image if (width, height) == image.size else image.resize((width, height), Image.Resampling.NEAREST)


def trees(d, rng, baseline):
    for x in range(-8, 650, 12):
        radius = rng.randrange(5, 11)
        top = baseline - rng.randrange(9, 19)
        d.ellipse((x - radius, top, x + radius, baseline), fill=rng.choice(("#385b38", "#476c42", "#5d7b4b")))


def canopies(d, start, end, top, base, rng, tiny=False):
    crowd(d, (start, top + 9, end - 1, base), rng, tiny)
    for x in range(start, end, 43):
        right = min(end - 1, x + 42)
        middle = (x + right) // 2
        d.polygon([(x, top + 9), (middle, top), (right, top + 9)], fill="#f4eedb")
        d.line((middle, top + 1, middle + 1, top + 9), fill="#b9c2b5")
        d.line((x, top + 9, right, top + 9), fill="#959e92")
        d.line((x + 1, top + 9, x + 1, base), fill=PAL["stone"])


def media_pod(image, x, y, width, height, base):
    d = ImageDraw.Draw(image)
    for leg in (x + width // 3, x + width * 2 // 3):
        d.polygon([(leg - 2, y + height - 3), (leg + 3, y + height - 3),
                   (leg + 1, base), (leg - 2, base)], fill="#c0ccd2")
        d.line((leg - 2, y + height, leg - 2, base), fill="#eff2f6")
    pod = canvas(width, height)
    p = ImageDraw.Draw(pod)
    p.ellipse((0, 0, width - 1, height - 1), fill="#8297a2")
    p.ellipse((1, 0, width - 2, height - 2), fill=PAL["pod"])
    glass = canvas(width, height)
    g = ImageDraw.Draw(glass)
    g.polygon([(3, height // 3), (width - 4, height // 3 - 2),
               (width - 5, height * 2 // 3), (6, height * 2 // 3 + 3)], fill=PAL["glass"])
    g.line((4, height // 3, width - 5, height // 3 - 2), fill=PAL["glass_dark"])
    for col in range(12, width - 8, 12):
        g.line((col, height // 3, col - 2, height * 2 // 3 + 1), fill="#88a7b4")
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).ellipse((2, 1, width - 3, height - 3), fill=255)
    # Mask the curved glass to the pod silhouette without antialiasing.
    glass.putalpha(ImageChops.multiply(glass.getchannel("A"), mask))
    pod.alpha_composite(glass)
    image.alpha_composite(pod, (x, y))


def stands(wide=False):
    image = canvas(640, 46 if wide else 60)
    d = ImageDraw.Draw(image)
    rng = random.Random(1890 if wide else 1814)
    if wide:
        # A continuous wooded rim below the 60px sky; no transparent gaps to the field at row 107.
        d.rectangle((0, 9, 639, 45), fill="#385b38")
    trees(d, rng, 18 if wide else 46)
    if wide:
        canopies(d, 0, 87, 22, 45, rng, True)
        canopies(d, 308, 640, 23, 45, rng, True)
        image.alpha_composite(pavilion(220, 44), (86, 0))
        media_pod(image, 452, 0, 98, 24, 44)
        d = ImageDraw.Draw(image)
        d.rectangle((560, 12, 627, 41), fill="#394c35")
        d.rectangle((562, 14, 625, 39), fill=PAL["stone_dark"])
        # Global face: x=565, y=67 (layer y=51), 57x21. grounds.js writes the live score here.
        d.rectangle((565, 16, 621, 36), fill=PAL["board"])
        d.line((559, 12, 628, 12), fill=PAL["stone"])
    else:
        canopies(d, 377, 640, 30, 59, rng)
        image.alpha_composite(pavilion(), (16, 0))
        media_pod(image, 500, 5, 124, 31, 56)
        crowd(ImageDraw.Draw(image), (2, 54, 374, 59), rng)
    return image


def fence(wide=False):
    image = canvas(640, 14 if wide else 12)
    d = ImageDraw.Draw(image)
    if wide:
        # Grass behind the slats bridges the stands' foot (row 97) to the coded outfield (107).
        d.rectangle((0, 4, 639, 13), fill=PAL["shadow"])
    for x in range(640):
        base = 12 - round(8 * ((x - 318.5) / 320) ** 2) if wide else 9
        top = max(0, base - 8)
        d.line((x, base, x, image.height - 1), fill=PAL["shadow"])
        for rail in (top + 2, base - 2):
            d.point((x, rail), fill=PAL["fence"])
        if x % 7 in (2, 3):
            d.line((x, top + 1, x, base), fill=PAL["fence"])
        if x % 7 == 2:
            d.point((x, top), fill=PAL["fence"])
        d.point((x, min(image.height - 1, base + 1)), fill=PAL["fence"])  # boundary rope
    return image


def main():
    for view, height in (("close", 124), ("wide", 60)):
        folder = ROOT / "assets" / view
        folder.mkdir(parents=True, exist_ok=True)
        for layer, image in (("sky", sky(height)), ("stands", stands(view == "wide")), ("fence", fence(view == "wide"))):
            path = folder / f"lords-{layer}.png"
            image.save(path, optimize=True)
            print(f"{path.relative_to(ROOT)}: {image.width}x{image.height} {image.mode}")


if __name__ == "__main__":
    main()
