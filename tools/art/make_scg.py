"""Generate SCG pixel scenery with Pillow: python3 tools/art/make_scg.py.

Seeded spectators and script-relative paths keep all six layers reproducible.
The seating and hoardings overlap; no trees or grass separate them.
"""
from pathlib import Path
import random
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ROOF = "#1c482e"
ROOF_DARK = "#123420"
CREAM = "#f4ecd2"
CONCRETE = "#dcdfe4"
SEAT = "#1c4e5e"
ADS = ("#d82424", "#18522e", "#1c52b8", "#f0f0f0")
SHIRTS = ("#e9e8df", "#ddc155", "#2f7b56", "#689eae", "#bf6757")
SKIN = ("#e7bb91", "#b98058", "#82563e")
BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))


def canvas(height, width=640):
    return Image.new("RGBA", (width, height), (0, 0, 0, 0))


def sky(height):
    image = canvas(height)
    pixels = image.load()
    start, end = (50, 116, 204), (152, 196, 238)
    for y in range(height):
        level = y / (height - 1) * 24
        low = int(level)
        for x in range(640):
            t = min(24, low + (BAYER[y % 4][x % 4] / 16 < level - low)) / 24
            pixels[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(start, end)) + (255,)
    return image


def spectators(d, box, rng, tiny=False):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=SEAT)
    step = 3 if tiny else 4
    for row, y in enumerate(range(y0 + 1, y1, step)):
        d.line((x0, min(y1, y + 2), x1, min(y1, y + 2)), fill="#103441")
        for x in range(x0 + 1 + row % 2, x1, 3):
            if rng.random() < 0.15:
                continue
            d.point((x, y), fill=rng.choice(SKIN))
            d.point((x, min(y1, y + 1)), fill=rng.choice(SHIRTS))
            if rng.random() < 0.35:
                d.line((x - 1, y - 1, x + 1, y - 1), fill="#f4ecd2")


def grandstand(d, x0, x1, top, bottom, rng, tiny=False):
    """Steep two-tier seating, continuous concrete lips and cantilever roof."""
    d.rectangle((x0, top + 5, x1, bottom), fill="#717f87")
    middle = top + (bottom - top) // 2
    spectators(d, (x0 + 1, top + 7, x1 - 1, middle - 1), rng, tiny)
    spectators(d, (x0 + 1, middle + 5, x1 - 1, bottom), rng, tiny)
    d.rectangle((x0, middle, x1, middle + 2), fill=CONCRETE)
    d.line((x0, middle + 3, x1, middle + 3), fill="#6b8189")
    # Segmented cantilevers and aisle breaks give the bowl a repeating rhythm.
    for x in range(x0, x1, 46 if tiny else 58):
        right = min(x1, x + (45 if tiny else 57))
        d.polygon([(x, top + 4), (x + 7, top), (right, top + 1), (right, top + 5)], fill=CONCRETE)
        d.line((x + 4, top + 5, right, top + 5), fill="#a2b0ba")
        d.line((x + 6, top + 2, right - 3, top + 2), fill="#f6f7f8")
        d.line((x + 5, top + 6, x + 5, bottom), fill="#9eabb0")
    d.line((x0, bottom - 1, x1, bottom - 1), fill=CONCRETE)


def window(d, x, y, width=7, height=10):
    d.ellipse((x, y, x + width - 1, y + 5), fill="#c3ba9b")
    d.rectangle((x, y + 3, x + width - 1, y + height), fill="#c3ba9b")
    d.ellipse((x + 1, y + 1, x + width - 2, y + 5), fill="#27443e")
    d.rectangle((x + 1, y + 3, x + width - 2, y + height - 1), fill="#27443e")
    d.line((x + width // 2, y + 2, x + width // 2, y + height - 1), fill=CREAM)
    d.line((x + 1, y + 5, x + width - 2, y + 5), fill=CREAM)


def pavilion(width, clock=False):
    image = canvas(65, width)
    d = ImageDraw.Draw(image)
    middle = width // 2
    d.rectangle((4, 29, width - 5, 64), fill=CREAM)
    for y in range(31, 64, 3):
        d.line((5, y, width - 6, y), fill="#d7cfb5")
    # Broad corrugated green hipped roof, with projecting Victorian gables.
    d.polygon([(0, 30), (19, 18), (width - 20, 18), (width - 1, 30)], fill=ROOF_DARK)
    d.polygon([(4, 28), (20, 17), (width - 21, 17), (width - 5, 28)], fill=ROOF)
    for x in range(23, width - 20, 4):
        d.line((x, 19, x - 5, 27), fill="#306241")
    for cx in (22, width - 23):
        d.polygon([(cx - 13, 30), (cx, 17), (cx + 13, 30)], fill=CREAM)
        d.line((cx - 14, 29, cx, 16, cx + 14, 29), fill=ROOF_DARK, width=2)
        window(d, cx - 3, 23, 7, 8)
    for x in range(11, width - 10, 13):
        window(d, x, 33)
        window(d, x, 49, 7, 10)
    # Timber veranda railings and posts stay distinct from the concrete stands.
    for y in (45, 61):
        d.line((3, y, width - 4, y), fill="#fff8e4")
        d.line((3, y + 3, width - 4, y + 3), fill="#b9ad8c")
        for x in range(5, width - 4, 4):
            d.line((x, y, x, y + 3), fill=CREAM)
    for x in range(7, width - 5, 26):
        d.line((x, 30, x, 64), fill="#fff8e4")
    if clock:
        d.rectangle((middle - 9, 12, middle + 9, 44), fill=CREAM)
        d.polygon([(middle - 13, 14), (middle, 3), (middle + 13, 14)], fill=ROOF_DARK)
        d.line((middle - 10, 13, middle, 5, middle + 10, 13), fill=ROOF)
        d.line((middle, 0, middle, 4), fill="#b6a476")
        d.ellipse((middle - 6, 17, middle + 6, 29), fill="#b6a476")
        d.ellipse((middle - 5, 18, middle + 5, 28), fill="#fff8e4")
        d.line((middle, 19, middle, 23, middle + 3, 24), fill=ROOF_DARK)
        window(d, middle - 3, 33, 7, 8)
    else:
        d.polygon([(middle - 19, 30), (middle, 12), (middle + 19, 30)], fill=CREAM)
        d.line((middle - 20, 29, middle, 11, middle + 20, 29), fill=ROOF_DARK, width=2)
        window(d, middle - 3, 21, 7, 9)
    return image


def floodlight(d, x, top, bottom, tiny=False):
    width = 5 if tiny else 8
    d.line((x, top + 4, x - 1, bottom), fill="#adbcc8", width=2)
    d.line((x + 2, top + 4, x + 3, bottom), fill="#596f7e")
    d.rectangle((x - width, top, x + width, top + 4), fill="#8f9fac")
    for col in range(x - width + 1, x + width, 3):
        d.line((col, top + 1, col, top + 2), fill="#eef4ee")


def stands(wide=False):
    image = canvas(54 if wide else 82)
    d = ImageDraw.Draw(image)
    rng = random.Random(1848 if wide else 1882)
    bottom = image.height - 1
    # Continuous seating down to the last row: it sits immediately behind ads.
    spectators(d, (0, 20 if wide else 52, 639, bottom), rng, wide)
    if wide:
        grandstand(d, 0, 65, 12, 42, rng, True)
        grandstand(d, 273, 639, 3, 44, rng, True)
        image.alpha_composite(pavilion(170, True).resize((113, 44), Image.Resampling.NEAREST), (65, 2))
        image.alpha_composite(pavilion(137).resize((93, 39), Image.Resampling.NEAREST), (179, 7))
        d = ImageDraw.Draw(image)
        floodlight(d, 23, 0, 20, True)
        floodlight(d, 615, 0, 19, True)
        spectators(d, (0, 45, 639, bottom), rng, True)
    else:
        grandstand(d, 0, 90, 9, 70, rng)
        grandstand(d, 368, 639, 0, 70, rng)
        image.alpha_composite(pavilion(158, True), (91, 5))
        image.alpha_composite(pavilion(118), (250, 5))
        d = ImageDraw.Draw(image)
        floodlight(d, 16, 0, 33)
        floodlight(d, 624, 0, 32)
        spectators(d, (0, 71, 639, bottom), rng)
    # A thin front railing, with seats still occupying the bottom edge.
    d.line((0, bottom - 3, 639, bottom - 3), fill=CONCRETE)
    for x in range(3, 640, 12):
        d.line((x, bottom - 3, x, bottom), fill=CONCRETE)
    return image


def fence(wide=False):
    image = canvas(14 if wide else 12)
    d = ImageDraw.Draw(image)
    if wide:
        # Seating shadow behind the curved boards, including the overlap seam.
        d.rectangle((0, 1, 639, 13), fill="#103441")
    for x in range(640):
        # A shallow curve follows the far boundary. Opaque foot rows ensure
        # the grandstand/fence join never exposes a grass strip or sky hole.
        top = round(3 * (1 - ((x - 319.5) / 320) ** 2)) if wide else 0
        base = top + 7
        colour = ADS[(x // 64) % len(ADS)]
        d.line((x, top, x, base), fill=colour)
        d.point((x, top), fill="#adb6b8")
        if x % 64 in (0, 63):
            d.line((x, top + 1, x, base), fill="#283a40")
        # Abstract LED wordmarks, avoiding any external brands or fonts.
        if x % 64 in range(10, 52) and x % 7 not in (0, 6):
            ink = "#253f4d" if colour == "#f0f0f0" else "#f5f5e9"
            d.point((x, top + 3), fill=ink)
            d.point((x, top + 5), fill=ink)
            if x % 7 in (1, 4):
                d.point((x, top + 4), fill=ink)
        d.line((x, base + 1, x, image.height - 1), fill="#243d36")
        d.point((x, min(base + 2, image.height - 1)), fill="#f5f4e8")
    return image


def main():
    for view, height in (("close", 124), ("wide", 60)):
        folder = ROOT / "assets" / view
        folder.mkdir(parents=True, exist_ok=True)
        for layer, image in (("sky", sky(height)), ("stands", stands(view == "wide")),
                             ("fence-ads", fence(view == "wide"))):
            path = folder / f"scg-{layer}.png"
            image.save(path, optimize=True)
            print(f"{path.relative_to(ROOT)}: {image.width}x{image.height} {image.mode}")


if __name__ == "__main__":
    main()
