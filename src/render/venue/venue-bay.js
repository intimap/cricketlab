import { drawFace, LAYER } from "./venue-raster.js";
import { V, face, wall, frame, box, pitchedRoof } from "./venue-geometry.js";
import { polar } from "./venue-map.js";
import { PAL, hash, noise, flat, iron, striped, weatherboard, white, steel } from "./venue-materials.js";

/**
 * A ground by the water (Bayside Oval), for the parts kit (venue-parts.js):
 *   shore         { bearing, sand, sea }                  a straight beach across that side of the ground: sand
 *                                                         from `sand` m out along the bearing, the sea from `sea`
 *                                                         m to the horizon (on the ground: venue-field.js asks here)
 *   pier          { bearing, radius, heading, length, width }   a timber pier from that spot out over the water
 *                                                         the way of `heading`, a shed at its end
 *   yachts        { from, to, r0, r1, count, seed }       boats at their moorings
 *   bathingBoxes  { from, to, radius, seed }              a row of little painted huts facing the ground
 */

const front = (bearing) => (bearing + 180) % 360;
const SAND = [226, 208, 160];
const SAND_WET = [196, 176, 132];
const FOAM = [238, 244, 240];
const SHALLOW = [78, 168, 176];
const DEEP = [38, 104, 158];
const GLINT = [150, 204, 222];

/** Colour c with a little grain, into out. */
function grain(out, c, px, py, seed, amount = 6) {
  const j = (noise(px, py, seed) - 0.5) * amount;
  out[0] = c[0] + j;
  out[1] = c[1] + j;
  out[2] = c[2] + j * 0.8;
}

/**
 * The ground of a shore: (x, z, px, py, out) -> true where it's sand or sea (out filled), false inland. The
 * water's edge wanders a little along the beach; the sea deepens away from it, with streaks of light.
 */
export function shoreGround(p) {
  const a = (p.bearing * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  return (x, z, px, py, out) => {
    const along = x * sin + z * cos;
    if (along < p.sand - 2) return false;
    const across = x * cos - z * sin;
    const edge = p.sea + Math.sin(across / 11) * 1.6 + Math.sin(across / 4.3 + 1) * 0.5;
    const inland = p.sand + Math.sin(across / 17 + 2) * 1.2;
    if (along < inland) return false;
    out[3] = 0;
    out[4] = LAYER.ground;
    if (along < edge - 1.6) return (grain(out, noise(px + 3, py + 7, 21) < 0.04 ? SAND_WET : SAND, px, py, 22), true);
    if (along < edge) return (grain(out, SAND_WET, px, py, 23), true);
    const depth = along - edge;
    if (depth < 0.9) return (grain(out, FOAM, px, py, 24, 4), true);
    const k = Math.min(1, depth / 70);
    const base = [0, 1, 2].map((i) => SHALLOW[i] + (DEEP[i] - SHALLOW[i]) * k);
    // Streaks of light along the swell: runs of a few pixels on some rows, fewer far out.
    const streak = noise(px >> 2, py, 25) < 0.075 - k * 0.04 && noise(px >> 4, py + 9, 26) < 0.6;
    grain(out, streak ? GLINT : base, px, py, 27, 5);
    return true;
  };
}

/** A shore is only marked on the ground. */
export const shore = () => {};

/** A timber pier: a deck on piles with a rail either side, lamp posts along it and a shed at the end. */
export function pier(pic, p) {
  const L = LAYER.buildings;
  const c = polar(p.bearing, p.radius);
  const facing = front(p.heading ?? p.bearing);
  const f = frame(c, facing);
  const len = p.length;
  const w = p.width;
  const deck = 2.1;
  const timber = weatherboard([150, 128, 98], [118, 98, 74], 0.25);
  const pile = flat([92, 76, 58], 5, 31);
  box(pic, c, facing, w, len, deck - 0.4, deck, { front: timber, sides: timber, back: timber, top: timber }, L);
  for (let d = 2; d < len; d += 7)
    for (const across of [-w / 2 + 0.3, w / 2 - 0.3])
      box(pic, f.point(across, d), facing, 0.4, 0.4, 0, deck - 0.4, { front: pile, sides: pile, back: pile }, L);
  // Rails: posts and a top rail, open between.
  const rail = (u, v, ppm) => (v > 0.95 || (u % 2.4 < Math.max(0.12, 1 / ppm) && v < 0.95) ? PAL.white : null);
  for (const across of [-w / 2, w / 2])
    wall(pic, f.point(across, 0), f.point(across, len - 6), deck, deck + 1.1, rail, L, { twoSided: true });
  for (let d = 12; d < len - 8; d += 24) {
    box(pic, f.point(w / 2 - 0.2, d), facing, 0.16, 0.16, deck, deck + 4.2, { front: steel, sides: steel, back: steel }, L);
    box(pic, f.point(w / 2 - 0.5, d), facing, 0.7, 0.3, deck + 4.2, deck + 4.5, { front: white, sides: white, back: white }, L);
  }
  const shed = f.point(0, len - 5.5);
  const boards = weatherboard(PAL.cream, PAL.whiteLine);
  box(pic, shed, facing, w + 1.5, 5, deck, deck + 2.7, { front: boards, sides: boards, back: boards }, L);
  pitchedRoof(
    pic,
    shed,
    facing,
    w + 1.5,
    5,
    deck + 2.7,
    deck + 4,
    iron(PAL.roofRed, PAL.roofRedDark, PAL.roofRed),
    boards,
    L,
    0.4,
  );
}

/** Where yacht `i` of a mooring lies and which way it points. */
function mooring(p, i) {
  const span = (p.to - p.from + 360) % 360;
  const seed = p.seed ?? 41;
  const at = polar(p.from + span * hash(i, 1, seed), p.r0 + (p.r1 - p.r0) * hash(i, 2, seed));
  // They swing to the same breeze, give or take.
  return { at, heading: 250 + hash(i, 3, seed) * 30, size: 0.8 + hash(i, 4, seed) * 0.5, sails: hash(i, 5, seed) < 0.55 };
}

/** Yachts at their moorings: a hull and a mast, some with a sail up. */
export function yachts(pic, p) {
  const L = LAYER.buildings;
  const hulls = [
    [240, 240, 232],
    [44, 70, 120],
    [240, 240, 232],
    [170, 52, 46],
  ];
  const mast = flat([214, 214, 204], 3, 42);
  for (let i = 0; i < p.count; i++) {
    const m = mooring(p, i);
    const f = frame(m.at, m.heading);
    const k = m.size;
    const colour = hulls[i % hulls.length];
    const hull = (u, v) => (v > 0.8 * k ? PAL.white : colour);
    box(pic, m.at, m.heading, 2.4 * k, 7.5 * k, 0, 1.1 * k, { front: hull, sides: hull, back: hull, top: white }, L);
    const foot = f.point(0, 2.8 * k);
    box(pic, foot, m.heading, 0.2, 0.2, 1.1 * k, 10.5 * k, { front: mast, sides: mast, back: mast }, L);
    if (!m.sails) continue;
    const boom = f.point(0, 6.8 * k);
    const sail = flat(i % 3 === 0 ? [236, 214, 160] : [246, 246, 240], 4, 43);
    drawFace(
      pic,
      face([V(foot.x, 1.9 * k, foot.z), V(boom.x, 1.9 * k, boom.z), V(foot.x, 10 * k, foot.z)], sail, L, { twoSided: true }),
    );
  }
}

/** Bathing boxes: a row of little huts in bright paint, each with its own stripes or a plain colour, a door and a tin roof. */
export function bathingBoxes(pic, p) {
  const L = LAYER.buildings;
  const paints = ["#d8453e", "#f2c84a", "#3f8fc0", "#f4f1e6", "#58a878", "#e8834a", "#7a5aa8", "#f29ab0"].map((h) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
  );
  const span = (p.to - p.from + 360) % 360;
  const count = Math.max(1, Math.floor((((span * Math.PI) / 180) * p.radius) / 3.3));
  const seed = p.seed ?? 45;
  for (let i = 0; i < count; i++) {
    const b = p.from + (span * (i + 0.5)) / count;
    const c = polar(b, p.radius);
    const colour = paints[Math.floor(hash(i, 1, seed) * paints.length)];
    const other = paints[Math.floor(hash(i, 2, seed) * paints.length)];
    const plain = flat(colour, 4, 46);
    const paint = hash(i, 3, seed) < 0.45 ? striped(colour, 0.45) : plain;
    const door = (u, v, ppm, x, y) => (Math.abs(u - 1.3) < 0.45 && v < 1.9 ? other : paint(u, v, ppm, x, y));
    box(pic, c, front(b), 2.6, 3.2, 0, 2.3, { front: door, sides: plain, back: plain }, L);
    pitchedRoof(pic, c, front(b), 2.6, 3.2, 2.3, 3.2, iron([206, 208, 204], [170, 174, 172], [226, 228, 224]), plain, L, 0.25);
  }
}
