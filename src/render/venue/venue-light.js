import { FLAG, LAYER } from "./venue-raster.js";
import { polar } from "./venue-map.js";
import { frame } from "./venue-geometry.js";
import { treePlacement } from "./venue-parts.js";

/**
 * A picture relit for a time of day and the weather (render/light.js, render/weather-look.js): each
 * surface shaded by the sun against how it was drawn at midday, so midday leaves the colours as they are;
 * the buildings and trees throwing their shadows on the ground and the outfield; distant things hazed
 * towards the sky; and at night the scenery dimmed, the windows lit and the floodlights' lamps glowing.
 *
 * The sun is fixed to the ground: the light's shadow direction (`casts`, for end 0) read in the map's
 * frame. When the bowling changes ends, the players' shadows turn with the world (turnLight).
 */

/** The sun in the map from a light's first cast: { dir (towards the sun), strength, elevation } or null. */
export function sunOf(look) {
  const cast = look.hd?.casts?.[0] ?? look.casts?.[0];
  if (!cast || look.hd?.lamps || look.lamps) return null;
  const h = Math.hypot(cast.x, cast.z) || 1;
  const e = Math.atan(1 / cast.length);
  return {
    dir: { x: (-cast.x / h) * Math.cos(e), y: Math.sin(e), z: (-cast.z / h) * Math.cos(e) },
    strength: cast.alpha,
    elevation: e,
  };
}

/** A light turned for the bowling end: the players' shadows fall the other way when the ends change. */
const turned = new Map();
export function turnLight(light, end) {
  if (end === 0) return light;
  if (!turned.has(light)) {
    const flip = (casts) => casts?.map((c) => ({ ...c, x: -c.x, z: -c.z }));
    turned.set(light, { ...light, casts: flip(light.casts), hd: light.hd && { ...light.hd, casts: flip(light.hd.casts) } });
  }
  return turned.get(light);
}

/**
 * What throws a shadow, from a map: boxes (plan corners and height) and crowns (centre, height, radius),
 * gathered from its parts by the kinds that stand up (venue-parts.js).
 */
export function castersOf(map) {
  const boxes = [];
  const crowns = [];
  const add = (c, bearing, w, d, height) => {
    const f = frame(c, bearing);
    boxes.push({ corners: [f.point(-w / 2, 0), f.point(w / 2, 0), f.point(w / 2, d), f.point(-w / 2, d)], height });
  };
  const face = (b) => (b + 180) % 360;
  for (const p of map.parts) {
    if (p.kind === "pavilion") add(polar(p.bearing, p.radius), face(p.bearing), p.width, p.depth, 9.2);
    if (p.kind === "stand") add(polar(p.bearing, p.radius), face(p.bearing), p.width, p.depth, (p.eave ?? 6) + 1);
    if (p.kind === "scoreboard") add(polar(p.bearing, p.radius), face(p.bearing), p.width, 3.5, p.base + 8.5);
    if (p.kind === "sightscreen") add(polar(p.bearing, p.radius), face(p.bearing), p.width, 0.4, p.height);
    if (p.kind === "floodlight") {
      add(polar(p.bearing, p.radius), face(p.bearing), 1.2, 1.2, p.height);
      const hf = frame(frame(polar(p.bearing, p.radius), face(p.bearing)).point(0, -0.8), face(p.bearing));
      const corners = [hf.point(-3.75, 0), hf.point(3.75, 0), hf.point(3.75, 0.8), hf.point(-3.75, 0.8)];
      boxes.push({ corners, height: p.height + 3.6, from: p.height - 1 });
    }
    if (p.kind === "trees") for (let i = 0; i < p.count; i++) crowns.push(treePlacement(p, i));
  }
  return { boxes, crowns };
}

/** Is map point (x, z) inside the convex hull of `pts`? */
function inHull(pts, x, z) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const c = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (c !== 0) {
      if (sign === 0) sign = Math.sign(c);
      else if (Math.sign(c) !== sign) return false;
    }
  }
  return true;
}

/** Convex hull (gift wrapping is plenty for eight points). */
function hull(points) {
  const pts = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * The shadows on the ground for a sun: a test (x, z) -> true in shadow, using a coarse grid of the
 * shadow shapes so each point checks only the few near it.
 */
export function shadowTest(casters, sun) {
  if (!sun) return () => false;
  const reach = 1 / Math.tan(sun.elevation);
  const h = Math.hypot(sun.dir.x, sun.dir.z) || 1;
  // A point at height y throws its shadow `y * reach` away from the sun.
  const away = { x: -sun.dir.x / h, z: -sun.dir.z / h };
  const shapes = [];
  for (const b of casters.boxes) {
    const lift = b.from ?? 0;
    const pts = b.corners.flatMap((c) => [
      { x: c.x + away.x * lift * reach, z: c.z + away.z * lift * reach },
      { x: c.x + away.x * b.height * reach, z: c.z + away.z * b.height * reach },
    ]);
    shapes.push({ hull: hull(pts) });
  }
  for (const t of casters.crowns) {
    const r = t.height * 0.34;
    const lift = t.height - r + (t.base ?? 0);
    shapes.push({ disc: { x: t.x + away.x * lift * reach, z: t.z + away.z * lift * reach, r, stretch: Math.min(4, reach) } });
  }
  // A grid of 8 m cells over the ground, each listing the shapes that reach into it.
  const CELL = 8;
  const SIDE = 100;
  const HALF = (SIDE * CELL) / 2;
  const grid = new Array(SIDE * SIDE).fill(null);
  for (const s of shapes) {
    let x0, x1, z0, z1;
    if (s.hull) {
      x0 = Math.min(...s.hull.map((p) => p.x));
      x1 = Math.max(...s.hull.map((p) => p.x));
      z0 = Math.min(...s.hull.map((p) => p.z));
      z1 = Math.max(...s.hull.map((p) => p.z));
    } else {
      const e = s.disc.r * Math.max(1, s.disc.stretch * 0.6);
      [x0, x1, z0, z1] = [s.disc.x - e, s.disc.x + e, s.disc.z - e, s.disc.z + e];
    }
    const i0 = Math.max(0, Math.floor((x0 + HALF) / CELL));
    const i1 = Math.min(SIDE - 1, Math.floor((x1 + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((z0 + HALF) / CELL));
    const j1 = Math.min(SIDE - 1, Math.floor((z1 + HALF) / CELL));
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = i * SIDE + j;
        (grid[k] ??= []).push(s);
      }
  }
  return (x, z) => {
    const i = Math.floor((x + HALF) / CELL);
    const j = Math.floor((z + HALF) / CELL);
    if (i < 0 || j < 0 || i >= SIDE || j >= SIDE) return false;
    const list = grid[i * SIDE + j];
    if (!list) return false;
    for (const s of list) {
      if (s.hull ? inHull(s.hull, x, z) : inDisc(s.disc, away, x, z)) return true;
    }
    return false;
  };
}

/** A crown's shadow: a disc drawn out along the sun's way. */
function inDisc(d, away, x, z) {
  const dx = x - d.x;
  const dz = z - d.z;
  const along = dx * away.x + dz * away.z;
  const across = dx * away.z - dz * away.x;
  return (along / (d.r * Math.max(1, d.stretch * 0.6))) ** 2 + (across / d.r) ** 2 < 1;
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/**
 * The relight's numbers for a look: the sun, how much its direct light counts, its colour, the ambient's,
 * the dimming and haze, and whether it's night.
 */
export function lightingFor(look) {
  const hd = look.hd ?? {};
  const night = !!hd.lamps;
  const sun = sunOf(look);
  const evening = hd.sky && !night;
  const glow = hd.glow ?? look.glow;
  return {
    sun,
    night,
    // The sun's warmth: white at midday, golden in the afternoon, orange in the evening.
    // Gentle: the frame's own grade (render/lighting.js gradeFrame) warms the whole picture as well.
    sunColour: night ? [0.96, 0.98, 1.03] : evening ? [1.05, 0.97, 0.88] : glow ? [1.03, 0.99, 0.93] : [1, 1, 1],
    shadeColour: night ? [0.9, 0.92, 1.0] : evening ? [0.86, 0.86, 0.98] : [0.95, 0.97, 1.02],
    dim: hd.dim ? { colour: hexRgb(hd.dim.colour), amount: hd.dim.amount } : null,
    sky: hd.sky ?? { top: "#4f8fd8", foot: "#b6dcf4" },
    stars: hd.sky?.stars ?? 0,
  };
}

/** Midday's light, which the art is drawn in. */
const MIDDAY = { sun: { dir: { x: -0.098, y: 0.944, z: 0.315 }, strength: 0.32, elevation: 1.234 } };

/** How lit a surface with normal n is (a number around 1), and in shadow or not. */
function lit(sun, n, inShadow) {
  if (!sun) return 1;
  const k = sun.strength;
  // Flat ground in full sun is 1; in shadow 1 - k. Walls catch more of a low sun, capped so they don't burn out.
  const direct = Math.max(0, n.x * sun.dir.x + n.y * sun.dir.y + n.z * sun.dir.z) / Math.max(0.55, sun.dir.y);
  return 1 - k + (inShadow ? 0 : k * Math.min(1.6, direct));
}

/**
 * Relight `pic` into `image` (an ImageData-like { data } the picture's size): `look` the time and weather,
 * `shadowed(x, z)` from shadowTest, `haze` { from, per, most }: how far off (depth, m) things start to fade
 * towards the sky, how much more per metre, and at most. Where there's nothing, the sky goes in (`sky`:
 * { data, rows, foot } from venue-build.js), or it's left clear. Rows `y0` to `y1` only, so a big picture
 * can be relit a slice at a time.
 */
export function relight(pic, image, look, shadowed, haze, y0 = 0, y1 = pic.h - 1, sky = null) {
  const L = lightingFor(look);
  const out = image.data;
  const src = pic.rgba;
  const { eye, right: R, up: U, forward: F, fx, fy, cx, cy } = pic.cam;
  const horizon = hexRgb(L.sky.foot);
  const n = { x: 0, y: 0, z: 0 };
  const mid = MIDDAY.sun;
  // Each surface direction's light in sun and in shadow, worked out once.
  const factors = new Map();
  const factorOf = (i) => {
    const key = (pic.normal[i * 3] & 255) | ((pic.normal[i * 3 + 1] & 255) << 8) | ((pic.normal[i * 3 + 2] & 255) << 16);
    let f = factors.get(key);
    if (!f) {
      n.x = pic.normal[i * 3] / 127;
      n.y = pic.normal[i * 3 + 1] / 127;
      n.z = pic.normal[i * 3 + 2] / 127;
      const base = lit(mid, n, false);
      const sun = lit(L.sun, n, false) / base;
      const shade = lit(L.sun, n, true) / base;
      const sunTint = L.sun ? L.sunColour : L.shadeColour;
      f = [
        sun * sunTint[0],
        sun * sunTint[1],
        sun * sunTint[2],
        shade * L.shadeColour[0],
        shade * L.shadeColour[1],
        shade * L.shadeColour[2],
      ];
      factors.set(key, f);
    }
    return f;
  };
  const dim = L.dim;
  const dimR = dim ? dim.colour[0] : 0;
  const dimG = dim ? dim.colour[1] : 0;
  const dimB = dim ? dim.colour[2] : 0;
  const dimK = dim ? dim.amount : 0;
  const hazeScale = L.night ? 0.3 : 1;
  const hazeFrom = haze?.from ?? Infinity;
  const hazePer = (haze?.per ?? 0) * hazeScale;
  const hazeMost = (haze?.most ?? 0) * hazeScale;
  // Flat ground's light, the commonest, kept to hand.
  const flat = (() => {
    n.x = 0;
    n.y = 1;
    n.z = 0;
    const base = lit(mid, n, false);
    const sun = lit(L.sun, n, false) / base;
    const shade = lit(L.sun, n, true) / base;
    const sunTint = L.sun ? L.sunColour : L.shadeColour;
    return [
      sun * sunTint[0],
      sun * sunTint[1],
      sun * sunTint[2],
      shade * L.shadeColour[0],
      shade * L.shadeColour[1],
      shade * L.shadeColour[2],
    ];
  })();
  for (let y = y0; y <= y1; y++) {
    const b = -(y + 0.5 - cy) / fy;
    const rx = U.x * b + F.x;
    const rz = U.z * b + F.z;
    for (let x = 0; x < pic.w; x++) {
      const i = y * pic.w + x;
      const j = i * 4;
      if (src[j + 3] === 0) {
        if (!sky) out[j + 3] = 0;
        else if (y < sky.rows) {
          out[j] = sky.data[j];
          out[j + 1] = sky.data[j + 1];
          out[j + 2] = sky.data[j + 2];
          out[j + 3] = 255;
        } else {
          out[j] = sky.foot[0];
          out[j + 1] = sky.foot[1];
          out[j + 2] = sky.foot[2];
          out[j + 3] = 255;
        }
        continue;
      }
      const flags = pic.flags[i];
      const layer = pic.layer[i];
      const depth = pic.depth[i];
      let inShadow = false;
      if (flags & FLAG.shadowed && L.sun) {
        const a = (x + 0.5 - cx) / fx;
        inShadow = shadowed(eye.x + (R.x * a + rx) * depth, eye.z + (R.z * a + rz) * depth);
      }
      const f = pic.normal[i * 3 + 1] === 127 ? flat : factorOf(i);
      const o = inShadow ? 3 : 0;
      let r = src[j] * f[o];
      let g = src[j + 1] * f[o + 1];
      let bl = src[j + 2] * f[o + 2];
      if (L.night) {
        // Floodlit: the field bright and cool, everything round it dark; windows and lamps lit.
        if (flags & FLAG.lamp) {
          r = 255;
          g = 252;
          bl = 232;
        } else if (flags & FLAG.window) {
          r = 255;
          g = 214;
          bl = 130;
        } else if (layer !== LAYER.field && dim) {
          r += (dimR - r) * dimK;
          g += (dimG - g) * dimK;
          bl += (dimB - bl) * dimK;
        }
      } else if (dim && layer !== LAYER.field) {
        // Dusk: some windows lit, the scenery dimmed.
        if (flags & FLAG.window && (x * 7 + y * 3) % 5 < 2) {
          r = r * 0.6 + 100;
          g = g * 0.6 + 80;
          bl = bl * 0.6 + 40;
        }
        r += (dimR - r) * dimK;
        g += (dimG - g) * dimK;
        bl += (dimB - bl) * dimK;
      }
      if (depth > hazeFrom) {
        const hz = Math.min(hazeMost, (depth - hazeFrom) * hazePer);
        r += (horizon[0] - r) * hz;
        g += (horizon[1] - g) * hz;
        bl += (horizon[2] - bl) * hz;
      }
      out[j] = r;
      out[j + 1] = g;
      out[j + 2] = bl;
      out[j + 3] = 255;
    }
  }
}
