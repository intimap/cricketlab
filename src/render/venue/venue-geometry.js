import { drawFace } from "./venue-raster.js";
import { polar } from "./venue-map.js";

/**
 * Building blocks for the parts kit (venue-parts.js), in the map's frame. Plan points are { x, z } on
 * the ground; a part's front faces the way of its `facing` bearing (degrees). Every face is given its
 * points bottom-left first as seen from outside, so its material's u runs left to right and v upwards.
 */

export const V = (x, y, z) => ({ x, y, z });
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const unit = (a) => {
  const l = len(a) || 1;
  return V(a.x / l, a.y / l, a.z / l);
};
const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const at = (p, y) => V(p.x, y, p.z);

/** A face through `points` (bottom-left first), its u along bottom-left to bottom-right. */
export function face(points, material, layer, opts = {}) {
  const a = points[0];
  const b = points[1];
  const d = points[points.length - 1];
  let n = unit(cross(sub(d, a), sub(b, a)));
  if (opts.outward && dot(n, opts.outward) < 0) n = V(-n.x, -n.y, -n.z);
  const u = unit(sub(b, a));
  const v = unit(cross(u, n));
  const shade =
    opts.u0 || opts.v0 ? (uu, vv, ppm, x, y) => material(uu + (opts.u0 ?? 0), vv + (opts.v0 ?? 0), ppm, x, y) : material;
  return {
    points,
    normal: n,
    origin: a,
    u,
    v,
    shade,
    layer,
    flags: opts.flags ?? 0,
    twoSided: !!opts.twoSided,
    bright: opts.bright ?? 1,
  };
}

/** A vertical wall from plan point p to q (left to right from outside), between heights y0 and y1. */
export function wall(pic, p, q, y0, y1, material, layer, opts = {}) {
  drawFace(pic, face([at(p, y0), at(q, y0), at(q, y1), at(p, y1)], material, layer, opts));
}

/** A face whose bottom edge p-q is at height y0 and top edge (each moved by `back`, a plan vector) at y1. */
export function slope(pic, p, q, y0, back, y1, material, layer, opts = {}) {
  const p1 = V(p.x + back.x, y1, p.z + back.z);
  const q1 = V(q.x + back.x, y1, q.z + back.z);
  drawFace(pic, face([at(p, y0), at(q, y0), q1, p1], material, layer, { outward: V(-back.x, 1, -back.z), ...opts }));
}

/** The frame of a part whose front centre is at plan point `c`, facing `bearing`: front and right unit vectors. */
export function frame(c, bearing) {
  const a = (bearing * Math.PI) / 180;
  const front = { x: Math.sin(a), z: Math.cos(a) };
  // Its right as seen from in front of it, looking back at it.
  const right = { x: -Math.cos(a), z: Math.sin(a) };
  /** Plan point `across` m to the right of the front centre and `back` m behind the front. */
  const point = (across, back) => ({ x: c.x + right.x * across - front.x * back, z: c.z + right.z * across - front.z * back });
  return { front, right, point };
}

/**
 * A box: `w` wide, `d` deep, from y0 to y1, its front at `c` facing `bearing`. `materials`: { front, back,
 * sides, top } (any left out isn't drawn). Returns its corners.
 */
export function box(pic, c, bearing, w, d, y0, y1, materials, layer, opts = {}) {
  const f = frame(c, bearing);
  const FL = f.point(-w / 2, 0);
  const FR = f.point(w / 2, 0);
  const BR = f.point(w / 2, d);
  const BL = f.point(-w / 2, d);
  if (materials.front) wall(pic, FL, FR, y0, y1, materials.front, layer, opts);
  if (materials.sides) {
    wall(pic, FR, BR, y0, y1, materials.sides, layer, opts);
    wall(pic, BL, FL, y0, y1, materials.sides, layer, opts);
  }
  if (materials.back) wall(pic, BR, BL, y0, y1, materials.back, layer, opts);
  if (materials.top)
    drawFace(pic, face([at(FL, y1), at(FR, y1), at(BR, y1), at(BL, y1)], materials.top, layer, { outward: V(0, 1, 0), ...opts }));
  return { FL, FR, BR, BL, frame: f };
}

/**
 * A pitched roof over a w x d plan from eaves at `eave` to a ridge at `ridge` running across (left to
 * right), with vertical gable ends. `overhang` m past the walls all round.
 */
export function pitchedRoof(pic, c, bearing, w, d, eave, ridge, material, gable, layer, overhang = 0.5) {
  const f = frame(c, bearing);
  const half = w / 2 + overhang;
  const FL = f.point(-half, -overhang);
  const FR = f.point(half, -overhang);
  const BL = f.point(-half, d + overhang);
  const BR = f.point(half, d + overhang);
  const RL = f.point(-half, d / 2);
  const RR = f.point(half, d / 2);
  const toRidge = { x: RL.x - FL.x, z: RL.z - FL.z };
  slope(pic, FL, FR, eave, toRidge, ridge, material, layer);
  slope(pic, BR, BL, eave, { x: RR.x - BR.x, z: RR.z - BR.z }, ridge, material, layer);
  if (!gable) return;
  const gl = f.point(-w / 2, 0);
  const gr = f.point(w / 2, 0);
  const gbl = f.point(-w / 2, d);
  const gbr = f.point(w / 2, d);
  const ml = f.point(-w / 2, d / 2);
  const mr = f.point(w / 2, d / 2);
  drawFace(pic, face([at(gr, eave), at(gbr, eave), at(mr, ridge)], gable, layer, { outward: V(f.right.x, 0, f.right.z) }));
  drawFace(pic, face([at(gbl, eave), at(gl, eave), at(ml, ridge)], gable, layer, { outward: V(-f.right.x, 0, -f.right.z) }));
}

/** A pyramid roof (a marquee's) over a w x d plan, from `eave` to a point at `peak`. */
export function pyramidRoof(pic, c, bearing, w, d, eave, peak, material, layer) {
  const f = frame(c, bearing);
  const P = f.point(0, d / 2);
  const top = V(P.x, peak, P.z);
  const corners = [f.point(-w / 2, 0), f.point(w / 2, 0), f.point(w / 2, d), f.point(-w / 2, d)];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const mid = { x: (a.x + b.x) / 2 - P.x, z: (a.z + b.z) / 2 - P.z };
    drawFace(pic, face([at(a, eave), at(b, eave), top], material, layer, { outward: V(mid.x, 1, mid.z) }));
  }
}

/**
 * An arc round the ground, from `from` to `to` degrees, in steps of about `step` metres at radius r0:
 * calls segment(p0, q0, p1, q1, u0) with plan points at r0 and r1 for each step, u0 the arc length so far.
 */
export function arc(from, to, r0, r1, segment, step = 2.5) {
  const span = (to - from + 360) % 360 || 360;
  const n = Math.max(1, Math.ceil(((span * Math.PI) / 180) * (r0 / step)));
  for (let i = 0; i < n; i++) {
    const a = from + (span * i) / n;
    const b = from + (span * (i + 1)) / n;
    segment(polar(a, r0), polar(b, r0), polar(a, r1), polar(b, r1), ((a - from) * Math.PI * r0) / 180);
  }
}
