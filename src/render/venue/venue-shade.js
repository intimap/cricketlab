/**
 * Soft shade on the ground from distance fields, for the relight (venue-light.js): each a coarse grid over
 * the ground holding how far (m) every spot is from an edge, read back smoothly.
 *   - Shadows get an edge that's crisp beside whatever throws them and wider the further they fall, in a
 *     few flat bands (pixel art, not a blur).
 *   - Whatever stands on the ground darkens the ground at its foot, so it sits on it.
 * Thin things (a floodlight's tower) are narrower than a cell, so the exact shadow test still decides where
 * a shadow is; the field only softens its edge.
 */

const CELL = 2;
const SIDE = 224;
const HALF = (SIDE * CELL) / 2;
/** How far (m) the darkening at the foot of things reaches, and how dark it gets there. */
const CONTACT_REACH = 4.5;
const CONTACT_DEPTH = 0.2;
/** A shadow's edge: this wide (m) beside its caster, wider by this much a metre away from it, at most this. */
const EDGE = { least: 1, per: 0.11, most: 7 };
/** The bands a shadow's edge is drawn in (how much in shadow), outside to inside. */
const BANDS = [0, 0.36, 0.7, 1];

/** Is map point (x, z) inside the convex polygon `pts`? */
export function inHull(pts, x, z) {
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

/** How far (m) each cell is from the nearest marked one (0 on them): a two-pass chamfer over the grid. */
function distances(marked) {
  const d = new Float32Array(SIDE * SIDE);
  const far = 1e6;
  for (let i = 0; i < d.length; i++) d[i] = marked[i] ? 0 : far;
  const A = CELL;
  const B = CELL * Math.SQRT2;
  for (let j = 0; j < SIDE; j++)
    for (let i = 0; i < SIDE; i++) {
      const k = j * SIDE + i;
      let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + A);
      if (j > 0) {
        v = Math.min(v, d[k - SIDE] + A);
        if (i > 0) v = Math.min(v, d[k - SIDE - 1] + B);
        if (i < SIDE - 1) v = Math.min(v, d[k - SIDE + 1] + B);
      }
      d[k] = v;
    }
  for (let j = SIDE - 1; j >= 0; j--)
    for (let i = SIDE - 1; i >= 0; i--) {
      const k = j * SIDE + i;
      let v = d[k];
      if (i < SIDE - 1) v = Math.min(v, d[k + 1] + A);
      if (j < SIDE - 1) {
        v = Math.min(v, d[k + SIDE] + A);
        if (i < SIDE - 1) v = Math.min(v, d[k + SIDE + 1] + B);
        if (i > 0) v = Math.min(v, d[k + SIDE - 1] + B);
      }
      d[k] = v;
    }
  return d;
}

/** A grid's value at map point (x, z), smoothed between cells; `outside` beyond the grid. */
function sample(grid, x, z, outside) {
  const fx = (x + HALF) / CELL - 0.5;
  const fz = (z + HALF) / CELL - 0.5;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= SIDE - 1 || j >= SIDE - 1) return outside;
  const a = fx - i;
  const b = fz - j;
  const k = j * SIDE + i;
  return (grid[k] * (1 - a) + grid[k + 1] * a) * (1 - b) + (grid[k + SIDE] * (1 - a) + grid[k + SIDE + 1] * a) * b;
}

const cellOf = (v) => Math.floor((v + HALF) / CELL);
const centre = (i) => (i + 0.5) * CELL - HALF;

/**
 * How far every spot on the ground is from the foot of something standing on it. `feet`: convex plan
 * polygons; `points`: plan points (a tree's trunk).
 */
export function footDistances(feet, points) {
  const marked = new Uint8Array(SIDE * SIDE);
  const mark = (x, z) => {
    const i = cellOf(x);
    const j = cellOf(z);
    if (i >= 0 && j >= 0 && i < SIDE && j < SIDE) marked[j * SIDE + i] = 1;
  };
  for (const pts of feet) {
    // Its corners always (a thin thing can miss every cell's centre), then every cell whose centre is in it.
    for (const p of pts) mark(p.x, p.z);
    const i0 = Math.max(0, cellOf(Math.min(...pts.map((p) => p.x))));
    const i1 = Math.min(SIDE - 1, cellOf(Math.max(...pts.map((p) => p.x))));
    const j0 = Math.max(0, cellOf(Math.min(...pts.map((p) => p.z))));
    const j1 = Math.min(SIDE - 1, cellOf(Math.max(...pts.map((p) => p.z))));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inHull(pts, centre(i), centre(j))) marked[j * SIDE + i] = 1;
  }
  for (const p of points) mark(p.x, p.z);
  return distances(marked);
}

/** The darkening at the foot of things: (x, z) -> what to multiply the ground's light by (1 away from them). */
export function contactShade(foot) {
  return (x, z) => {
    const d = sample(foot, x, z, CONTACT_REACH);
    if (d >= CONTACT_REACH) return 1;
    // Three steps, darkest against the foot.
    const k = 1 - d / CONTACT_REACH;
    return 1 - CONTACT_DEPTH * (k > 0.66 ? 1 : k > 0.33 ? 0.6 : 0.28);
  };
}

/**
 * A soft-edged shadow: (x, z) -> how much in shadow (one of BANDS). `hard(x, z)` is the exact test; `foot`
 * the distances from footDistances, for how wide the edge is here.
 */
export function softShadow(hard, foot) {
  const inside = new Uint8Array(SIDE * SIDE);
  const outside = new Uint8Array(SIDE * SIDE);
  for (let j = 0; j < SIDE; j++)
    for (let i = 0; i < SIDE; i++) {
      const s = hard(centre(i), centre(j));
      inside[j * SIDE + i] = s ? 1 : 0;
      outside[j * SIDE + i] = s ? 0 : 1;
    }
  // Signed: metres inside the shadow's edge (positive) or outside it (negative).
  const toShadow = distances(inside);
  const toLight = distances(outside);
  const signed = new Float32Array(SIDE * SIDE);
  for (let k = 0; k < signed.length; k++) signed[k] = inside[k] ? toLight[k] - CELL / 2 : CELL / 2 - toShadow[k];
  return (x, z) => {
    const sharp = hard(x, z);
    const d = sample(signed, x, z, sharp ? 99 : -99);
    const width = Math.min(EDGE.most, EDGE.least + EDGE.per * sample(foot, x, z, 99));
    const k = 0.5 + d / width;
    const band = k <= 0.17 ? 0 : k <= 0.5 ? 1 : k <= 0.83 ? 2 : 3;
    // Where the exact shadow is, it's never lighter than the second band (thin shadows keep their shape).
    return BANDS[sharp ? Math.max(2, band) : Math.min(1, band)];
  };
}
