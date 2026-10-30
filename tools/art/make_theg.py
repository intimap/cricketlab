# The G: a floodlit Melbourne mega-stadium at night, as layers for the close and wide views.
# Run from the repo root: python3 tools/art/make_theg.py  (writes assets/theg/close/ and assets/theg/wide/)
import os, random
from PIL import Image

# The palette helpers (C, dark, T, BAYER, crowd, SKIN/SHIRT/HAT, FONT, text) from the close-view script,
# without running its own generation, as make_scenery_wide.py does.
exec(open('tools/art/make_scenery.py').read().split('sk=sky()')[0])
FONT.update({'V':'101101101101010','X':'101101010101101','Q':'010101101111011','-':'000000111000000'})

OUT = 'assets/theg/'
for d in ('close', 'wide'): os.makedirs(OUT + d, exist_ok=True)

def crowd_tiny(p, x0, x1, y0, y1, rng, seat):
    # The wide view's crowd (as make_scenery_wide.py): a head and a shirt per person, rows of three.
    for y in range(y0, y1):
        for x in range(x0, x1): p[x, y] = C(seat) if (y - y0) % 3 != 2 else dark(C(seat), 0.7)
    for r, y in enumerate(range(y0, y1 - 1, 3)):
        for x in range(x0 + r % 2, x1, 2):
            if rng.random() < 0.08: continue
            p[x, y] = C(rng.choice(HAT) if rng.random() < 0.25 else rng.choice(SKIN))
            p[x, y + 1] = C(rng.choice(SHIRT))

def gradient(W, H, stops):
    """Night sky: colour stops (row, hex) blended with the 4x4 Bayer dither, and a scatter of stars up top."""
    im = Image.new('RGBA', (W, H)); p = im.load(); rng = random.Random(5)
    for y in range(H):
        for i in range(len(stops) - 1):
            y0, c0 = stops[i]; y1, c1 = stops[i + 1]
            if y0 <= y < y1: break
        t = (y - y0) / max(1, y1 - y0)
        for x in range(W):
            p[x, y] = C(c1) if BAYER[y % 4][x % 4] / 16 < t else C(c0)
    for _ in range(W // 6):
        x, y = rng.randrange(W), rng.randrange(int(H * 0.55))
        p[x, y] = C(rng.choice(['#ffffff', '#cfe0ff', '#9fb4dc']))
    return im

# ---------- the city ----------
OFFICE = ['#141a2e', '#18203a', '#1c2440', '#121828']
LIT = ['#ffd98a', '#ffe9b0', '#cfe6ff', '#fff4d6']

def tower(p, x0, x1, top, bottom, rng, lit=0.35, step=(2, 3)):
    body = C(rng.choice(OFFICE))
    for y in range(top, bottom):
        for x in range(x0, x1):
            p[x, y] = C('#2a3454') if x == x0 else body
    sx, sy = step
    for y in range(top + 2, bottom - 1, sy):
        for x in range(x0 + 2, x1 - 1, sx):
            p[x, y] = C(rng.choice(LIT)) if rng.random() < lit else C('#232c48')

def eureka(p, x0, x1, top, bottom, rng):
    """Slim and tallest, its top floors gold with a red band, as the tower is at night."""
    tower(p, x0, x1, top, bottom, rng, lit=0.45)
    for y in range(top, top + 7):
        for x in range(x0, x1):
            p[x, y] = C('#ffd24a') if (x + y) % 3 else C('#e0a020')
        p[x0, y] = C('#fff0a0')
    for x in range(x0, x1): p[x, top + 7] = C('#d0202a')
    cx = (x0 + x1) // 2
    for y in range(top - 4, top): p[cx, y] = C('#c8c8d0')
    p[cx, top - 5] = C('#ff3030')

def skyline(W, H, base, tall, eureka_at, rng, lit=0.35, step=(2, 3), wmin=8, wmax=26):
    im = Image.new('RGBA', (W, H), T); p = im.load()
    # A continuous low line of buildings, then towers of varying height in front.
    x = 0
    while x < W:
        w = rng.randint(wmin, wmax); h = rng.randint(4, base)
        tower(p, x, min(W, x + w), H - h, H, rng, lit * 0.6, step); x += w
    x = rng.randint(0, 6)
    while x < W:
        w = rng.randint(wmin // 2 + 3, wmax - 4); h = rng.randint(base, tall)
        if not (eureka_at[0] - 6 < x + w and x < eureka_at[1] + 6):
            tower(p, x, min(W, x + w), H - h, H, rng, lit, step)
            if h > tall * 0.8 and x + w // 2 < W: p[x + w // 2, H - h - 1] = C('#ff3030')
        x += w + rng.randint(0, 10)
    eureka(p, eureka_at[0], eureka_at[1], H - tall - 10, H, rng)
    return im

# ---------- floodlights ----------
def bloom(p, W, H, cx, cy, rx, ry):
    """Soft glow round a light head: dithered warm-white specks, thinning out with distance."""
    for y in range(max(0, cy - ry), min(H, cy + ry + 1)):
        for x in range(max(0, cx - rx), min(W, cx + rx + 1)):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d >= 1 or p[x, y][3]: continue
            k = (1 - d) ** 2
            if BAYER[y % 4][x % 4] / 16 < k * 0.9: p[x, y] = (255, 246, 205, int(60 + 120 * k))

def light_head(p, cx, top, w, h):
    for y in range(top, top + h):
        for x in range(cx - w // 2, cx + w // 2):
            if y in (top, top + h - 1) or x in (cx - w // 2, cx + w // 2 - 1): c = '#3a4048'
            elif (y - top) % 2 == 0: c = '#8a9098'
            else: c = '#ffffff' if (x + y) % 2 else '#fff6c0'
            p[x, y] = C(c)

def pylon(p, W, H, cx, head_top, foot, head_w=30, head_h=9):
    """A lattice mast, criss-crossed, under a bank of blazing lamps."""
    for y in range(head_top + head_h, foot):
        for dx in range(-2, 3):
            c = '#7a8088' if dx < 0 else '#4a5058'
            if (y + dx) % 4 == 0 or (y - dx) % 4 == 0: c = '#2a3036'
            p[cx + dx, y] = C(c)
    light_head(p, cx, head_top, head_w, head_h)
    bloom(p, W, H, cx, head_top + head_h // 2, head_w // 2 + 9, head_h // 2 + 5)

# ---------- close view ----------
def close_sky():
    gradient(640, 124, [(0, '#0a1024'), (40, '#111a36'), (80, '#1c2c52'), (110, '#2b446e'), (124, '#2b446e')]).save(OUT + 'close/sky.png')

def close_skyline():
    rng = random.Random(21)
    # Seen above the stand's roof (screen rows 24-73): towers rise from the bottom of the layer.
    skyline(640, 60, 18, 40, (290, 310), rng).save(OUT + 'close/skyline.png')

def close_stands():
    rng = random.Random(31); W, H = 640, 75
    im = Image.new('RGBA', (W, H), T); p = im.load()
    roof = 24
    # Three tiers under the cantilevered roof: the top one in its shade, the lower two in the floodlights.
    crowd(p, 0, W, roof + 7, roof + 19, True, rng, '#2a3550')
    for x in range(W):  # LED ribbon along the balcony
        for y in range(roof + 19, roof + 22):
            p[x, y] = C('#14181e') if y != roof + 20 else C(['#ffd23a', '#e23b3b', '#2f6fe0', '#2fa84f'][(x // 40) % 4])
    crowd(p, 0, W, roof + 22, roof + 34, False, rng, '#2b4a8a')
    for x in range(W):
        p[x, roof + 34] = C('#c8c8c0'); p[x, roof + 35] = C('#7e8084')
    crowd(p, 0, W, roof + 36, H, False, rng, '#3a5aa0')
    # Aisles down through the tiers.
    for ax in range(28, W, 64):
        for y in range(roof + 7, H):
            if p[ax, y] != C('#c8c8c0'): p[ax, y] = C('#b8b8b0'); p[ax + 1, y] = C('#808280')
    # The roof's concrete fascia, lit from below, its joints every 16 px.
    for x in range(W):
        for y in range(roof, roof + 7):
            c = '#d0d0c8' if y == roof else '#a4a6a2' if y < roof + 5 else '#3a3c40'
            if x % 16 == 0 and roof < y < roof + 5: c = '#6a6c6a'
            p[x, y] = C(c)
    for cx in (80, 240, 400, 560):
        pylon(p, W, H, cx, 7, roof)
    im.save(OUT + 'close/stands.png')

SPONSORS = [('FLY EMIRATES', '#c8102e', '#ffffff'), ('COMMBANK', '#ffcc00', '#111111'), ('VB', '#006341', '#f2c230'),
            ('WEET-BIX', '#ffd400', '#d0021b'), ('QANTAS', '#e0001b', '#ffffff'), ('MILO', '#00843d', '#ffffff'),
            ('KFC', '#a3080c', '#ffffff')]

def ad_boards(W, H, face_h, name):
    """LED boards in steel frames: each sponsor's colours, the face in a fine LED dot grid."""
    im = Image.new('RGBA', (W, H), T); p = im.load()
    n = len(SPONSORS)
    for i, (word, bg, fg) in enumerate(SPONSORS):
        x0, x1 = i * W // n, (i + 1) * W // n
        for y in range(H):
            for x in range(x0, x1):
                if y == 0: c = C('#c8d0d8')
                elif y == face_h + 1: c = C('#5a6068')
                elif y > face_h + 1: c = C('#1f3a2c')
                elif x == x0: c = C('#3a4048')
                elif x == x0 + 1: c = C('#9aa2aa')
                else: c = C(bg) if (x + y) % 2 else dark(C(bg), 0.86)
                p[x, y] = c
        tw = len(word) * 4 - 1
        text(p, word, x0 + 1 + (x1 - x0 - tw) // 2, 1 + (face_h - 5) // 2 + 1, fg)
    im.save(OUT + name)

# ---------- wide view ----------
def wide_sky():
    gradient(640, 60, [(0, '#0a1024'), (24, '#141f3e'), (50, '#2b446e'), (60, '#2b446e')]).save(OUT + 'wide/sky.png')

def wide_skyline():
    rng = random.Random(23)
    skyline(640, 35, 6, 22, (300, 306), rng, lit=0.18, step=(2, 2), wmin=5, wmax=14).save(OUT + 'wide/skyline.png')

def wide_stands():
    """The bowl from high up: its rim rises towards the near ends, three tiers of crowd, six masts."""
    rng = random.Random(41); W, H = 640, 50
    im = Image.new('RGBA', (W, H), T); p = im.load()
    rim = lambda x: int(round(5 + 9 * (1 - ((x - 320) / 320) ** 2)))
    for x in range(W):
        top = rim(x)
        for y in range(top, top + 3): p[x, y] = C('#d0d0c8' if y == top else '#8a8c88')
        p[x, top + 3] = C('#2a2c30')
    # Tiers, column by column so they follow the curve of the rim.
    tier = Image.new('RGBA', (W, H), T); q = tier.load()
    crowd_tiny(q, 0, W, 0, H, rng, '#2b4a8a')
    for x in range(W):
        top = rim(x) + 4; span = H - top
        b1, b2 = top + span // 3, top + 2 * span // 3
        for y in range(top, H):
            c = q[x, y]
            if y < b1: c = dark(c, 0.65)
            if y in (b1, b2): c = C('#c8c8c0')
            p[x, y] = c
    for ax in range(20, W, 48):
        for y in range(rim(ax) + 4, H): p[ax, y] = C('#a8a8a0')
    for cx in (50, 160, 270, 370, 480, 590):
        foot = rim(cx)
        for y in range(4, foot):
            p[cx, y] = C('#6a7078'); p[cx + 1, y] = C('#3a4048')
        light_head(p, cx + 1, 0, 12, 4)
        bloom(p, W, H, cx + 1, 2, 12, 3)
    # The big screen, its face where the game writes the score (grounds.js: x 520, y 55, 60 x 22 on screen).
    fx, fy, fw, fh = 520, 9, 60, 22
    for y in range(fy - 4, fy + fh + 2):
        for x in range(fx - 2, fx + fw + 2):
            c = '#2a2e36'
            if y < fy - 1: c = '#ffd23a' if y == fy - 3 and (fx + 4 < x < fx + fw - 4) and x % 3 else '#1a1e26'
            p[x, y] = C(c)
    for y in range(fy, fy + fh):
        for x in range(fx, fx + fw): p[x, y] = C('#101620')
    for y in range(fy + fh + 2, H):
        for x in (fx + 10, fx + 11, fx + fw - 12, fx + fw - 11): p[x, y] = C('#3a4048')
    im.save(OUT + 'wide/stands.png')

close_sky(); close_skyline(); close_stands(); ad_boards(640, 12, 9, 'close/fence-ads.png')
wide_sky(); wide_skyline(); wide_stands(); ad_boards(640, 14, 10, 'wide/fence-ads.png')
