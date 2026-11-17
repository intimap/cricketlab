import { drawFace, LAYER, FLAG } from "./venue-raster.js";
import { V, face, wall, frame, box, arc } from "./venue-geometry.js";
import { polar } from "./venue-map.js";
import { PAL, hash, flat, seating, lampHead, windowed, steel } from "./venue-materials.js";

/**
 * A stadium's parts (the City Bowl), for the parts kit (venue-parts.js):
 *   bowl        { from, to, r0, ... }                 a run of the bowl round the arc: a lower tier, a level of
 *                                                      glass-fronted boxes, an upper tier and a roof with lamps
 *                                                      along its edge. `members: true` makes it the members'
 *                                                      pavilion instead: its own seats, and storeys of glass
 *                                                      where the upper tier would be.
 *   scoreboard  { style: "screen", bearing, radius, base, width }   a video screen (the live scoreboard's face)
 * and the advertising boards round the outfield (map.fence.style "boards").
 *
 * The TV camera looks down over the near side of the bowl, which would hide the field: nothing here is
 * drawn on a pixel whose line of sight goes on to land inside the fence (clearOfField), so the near stands
 * and roof are cut away along the edge of the outfield and the far side is whole.
 */

/** A bowl's shape (m): each level's depth back from the front wall and its heights. */
export const BOWL = Object.freeze({
  wall: 1.3,
  lower: { depth: 12, top: 5.2 },
  boxes: { top: 8.2 },
  upper: { front: 10, parapet: 9.3, depth: 30, top: 28 },
  roof: { front: 8, back: 43, edge: 32, ridge: 35.5 },
});

const SEAT = [44, 74, 122];
const SEAT_DARK = [30, 52, 90];
const NAVY = [28, 40, 66];
const dark = flat([40, 44, 50], 5, 71);
const underRoof = flat([58, 62, 68], 5, 72);
const membrane = flat([226, 228, 224], 5, 73);
const fascia = flat([236, 236, 230], 4, 74);

/**
 * Wraps a material so it leaves alone any pixel whose line of sight lands on the field (inside `radius`):
 * what's this side of the field from a high camera is cut away, and the field is never covered.
 */
export function clearOfField(pic, radius) {
  const cam = pic.cam;
  const r2 = radius * radius;
  const onField = (x, y) => {
    const d = cam.ray(x + 0.5, y + 0.5);
    if (d.y > -1e-9) return false;
    const t = -cam.eye.y / d.y;
    const gx = cam.eye.x + d.x * t;
    const gz = cam.eye.z + d.z * t;
    return gx * gx + gz * gz < r2;
  };
  return (material) => (u, v, ppm, x, y) => (onField(x, y) ? null : material(u, v, ppm, x, y));
}

/** Seats with stairways up through them every `every` m, and a walkway along the top. */
function tierSeats(opts, every, length) {
  const seats = seating(opts);
  return (u, v, ppm, x, y) => {
    const a = ((u % every) + every) % every;
    if (a < Math.max(1, 1.2 / ppm) && length > every) return Math.floor(v / 0.4) % 2 ? PAL.concrete : PAL.concreteDark;
    return seats(u, v, ppm, x, y);
  };
}

/** The boxes: glass behind a balcony rail, a fin between each, the windows lit at night. */
function boxFront(height) {
  return (u, v, ppm) => {
    if (v < 0.5 || v > height - 0.5) return PAL.concrete;
    const a = ((u % 5) + 5) % 5;
    if (a < Math.max(0.3, 1 / ppm)) return PAL.concreteDark;
    return v > height - 1.1 ? [...PAL.glassShine, FLAG.window] : [...PAL.glass, FLAG.window];
  };
}

/** The upper tier's front: a navy band with a white line along the top, and panels of colour like signs. */
function parapet(height) {
  const signs = [
    [200, 60, 52],
    [236, 236, 230],
    [232, 190, 60],
    [60, 130, 196],
  ];
  return (u, v, ppm) => {
    if (v > height - Math.max(0.15, 1 / ppm)) return PAL.white;
    const k = Math.floor(u / 9);
    const a = u - k * 9;
    if (a > 1.5 && a < 7.5 && v > 0.2 && v < height - 0.35 && hash(k, 3, 75) < 0.6) return signs[Math.floor(hash(k, 4, 75) * 4)];
    return NAVY;
  };
}

/** The roof's edge: white, with banks of lamps along it. */
function roofEdge() {
  const lamps = lampHead();
  return (u, v, ppm) => {
    const a = ((u % 16) + 16) % 16;
    return a > 3 && a < 13 && v > 0.3 && v < 1.9 ? lamps(a - 3, v - 0.3, ppm) : fascia(u, v, ppm, 0, 0);
  };
}

/** The members' pavilion: cream storeys of glass with a balcony rail under each. */
function membersFront(length, height) {
  const cream = flat(PAL.cream, 5, 76);
  const storeys = [];
  for (let v = 1.2; v + 2.6 < height; v += 4.4) storeys.push([v, v + 2.6]);
  const glass = windowed(cream, { storeys, spacing: 3.2, width: 2.4, margin: 2, length });
  return (u, v, ppm, x, y) => {
    for (const [v0] of storeys) if (v > v0 - 0.9 && v < v0 - 0.9 + Math.max(0.2, 1 / ppm)) return PAL.trim;
    return glass(u, v, ppm, x, y);
  };
}

export function bowl(pic, p, ctx) {
  const keep = clearOfField(pic, (ctx.map?.fence.radius ?? 72) + 0.5);
  const L = LAYER.buildings;
  const B = BOWL;
  const r0 = p.r0;
  const span = (p.to - p.from + 360) % 360 || 360;
  const length = (span * Math.PI * r0) / 180;
  const full = p.full ?? 0.88;
  const seed = p.seed ?? 81;
  const seatOpts = p.members ? { members: true } : { colour: SEAT, dark: SEAT_DARK };
  const lowerRise = Math.hypot(B.lower.depth, B.lower.top - B.wall);
  const mats = {
    wall: keep(p.members ? flat(PAL.trim, 4, 77) : flat(NAVY, 4, 77)),
    lower: keep(tierSeats({ rowDepth: 0.85, full, seed, ...seatOpts }, 15, length)),
    boxes: keep(p.members ? membersFront(length, B.roof.edge - B.lower.top) : boxFront(B.boxes.top - B.lower.top)),
    parapet: keep(parapet(B.upper.parapet - B.boxes.top)),
    upper: keep(tierSeats({ rowDepth: 0.85, full: full * 0.96, seed: seed + 7, colour: SEAT, dark: SEAT_DARK }, 15, length)),
    back: keep(dark),
    roof: keep((u, v, ppm, x, y) => (((u % 8) + 8) % 8 < Math.max(0.4, 1 / ppm) ? PAL.steel : membrane(u, v, ppm, x, y))),
    under: keep((u, v, ppm, x, y) => (((u % 8) + 8) % 8 < Math.max(0.5, 1 / ppm) ? PAL.steelDark : underRoof(u, v, ppm, x, y))),
    edge: keep(roofEdge()),
  };
  const quad = (a, b, ya, c, d, yb, material, up, u0, opts = {}) => {
    const out = V(-(a.x + b.x), up * 80, -(a.z + b.z));
    drawFace(
      pic,
      face([V(a.x, ya, a.z), V(b.x, ya, b.z), V(d.x, yb, d.z), V(c.x, yb, c.z)], material, L, { outward: out, u0, ...opts }),
    );
  };
  const ring = (dr0, dr1, each) => arc(p.from, p.to, r0 + dr0, r0 + dr1, each, 4 * ((r0 + dr0) / r0));
  // The front wall and the lower tier.
  ring(0, B.lower.depth, (a0, b0, a1, b1, u0) => {
    wall(pic, a0, b0, 0, B.wall, mats.wall, L, { u0 });
    quad(a0, b0, B.wall, a1, b1, B.lower.top, mats.lower, 1, u0);
  });
  if (p.members) {
    // The pavilion's front, up to the roof.
    ring(B.lower.depth, B.lower.depth, (a0, b0, _a, _b, u0) =>
      wall(pic, a0, b0, B.lower.top, B.roof.edge, mats.boxes, L, { u0 }),
    );
  } else {
    // The boxes behind the lower tier; the upper tier comes forward over them, and rises to the back.
    ring(B.lower.depth, B.lower.depth, (a0, b0, _a, _b, u0) =>
      wall(pic, a0, b0, B.lower.top, B.boxes.top, mats.boxes, L, { u0 }),
    );
    ring(B.upper.front, B.upper.front + B.upper.depth, (a0, b0, a1, b1, u0) => {
      wall(pic, a0, b0, B.boxes.top, B.upper.parapet, mats.parapet, L, { u0 });
      quad(a0, b0, B.upper.parapet, a1, b1, B.upper.top, mats.upper, 1, u0, { v0: lowerRise + 3 });
    });
    ring(B.upper.front + B.upper.depth, 0, (a0, b0, _a, _b, u0) =>
      wall(pic, a0, b0, B.upper.top, B.roof.ridge, mats.back, L, { u0 }),
    );
  }
  if (p.roof === false) return;
  // The roof: its top, its underside in shade, and its edge with the lamps.
  ring(B.roof.front, B.roof.back, (a0, b0, a1, b1, u0) => {
    quad(a0, b0, B.roof.edge, a1, b1, B.roof.ridge, mats.roof, 1, u0);
    quad(a0, b0, B.roof.edge - 0.1, a1, b1, B.roof.ridge - 0.1, mats.under, -1, u0, { bright: 0.75 });
    wall(pic, a0, b0, B.roof.edge - 2.2, B.roof.edge, mats.edge, L, { u0, flags: 0 });
  });
}

/** What a run of bowl throws a shadow with: a block under each stretch of its roof (venue-light.js castersOf). */
export function bowlCasters(p) {
  const blocks = [];
  const height = p.roof === false ? BOWL.upper.top : BOWL.roof.ridge;
  const inner = p.roof === false ? BOWL.upper.front : BOWL.roof.front;
  arc(
    p.from,
    p.to,
    p.r0 + inner,
    p.r0 + BOWL.roof.back,
    (a0, b0, a1, b1) => blocks.push({ corners: [a0, b0, b1, a1], height }),
    20,
  );
  return blocks;
}

/** A video screen on its frame: the live scoreboard is drawn on its face (venue-build.js boardRect). */
export function videoScreen(pic, p, ctx) {
  const keep = clearOfField(pic, (ctx.map?.fence.radius ?? 72) + 0.5);
  const c = polar(p.bearing, p.radius);
  const facing = (p.bearing + 180) % 360;
  const w = p.width;
  const top = p.base + 7.2;
  const glow = flat([18, 24, 34], 3, 78);
  const front = keep((u, v, ppm, x, y) => {
    if (u > 1 && u < w - 1 && v > 1.6 && v < 6.2) return glow(u, v, ppm, x, y);
    return v < 1.1 && u > 1 && u < w - 1 ? NAVY : steel(u, v, ppm, x, y);
  });
  const side = keep(dark);
  box(pic, c, facing, w, 1.4, p.base, top, { front, sides: side, back: side, top: side }, LAYER.buildings);
  // Legs down to the ground, for the ones that stand clear of a tier.
  const f = frame(c, facing);
  for (const across of [-w / 2 + 0.6, w / 2 - 0.6])
    box(pic, f.point(across, 0.3), facing, 0.6, 0.8, 0, p.base, { front: side, sides: side, back: side }, LAYER.buildings);
}

/** Advertising boards round the outfield: panels of colour, a white line along the top. */
export function adBoards(height) {
  const panels = [
    [28, 40, 66],
    [236, 236, 230],
    [196, 58, 50],
    [28, 40, 66],
    [232, 190, 60],
    [44, 110, 72],
    [236, 236, 230],
    [52, 110, 180],
  ];
  return (u, v, ppm) => {
    if (v > height - Math.max(0.08, 1 / ppm)) return PAL.white;
    const k = Math.floor(u / 6);
    if (u - k * 6 < Math.max(0.1, 1 / ppm)) return PAL.steelDark;
    return panels[Math.floor(hash(k, 5, 79) * panels.length)];
  };
}
