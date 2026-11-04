import { drawSprite, drawFace, LAYER, FLAG } from "./venue-raster.js";
import { V, face, wall, slope, frame, box, pitchedRoof, pyramidRoof, arc } from "./venue-geometry.js";
import { polar } from "./venue-map.js";
import {
  PAL,
  hash,
  flat,
  weatherboard,
  brick,
  iron,
  seating,
  bankGrass,
  pickets,
  sightscreen,
  scoreboardFace,
  striped,
  lampHead,
  white,
  trim,
  post,
  steel,
  concrete,
} from "./venue-materials.js";
import { treeSprite, personSprite, umbrellaSprite } from "./venue-sprites.js";
import { pavilion, flagpole } from "./venue-pavilion.js";

/**
 * The parts kit: each kind of thing round a ground, drawn into a picture from its entry in the map
 * (venue-map.js). Positions are bearings and radii, or plan points; a part faces the middle unless it says.
 *   pavilion     { bearing, radius, width, depth }        two storeys, verandahs, a clock gable, a flag
 *   terrace      { bearing, radius, width, depth, rise }   open seating rising away from the field
 *   stand        { bearing, radius, width, depth, roof }   covered seating (the Old Stand, the members')
 *   bank         { from, to, r0, r1, height, top, people } a grass bank round the arc, with spectators
 *   scoreboard   { bearing, radius, base, width }          a hand-turned board on its own building
 *   tents        { from, to, radius, colours }             marquees
 *   floodlight   { bearing, radius, height }               a lattice tower with a head of lamps
 *   sightscreen  { bearing, radius, width, height }        white, or black for the white ball
 *   trees        { from, to, r0, r1, count, height, kinds } a stand of trees, seeded
 *   fence        the map's picket fence (map.fence)
 */

const front = (bearing) => (bearing + 180) % 360;

function terrace(pic, p) {
  const c = polar(p.bearing, p.radius);
  const facing = front(p.bearing);
  const f = frame(c, facing);
  const { width: w, depth: d, rise } = p;
  const L = LAYER.buildings;
  const wallH = 0.9;
  const seats = seating({ rowDepth: 0.9, full: p.full ?? 0.75, seed: p.seed ?? 11 });
  const aisle = (u, v, ppm, x, y) =>
    Math.abs(u - w / 2) < 1.4
      ? Math.floor(v / 0.45) % 2
        ? concrete(u, v, ppm, x, y)
        : PAL.concreteDark
      : seats(u, v, ppm, x, y);
  wall(pic, f.point(-w / 2, 0), f.point(w / 2, 0), 0, wallH, white, L);
  slope(pic, f.point(-w / 2, 0), f.point(w / 2, 0), wallH, { x: -f.front.x * d, z: -f.front.z * d }, rise, aisle, L);
  wall(pic, f.point(w / 2, 0), f.point(w / 2, d), 0, rise, white, L);
  wall(pic, f.point(-w / 2, d), f.point(-w / 2, 0), 0, rise, white, L);
  wall(pic, f.point(w / 2, d), f.point(-w / 2, d), 0, rise, white, L);
}

function stand(pic, p) {
  const c = polar(p.bearing, p.radius);
  const facing = front(p.bearing);
  const f = frame(c, facing);
  const { width: w, depth: d } = p;
  const L = LAYER.buildings;
  const wallH = p.wall ?? 1.1;
  const rise = p.rise ?? d * 0.42;
  const eave = p.eave ?? rise + 2.6;
  const backH = eave + (p.pitch ?? 1.2);
  const roofMat = p.roof === "red" ? iron(PAL.roofRed, PAL.roofRedDark, PAL.roofRed) : iron();
  const side = p.walls === "brick" ? brick() : weatherboard(PAL.cream, PAL.whiteLine);
  const seats = seating({ rowDepth: 0.8, full: p.full ?? 0.68, seed: p.seed ?? 21 });
  wall(pic, f.point(-w / 2, 0), f.point(w / 2, 0), 0, wallH, p.walls === "brick" ? brick() : white, L);
  // Under the roof, the seats are in its shade.
  slope(
    pic,
    f.point(-w / 2, 0),
    f.point(w / 2, 0),
    wallH,
    { x: -f.front.x * (d - 0.6), z: -f.front.z * (d - 0.6) },
    rise,
    seats,
    L,
    { bright: 0.8 },
  );
  // The back wall and the ends, up to the roof.
  wall(pic, f.point(w / 2, d), f.point(-w / 2, d), 0, backH, side, L);
  for (const [a, b] of [
    [f.point(w / 2, 0), f.point(w / 2, d)],
    [f.point(-w / 2, d), f.point(-w / 2, 0)],
  ]) {
    const isRight = a.x === f.point(w / 2, 0).x && a.z === f.point(w / 2, 0).z;
    const pts = isRight
      ? [V(a.x, 0, a.z), V(b.x, 0, b.z), V(b.x, backH, b.z), V(a.x, eave, a.z)]
      : [V(a.x, 0, a.z), V(b.x, 0, b.z), V(b.x, eave, b.z), V(a.x, backH, a.z)];
    drawFace(pic, face(pts, side, L));
  }
  // The roof on posts along the front, and its fascia board.
  const r0 = f.point(-w / 2 - 0.3, -0.6);
  const r1 = f.point(w / 2 + 0.3, -0.6);
  slope(pic, r0, r1, eave, { x: -f.front.x * (d + 0.8), z: -f.front.z * (d + 0.8) }, backH + 0.1, roofMat, L);
  wall(pic, r0, r1, eave - 0.45, eave, p.roof === "red" ? white : trim, L);
  const posts = Math.max(2, Math.round(w / 7));
  for (let k = 0; k <= posts; k++)
    box(pic, f.point(-w / 2 + (k * w) / posts, 0.4), facing, 0.2, 0.2, wallH, eave, { front: post, sides: post }, L);
}

function* bank(pic, p) {
  const grass = bankGrass(p.seed ?? 31, p.rugs ?? 0.1);
  const L = LAYER.ground;
  const rise = Math.hypot(p.r1 - p.r0, p.height);
  arc(p.from, p.to, p.r0, p.r1, (a0, b0, a1, b1, u0) => {
    drawFace(
      pic,
      face([V(a0.x, 0, a0.z), V(b0.x, 0, b0.z), V(b1.x, p.height, b1.z), V(a1.x, p.height, a1.z)], grass, L, {
        outward: V(-(a0.x + b0.x), 40, -(a0.z + b0.z)),
        u0,
        flags: FLAG.shadowed,
      }),
    );
  });
  if (p.top) {
    arc(p.from, p.to, p.r1, p.top, (a0, b0, a1, b1, u0) => {
      drawFace(
        pic,
        face([V(a0.x, p.height, a0.z), V(b0.x, p.height, b0.z), V(b1.x, p.height, b1.z), V(a1.x, p.height, a1.z)], grass, L, {
          outward: V(0, 1, 0),
          u0,
          v0: rise,
          flags: FLAG.shadowed,
        }),
      );
    });
  }
  yield;
  // Spectators sitting on the slope (a few standing at the top), and the odd umbrella.
  const span = (p.to - p.from + 360) % 360;
  const area = ((span * Math.PI) / 180) * ((p.r0 + p.r1) / 2) * rise;
  const count = Math.round(area * (p.people ?? 0));
  const seed = p.seed ?? 31;
  for (let i = 0; i < count; i++) {
    const k = hash(i, 1, seed);
    const along = Math.sqrt(hash(i, 2, seed));
    const r = p.r0 + 1.2 + (p.r1 - p.r0 - 1.2) * along;
    const pt = polar(p.from + span * k, r);
    const y = (p.height * (r - p.r0)) / (p.r1 - p.r0);
    const make = hash(i, 3, seed) < 0.03 ? () => umbrellaSprite(i) : () => personSprite(i * 7 + seed, along > 0.94);
    drawSprite(pic, V(pt.x, y, pt.z), make, LAYER.crowd, 0, 2.2);
    if (i % 120 === 119) yield;
  }
}

function scoreboard(pic, p) {
  const c = polar(p.bearing, p.radius);
  const facing = front(p.bearing);
  const f = frame(c, facing);
  const L = LAYER.buildings;
  const w = p.width;
  const base = p.base;
  const top = base + 7.2;
  const faceW = w - 2;
  const faceH = 4.6;
  const board = scoreboardFace(faceW, faceH);
  const frontMat = (u, v, ppm, x, y) => {
    if (u > 1 && u < 1 + faceW && v > 1.6 && v < 1.6 + faceH) return board(u - 1, v - 1.6, ppm);
    if (v < 1.4 && Math.abs(u - w / 2) < 0.6) return PAL.shadowIn;
    return weatherboard()(u, v, ppm, x, y);
  };
  box(pic, c, facing, w, 3.5, base, top, { front: frontMat, sides: weatherboard(), back: weatherboard() }, L);
  pitchedRoof(pic, c, facing, w, 3.5, top, top + 1.5, iron(), weatherboard(), L, 0.4);
  flagpole(pic, V(c.x - f.front.x * 1.75, top + 1.5, c.z - f.front.z * 1.75), 3.2, f);
}

function tents(pic, p) {
  const n = p.colours.length;
  const span = (p.to - p.from + 360) % 360;
  p.colours.forEach((colour, i) => {
    const c = polar(p.from + (span * (i + 0.5)) / n, p.radius);
    const facing = front(p.from + (span * (i + 0.5)) / n);
    const stripes = striped([1, 3, 5].map((k) => parseInt(colour.slice(k, k + 2), 16)));
    box(pic, c, facing, 6, 5, 0, 2.4, { front: stripes, sides: stripes, back: stripes }, LAYER.buildings);
    pyramidRoof(pic, c, facing, 6.4, 5.4, 2.4, 4.3, flat(PAL.canvas, 5, 9), LAYER.buildings);
  });
}

function floodlight(pic, p) {
  const c = polar(p.bearing, p.radius);
  const facing = front(p.bearing);
  const f = frame(c, facing);
  const L = LAYER.buildings;
  const lattice = (u, v, ppm, x, y) =>
    ppm > 4 && (Math.floor((u + v) * 2) + Math.floor((u - v) * 2)) % 2 === 0 ? PAL.steelDark : PAL.steel;
  box(pic, c, facing, 1.2, 1.2, 0, p.height, { front: lattice, sides: lattice, back: lattice }, L);
  const head = f.point(0, -0.8);
  box(
    pic,
    head,
    facing,
    7.5,
    0.8,
    p.height - 1,
    p.height + 3.6,
    { front: lampHead(), sides: steel, back: steel, top: steel },
    L,
    { flags: 0 },
  );
}

function screen(pic, p, ctx) {
  const c = polar(p.bearing, p.radius);
  const frameMat = flat(PAL.screenFrame, 4, 12);
  box(
    pic,
    c,
    front(p.bearing),
    p.width,
    0.4,
    0,
    p.height,
    { front: sightscreen(ctx.ballKind === "white"), sides: frameMat, back: frameMat, top: frameMat },
    LAYER.buildings,
  );
}

/** Where tree `i` of a stand of trees grows, how tall and what kind (also for its shadow: venue-light.js). */
export function treePlacement(p, i) {
  const span = (p.to - p.from + 360) % 360;
  const seed = (p.seed ?? 51) * 1000 + i;
  const pt = polar(p.from + span * hash(i, 1, seed), p.r0 + (p.r1 - p.r0) * hash(i, 2, seed));
  const height = p.height[0] + (p.height[1] - p.height[0]) * hash(i, 3, seed);
  return { x: pt.x, z: pt.z, height, base: p.base ?? 0, kind: p.kinds[Math.floor(hash(i, 4, seed) * p.kinds.length)], seed };
}

function* trees(pic, p) {
  for (let i = 0; i < p.count; i++) {
    const t = treePlacement(p, i);
    drawSprite(pic, V(t.x, t.base, t.z), () => treeSprite(t.kind, t.height, t.seed), LAYER.trees, 0, t.height);
    if (i % 12 === 11) yield;
  }
}

function fence(pic, map) {
  const r = map.fence.radius;
  const pk = pickets(map.fence.height);
  arc(0, 360, r, r, (a, b, _a1, _b1, u0) => wall(pic, a, b, 0, map.fence.height, pk, LAYER.fence, { twoSided: true, u0 }), 2.5);
}

const KINDS = { pavilion, terrace, stand, bank, scoreboard, tents, floodlight, sightscreen: screen, trees };

/**
 * Every part of the map into the picture, a little at a time: it pauses (yields) after each part, and
 * within the big ones (stands of trees, crowds on banks), so it can be spread over frames. ctx: { ballKind }.
 */
export function* partsWork(pic, map, ctx = {}) {
  for (const part of map.parts) {
    const work = KINDS[part.kind](pic, part, ctx);
    if (work?.next) yield* work;
    yield;
  }
  fence(pic, map);
}

/** Every part of the map into the picture at once (the tools). */
export function drawParts(pic, map, ctx = {}) {
  for (const _ of partsWork(pic, map, ctx));
}

export const PART_KINDS = Object.keys(KINDS);
