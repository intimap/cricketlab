"""Generate continuous wide-camera ground rims with Pillow.

Run from any directory. The boundary ellipse is read from camera.js, so art,
fielders and the rope share one geometry. Every playable field pixel stays clear.
"""
from pathlib import Path
import math
import re
from PIL import Image, ImageDraw, ImageChops
from make_lords import pavilion as lords_pavilion, media_pod
from make_scg import pavilion as scg_pavilion

ROOT = Path(__file__).resolve().parents[2]
W, H = 640, 360
source = (ROOT / "src/render/camera.js").read_text()
rope_literal = re.search(r"export const ROPE = \{([^}]+)\}", source).group(1)
ROPE = {key: float(re.search(rf"\b{key}:\s*([\d.]+)", rope_literal).group(1))
        for key in ("cx", "cy", "rx", "ryFar", "ryNear")}
# Venue colours match their distant art. The rustic highlands have no stadium seating.
VENUES = {
    "parklands": dict(kind="picket", seat="#365345", slab="#b7b4a0", path="#9d997e", trees=True),
    "parklands-boards": dict(kind="boards", seat="#365345", slab="#b7b4a0", path="#9d997e", trees=True),
    "mcg": dict(kind="stadium", seat="#263f54", slab="#8795a4", path="#48545b", tiers=True),
    "lords": dict(kind="picket", seat="#314b3d", slab="#ded8c4", path="#b0aa92", members=True),
    "scg": dict(kind="stadium", seat="#1c4e5e", slab="#dcdfe4", path="#7c8c91", tiers=True),
    "lakshmi": dict(kind="stone", seat="#45613b", slab="#858a8f", path="#8b7954"),
}
SHIRTS = ("#e8e8e8", "#c44d36", "#203864", "#d4bd62", "#2d5a32", "#7e9da7")
MEMBERS = ("#e8e8e8", "#8c2222", "#203864", "#2d5a32")
SKIN = ("#dfb18b", "#ad7954", "#785139")
ADS = ("#d82424", "#18522e", "#1c52b8", "#f0f0f0")


def rgb(colour):
    return tuple(bytes.fromhex(colour.lstrip("#")))


def shade(colour, amount):
    return tuple(max(0, min(255, c + amount)) for c in rgb(colour))


def noise(x, y, seed=1):
    value = ((x * 374761393 + y * 668265263 + seed * 1442695041) & 0xffffffff)
    value = ((value ^ (value >> 13)) * 1274126177) & 0xffffffff
    return (value ^ (value >> 16)) / 2**32


def location(x, y):
    ry = ROPE["ryFar"] if y < ROPE["cy"] else ROPE["ryNear"]
    nx, ny = (x - ROPE["cx"]) / ROPE["rx"], (y - ROPE["cy"]) / ry
    radius = math.hypot(nx, ny)
    angle = math.atan2(ny, nx)
    # Projected terrace depth: rows widen in the side-on portions of the bowl.
    return radius, (radius - 1) * ry, angle


def hoarding(depth, around):
    colour = ADS[(around // 22) % len(ADS)]
    if depth < 0.35:
        return rgb("#c4c8c1")
    if depth > 1.85:
        return rgb("#283a38")
    # Tiny abstract LED lettering and separators instead of licensed advertising.
    if around % 22 == 0:
        return rgb("#263a3d")
    if 0.65 < depth < 1.45 and around % 3:
        return rgb("#34434d" if colour == "#f0f0f0" else "#f5f4e8")
    return rgb(colour)


def fence(depth, around, venue):
    if venue["kind"] in ("stadium", "boards"):
        return hoarding(depth, around)
    if venue["kind"] == "picket":
        if around % 3 == 0 or 0.5 < depth < 0.8 or 1.4 < depth < 1.7:
            return rgb("#f5f4e8")
        return rgb("#344c37")
    # Individual slate blocks follow the wall rather than a straight horizon.
    block = int(depth * 2)
    mortar = around % 9 == (block % 2) * 4 or depth % 0.75 < 0.13
    return rgb("#505a58") if mortar else shade("#858a8f", int(noise(around // 9, block) * 26) - 13)


def seating(depth, around, venue):
    if depth < 4.8:
        return shade(venue["path"], int(noise(around, int(depth * 2)) * 10) - 5)
    row = int((depth - 4.8) / 3.2)
    phase = (depth - 4.8) % 3.2
    # Concrete/stone balcony lips and radial access aisles break up the crowd.
    if venue.get("tiers") and row % 5 == 4:
        return shade(venue["slab"], -25 if phase < 0.8 else 0)
    if around % 83 in (0, 1, 2, 3):
        return shade(venue["slab"], -25)
    if phase > 2.4:
        return shade(venue["seat"], -18)
    cell = around // 3
    if noise(cell, row, 11) < 0.17:
        return rgb(venue["seat"])
    slot = around % 3
    if phase < 0.8 and slot == 1:
        return rgb(SKIN[int(noise(cell, row, 7) * len(SKIN))])
    if 0.8 <= phase < 1.7 and slot in (1, 2):
        shirts = MEMBERS if venue.get("members") else SHIRTS
        return rgb(shirts[int(noise(cell, row, 9) * len(shirts))])
    if phase < 0.5 and noise(cell, row, 5) > 0.65:
        return rgb("#e8e8df")  # Hats, especially prominent on the members' terraces.
    return shade(venue["seat"], 4 if slot == 0 else -4)


def highland_bank(depth, around, x, y):
    if depth < 4.5:
        return shade("#8b7954", int(noise(x, y) * 14) - 7)
    terrace = int((depth - 4.5) / 7)
    if (depth - 4.5) % 7 < 0.9:
        return rgb("#596348")
    base = "#45613b" if terrace % 2 else "#597342"
    if noise(x, y, 7) < 0.05:
        return rgb("#a58c61")
    return shade(base, int(noise(x, y, 3) * 14) - 7)


def pine(d, x, y, height):
    d.line((x, y - height, x, y), fill="#59472c")
    for offset in (0, 4, 8):
        width = 4 + offset // 2
        d.polygon([(x, y - height + offset), (x - width, y - 3 + offset // 2),
                   (x + width, y - 3 + offset // 2)], fill="#183b29" if offset % 8 else "#254a30")


def far_rim_top(x):
    """The outer far terrace curves above the rope, covering the old straight fence."""
    far_rope = ROPE["cy"] - ROPE["ryFar"]
    across = (x - ROPE["cx"]) / (ROPE["rx"] + 94)
    return round(far_rope - 34 * math.sqrt(max(0, 1 - across * across)))


def landmarks(image, name):
    """Keep distinctive buildings in front of the bowl, at their existing coordinates."""
    if name == "lords":
        image.alpha_composite(lords_pavilion(220, 44), (86, 51))
        media_pod(image, 452, 51, 98, 24, 95)
    elif name == "scg":
        image.alpha_composite(scg_pavilion(170, True).resize((113, 44), Image.Resampling.NEAREST), (65, 42))
        image.alpha_composite(scg_pavilion(137).resize((93, 39), Image.Resampling.NEAREST), (179, 47))
    # These small, rectangular structures already contain the correctly placed
    # score faces. Copy their frames too, so live text stays anchored to the art.
    boards = {
        "parklands": ("assets/wide/stands.png", (525, 4, 585, 46), (525, 55)),
        "parklands-boards": ("assets/wide/stands.png", (525, 4, 585, 46), (525, 55)),
        "mcg": ("assets/theg/wide/stands.png", (518, 5, 582, 33), (518, 51)),
        "lords": ("assets/wide/lords-stands.png", (559, 12, 629, 42), (559, 63)),
        "lakshmi": ("assets/wide/lakshmi-foothills.png", (518, 44, 582, 70), (518, 62)),
    }
    if name in boards:
        path, box, at = boards[name]
        with Image.open(ROOT / path) as source:
            image.alpha_composite(source.convert("RGBA").crop(box), at)


def make(venue, name):
    image = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mask = Image.new("L", (W, H), 0)
    pixels, alpha = image.load(), mask.load()
    tops = [far_rim_top(x) for x in range(W)]
    top = min(tops)
    for y in range(top, H):
        for x in range(W):
            if y < tops[x]:
                continue
            radius, depth, angle = location(x, y)
            if radius <= 1:
                continue
            around = int((angle + math.pi) * 150)
            if depth < 2.2:
                colour = fence(depth, around, venue)
            elif venue["kind"] == "stone":
                colour = highland_bank(depth, around, x, y)
            else:
                colour = seating(depth, around, venue)
            if y == tops[x]:
                colour = rgb("#596348" if venue["kind"] == "stone" else venue["slab"])
            pixels[x, y] = colour + (255,)
            alpha[x, y] = 255
    # The existing parkland tree art now sits outside the oval instead of obscuring turf.
    if venue.get("trees"):
        trees = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for filename, x in (("trees-left.png", 0), ("trees-right.png", 360)):
            trees.alpha_composite(Image.open(ROOT / "assets/wide" / filename).convert("RGBA"), (x, 255))
        trees.putalpha(ImageChops.multiply(trees.getchannel("A"), mask))
        image.alpha_composite(trees)
    if venue["kind"] == "stone":
        trees = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(trees)
        for x, y in ((9, 180), (22, 234), (16, 287), (626, 170), (613, 237), (625, 287)):
            pine(d, x, y, 23 + x % 7)
        trees.putalpha(ImageChops.multiply(trees.getchannel("A"), mask))
        image.alpha_composite(trees)
    landmarks(image, name)
    return image


def main():
    for name, venue in VENUES.items():
        image = make(venue, name)
        path = ROOT / "assets/wide" / f"{name}-perimeter.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, optimize=True)
        print(f"{path.relative_to(ROOT)}: {W}x{H}")


if __name__ == "__main__":
    main()
