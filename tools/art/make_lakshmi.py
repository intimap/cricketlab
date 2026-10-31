#!/usr/bin/env python3
"""Generate scenery layers for 'Lakshmi Bluff' (Himalayan Foothills Ground)."""
from pathlib import Path
import math
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
CLOSE_DIR = ROOT / "assets/close"
WIDE_DIR = ROOT / "assets/wide"

def bayer_dither(val, x, y):
    bayer = [
        [ 0,  8,  2, 10],
        [12,  4, 14,  6],
        [ 3, 11,  1,  9],
        [15,  7, 13,  5]
    ]
    threshold = (bayer[y % 4][x % 4] / 16.0 - 0.5) * 18
    return max(0, min(255, int(val + threshold)))

# -------------------------------------------------------------
# 1. CLOSE VIEW SCENERY (640px wide)
# -------------------------------------------------------------

# (a) High-altitude Sky (640 x 124)
def make_close_sky():
    img = Image.new("RGBA", (640, 124), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(124):
        t = y / 123.0
        r = int(32 + (130 - 32) * t)
        g = int(88 + (178 - 88) * t)
        b = int(164 + (232 - 164) * t)
        for x in range(640):
            d.point((x, y), fill=(bayer_dither(r, x, y), bayer_dither(g, x, y), bayer_dither(b, x, y), 255))
    img.save(f"{CLOSE_DIR}/lakshmi-sky.png")

# (b) Snow-capped Himalayan Mountains (640 x 90, transparent)
def make_close_mountains():
    img = Image.new("RGBA", (640, 90), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    # Sharp Himalayan ridge profile
    peaks = [(0, 65), (70, 32), (120, 50), (180, 18), (230, 42), (290, 12), 
             (360, 38), (420, 15), (480, 48), (540, 22), (600, 45), (640, 60)]
    
    # Draw dark shadow mountain silhouette first
    poly = [(0, 90)] + peaks + [(640, 90)]
    d.polygon(poly, fill=(58, 82, 112, 255))
    
    # Add snow facets and glacial sunlit ridges (sun from top-left)
    for i in range(len(peaks) - 1):
        x1, y1 = peaks[i]
        x2, y2 = peaks[i+1]
        mid_x = (x1 + x2) // 2
        # Sunlit snow face
        snow_poly = [(x1, y1), (mid_x, (y1 + y2) // 2 + 16), (x1, min(90, y1 + 35))]
        d.polygon(snow_poly, fill=(240, 246, 255, 255))
        # Ridge highlight
        d.line([(x1, y1), (mid_x, (y1 + y2) // 2 + 16)], fill=(255, 255, 255, 255), width=1)
        # Deep shadow crevasse
        d.polygon([(mid_x, (y1 + y2) // 2 + 16), (x2, y2), (x2, min(90, y2 + 25))], fill=(42, 60, 84, 255))

    img.save(f"{CLOSE_DIR}/lakshmi-mountains.png")

# (c) Foothills, Deodar Pine Ridge & Temple (640 x 74, transparent)
def make_close_foothills():
    img = Image.new("RGBA", (640, 74), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    # Rolling green/slate foothill ridge
    for x in range(640):
        hill_y = int(32 + 14 * math.sin(x * 0.015) + 6 * math.cos(x * 0.035))
        d.line([(x, hill_y), (x, 74)], fill=(42, 68, 44, 255))
        # Lighter terrace accents
        if hill_y + 12 < 74:
            d.line([(x, hill_y + 12), (x, hill_y + 14)], fill=(72, 98, 56, 255))

    # Dense Himalayan pine/deodar spires along the ridges
    for px in range(10, 630, 9):
        py = int(30 + 14 * math.sin(px * 0.015) + 6 * math.cos(px * 0.035))
        h = 10 + (px % 7)
        # Pine tree triangle
        d.polygon([(px, py - h), (px - 4, py), (px + 4, py)], fill=(22, 44, 24, 255))
        d.polygon([(px, py - h + 3), (px - 3, py - 1), (px + 3, py - 1)], fill=(32, 60, 36, 255))

    # Small hilltop shrine/temple at x=510
    tx, ty = 510, 18
    # Temple base
    d.rectangle([tx - 12, ty + 10, tx + 12, ty + 24], fill=(138, 72, 54, 255))
    # Tiered pagoda roof
    d.polygon([(tx, ty), (tx - 18, ty + 10), (tx + 18, ty + 10)], fill=(210, 160, 48, 255))
    d.polygon([(tx, ty - 3), (tx - 10, ty + 4), (tx + 10, ty + 4)], fill=(180, 130, 30, 255))

    # Fluttering prayer flags (lungta) on poles near the temple
    colors = [(40, 100, 220), (240, 240, 240), (220, 40, 40), (30, 160, 60), (240, 210, 30)]
    d.line([(450, 22), (490, 28)], fill=(180, 170, 150, 255), width=1)
    for i, fx in enumerate(range(452, 488, 7)):
        fy = int(22 + (fx - 450) * 0.15)
        c = colors[i % len(colors)]
        d.polygon([(fx, fy), (fx + 5, fy + 1), (fx + 2, fy + 6)], fill=(c[0], c[1], c[2], 255))

    img.save(f"{CLOSE_DIR}/lakshmi-foothills.png")

# (d) Rustic Dry-Stone Wall, Cows & Scorers' Hut (640 x 30, transparent)
def make_close_boundary():
    img = Image.new("RGBA", (640, 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 1. Grassy terrace bank behind the stone wall
    d.rectangle([0, 12, 640, 20], fill=(95, 122, 54, 255))

    # 2. Rustic dry-stone wall (rows 20-30)
    for y in range(20, 30):
        for x in range(640):
            # Irregular slate/stone blocks with mortar
            stone = ((x // 12 + y // 3) % 3)
            base = 80 + stone * 22
            # Occasional moss/lime specks
            if (x * 7 + y * 13) % 29 == 0:
                d.point((x, y), fill=(160, 170, 140, 255))
            else:
                d.point((x, y), fill=(base, base + 4, base + 8, 255))
    # Wall top coping stones
    d.line([(0, 19), (640, 19)], fill=(130, 134, 138, 255))

    # 3. Small wooden/tin scorer's shed at left (x=70)
    sx, sy = 70, 4
    d.rectangle([sx, sy + 6, sx + 28, sy + 16], fill=(120, 85, 55, 255)) # Timber body
    d.polygon([(sx - 3, sy + 6), (sx + 14, sy), (sx + 31, sy + 6)], fill=(140, 145, 150, 255)) # Tin roof
    # Window with scoreboard numbers
    d.rectangle([sx + 6, sy + 9, sx + 14, sy + 13], fill=(20, 20, 20, 255))
    d.point((sx + 8, sy + 11), fill=(240, 220, 60, 255))
    d.point((sx + 11, sy + 11), fill=(240, 220, 60, 255))

    # 4. Indian Zebu Cattle resting & grazing on the grass bank!
    # Cow 1: Resting hump-backed white/grey cow at x=210
    cx, cy = 210, 10
    # Body (resting on ground)
    d.ellipse([cx, cy + 3, cx + 18, cy + 10], fill=(230, 228, 222, 255))
    # Shoulder hump
    d.ellipse([cx + 11, cy, cx + 16, cy + 5], fill=(210, 208, 202, 255))
    # Head & gentle curved horns
    d.rectangle([cx + 15, cy + 1, cx + 19, cy + 6], fill=(225, 222, 216, 255))
    d.line([(cx + 16, cy), (cx + 15, cy - 2)], fill=(60, 55, 50, 255)) # Horn 1
    d.line([(cx + 18, cy), (cx + 19, cy - 2)], fill=(60, 55, 50, 255)) # Horn 2
    d.point((cx + 18, cy + 3), fill=(40, 40, 40, 255)) # Eye

    # Cow 2: Standing brown/white spotted grazing cow at x=380
    cx2, cy2 = 380, 5
    # Slender legs
    d.line([(cx2 + 2, cy2 + 9), (cx2 + 2, cy2 + 15)], fill=(140, 85, 45, 255))
    d.line([(cx2 + 6, cy2 + 9), (cx2 + 6, cy2 + 15)], fill=(130, 80, 40, 255))
    d.line([(cx2 + 14, cy2 + 9), (cx2 + 14, cy2 + 15)], fill=(140, 85, 45, 255))
    d.line([(cx2 + 17, cy2 + 9), (cx2 + 17, cy2 + 15)], fill=(130, 80, 40, 255))
    # Body
    d.ellipse([cx2, cy2 + 2, cx2 + 19, cy2 + 10], fill=(150, 95, 55, 255))
    # White belly patch
    d.ellipse([cx2 + 5, cy2 + 5, cx2 + 13, cy2 + 9], fill=(235, 235, 230, 255))
    # Hump
    d.ellipse([cx2 + 12, cy2 - 1, cx2 + 16, cy2 + 4], fill=(135, 80, 40, 255))
    # Neck & low grazing head
    d.polygon([(cx2 + 16, cy2 + 3), (cx2 + 22, cy2 + 9), (cx2 + 18, cy2 + 11)], fill=(150, 95, 55, 255))
    d.point((cx2 + 21, cy2 + 8), fill=(40, 30, 25, 255)) # Eye

    img.save(f"{CLOSE_DIR}/lakshmi-boundary.png")

# -------------------------------------------------------------
# 2. WIDE VIEW SCENERY (640px wide)
# -------------------------------------------------------------

def make_wide_sky():
    img = Image.new("RGBA", (640, 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(60):
        t = y / 59.0
        r = int(32 + (130 - 32) * t)
        g = int(88 + (178 - 88) * t)
        b = int(164 + (232 - 164) * t)
        for x in range(640):
            d.point((x, y), fill=(bayer_dither(r, x, y), bayer_dither(g, x, y), bayer_dither(b, x, y), 255))
    img.save(f"{WIDE_DIR}/lakshmi-sky.png")

def make_wide_mountains():
    img = Image.new("RGBA", (640, 70), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    peaks = [(0, 45), (80, 20), (160, 36), (240, 10), (330, 30), (410, 8), (490, 32), (570, 16), (640, 40)]
    poly = [(0, 70)] + peaks + [(640, 70)]
    d.polygon(poly, fill=(58, 82, 112, 255))
    for i in range(len(peaks) - 1):
        x1, y1 = peaks[i]
        x2, y2 = peaks[i+1]
        mid_x = (x1 + x2) // 2
        d.polygon([(x1, y1), (mid_x, (y1 + y2) // 2 + 10), (x1, 70)], fill=(240, 246, 255, 255))
        d.line([(x1, y1), (mid_x, (y1 + y2) // 2 + 10)], fill=(255, 255, 255, 255), width=1)
    img.save(f"{WIDE_DIR}/lakshmi-mountains.png")

def make_wide_foothills():
    img = Image.new("RGBA", (640, 86), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for x in range(640):
        hy = int(24 + 10 * math.sin(x * 0.018))
        d.line([(x, hy), (x, 86)], fill=(40, 65, 42, 255))
    for px in range(8, 632, 12):
        py = int(24 + 10 * math.sin(px * 0.018))
        d.polygon([(px, py - 8), (px - 3, py), (px + 3, py)], fill=(20, 40, 22, 255))
    # Tiny white/grey dot cows grazing in the far meadow
    d.ellipse([220, 52, 225, 55], fill=(230, 228, 220, 255))
    d.ellipse([390, 48, 396, 52], fill=(160, 100, 60, 255))
    # Timber scoreboard on posts: live face at global (522, 66), 56 x 20.
    for post in (523, 576):
        d.rectangle((post, 66, post + 2, 84), fill="#705038")
    d.rectangle((519, 45, 580, 69), fill="#9d774e")
    d.line((518, 44, 581, 44), fill="#c6aa76")
    d.rectangle((522, 48, 577, 67), fill="#24211d")
    img.save(f"{WIDE_DIR}/lakshmi-foothills.png")

def make_wide_boundary():
    img = Image.new("RGBA", (640, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Low stone boundary wall at bottom of wide scenery
    d.rectangle([0, 10, 640, 20], fill=(85, 90, 95, 255))
    d.line([(0, 9), (640, 9)], fill=(125, 130, 135, 255))
    # Rustic timber pavilion / scorer box
    d.rectangle([520, 2, 550, 15], fill=(120, 85, 55, 255))
    d.polygon([(517, 2), (535, -2), (553, 2)], fill=(190, 150, 40, 255))
    img.save(f"{WIDE_DIR}/lakshmi-boundary.png")

if __name__ == "__main__":
    CLOSE_DIR.mkdir(parents=True, exist_ok=True)
    WIDE_DIR.mkdir(parents=True, exist_ok=True)
    print("Generating Lakshmi Bluff scenery layers...")
    make_close_sky()
    make_close_mountains()
    make_close_foothills()
    make_close_boundary()
    make_wide_sky()
    make_wide_mountains()
    make_wide_foothills()
    make_wide_boundary()
    print("Done! All assets generated.")

