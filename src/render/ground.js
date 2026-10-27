import { clamp } from "../math.js";
import { PITCH_LENGTH } from "../sim/geometry.js";
import { CLOSE_Y_OFFSET, closeGroundY, closeRowDepth, projectFromStriker, projectWide, ROPE } from "./camera.js";
import { PITCH_LOOKS } from "./grounds.js";

/**
 * The layer compositor: builds each view's background once (per match, and
 * again as the pitch wears) from a ground's data (grounds.js). Hand-painted
 * scenery comes from a painting; the outfield, pitch, creases, stumps and
 * rope are drawn here from the camera's own geometry, so they always line up.
 *
 * Returns { close, wide }: canvases the size of the paintings, drawn exactly
 * where the paintings used to be.
 */

const W = 640;
const H = 360;
// The pitch: 3.05 m wide, running a little past each set of stumps.
const PITCH_HALF = 1.52;
const PITCH_FROM = -1.3;
const PITCH_TO = PITCH_LENGTH + 1.3;
// The creases (m).
const POPPING = 1.22;
const POPPING_HALF = 1.83;
const RETURN_X = 1.32;
const CREASE_HALF = 0.025;
const STUMP_X = [-0.114, 0, 0.114];
const STUMP_HEIGHT = 0.71;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const shade = (c, d) => c.map((v) => v + d);

/** Deterministic noise in [0, 1) for pixel (x, y). */
function hash(x, y, seed) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** A surface pixel: the base colour with a little jitter, and now and then a lighter blade or a darker speck. */
function texture(base, x, y, seed, speck) {
  const h = hash(x, y, seed);
  if (h < 0.03) return shade(base, 16);
  if (h < 0.06) return speck ?? shade(base, -14);
  return shade(base, (hash(x + 911, y, seed) - 0.5) * 6);
}

/** Read/write access to a canvas's pixels. */
class Pixels {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.img = this.ctx.getImageData(0, 0, W, H);
  }
  put(x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const d = this.img.data;
    d[i] = clamp(Math.round(c[0]), 0, 255);
    d[i + 1] = clamp(Math.round(c[1]), 0, 255);
    d[i + 2] = clamp(Math.round(c[2]), 0, 255);
    d[i + 3] = 255;
  }
  blend(x, y, c, t) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const d = this.img.data;
    this.put(x, y, mix([d[i], d[i + 1], d[i + 2]], c, t));
  }
  done() {
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
}

function paintingCanvas(painting) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.getContext("2d").drawImage(painting, 0, 0, W, H);
  return canvas;
}

/** Is a distance down the ground in a light stripe? `edges` are where light and dark swap. */
function lightStripe(stripes, z) {
  let band = 0;
  for (const e of stripes.edges) if (z >= e) band++;
  // Band 1 lies between the first and second edges.
  return (band % 2 === 1) === stripes.firstLight;
}

/** The pitch's colours for its type and wear. */
function pitchColours(pitch) {
  const look = PITCH_LOOKS[pitch.type.id] ?? PITCH_LOOKS.green;
  const wear = clamp(pitch.wear * 1.6, 0, 0.75);
  return { look, base: mix(rgb(look.base), rgb(look.worn), wear), speck: rgb(look.speck) };
}

/** Seeded crack lines across the pitch, in world coordinates. */
function cracks(count, seed) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let x = (hash(i, 1, seed) - 0.5) * 2.4;
    let z = 1 + hash(i, 2, seed) * (PITCH_LENGTH - 2);
    let a = hash(i, 3, seed) * Math.PI * 2;
    const line = [{ x, z }];
    const steps = 4 + Math.floor(hash(i, 4, seed) * 5);
    for (let s = 0; s < steps; s++) {
      a += (hash(i, 10 + s, seed) - 0.5) * 1.6;
      x = clamp(x + Math.cos(a) * 0.12, -PITCH_HALF + 0.05, PITCH_HALF - 0.05);
      z += Math.sin(a) * 0.35;
      line.push({ x, z });
    }
    out.push(line);
  }
  return out;
}

// --- Close view ------------------------------------------------------------

export function buildClose(ground, painting, pitch, seed = 1) {
  const px = new Pixels(paintingCanvas(painting));
  const view = ground.close;
  const light = rgb(ground.grass.light);
  const dark = rgb(ground.grass.dark);
  const haze = rgb(view.haze.colour);
  const surround = rgb(ground.surround.colour);
  const fleck = rgb(ground.surround.fleck);
  const edge = rgb(ground.surround.edge);
  const sw = ground.surround.width;
  const { look, base: pitchBase, speck } = pitchColours(pitch);
  // File row for a depth z (the painting is drawn CLOSE_Y_OFFSET higher than its rows).
  const rowOf = (z) => closeGroundY(z) - CLOSE_Y_OFFSET;
  const xAt = (wx, z) => projectFromStriker(wx, 0, z).x;

  // Outfield stripes, the worn surround and the pitch, row by row.
  for (let y = view.groundFrom; y < H; y++) {
    const z = closeRowDepth(y + CLOSE_Y_OFFSET);
    let grass = lightStripe(view.stripes, z) ? light : dark;
    const fade = 1 - (y - view.groundFrom) / view.haze.rows;
    if (fade > 0) grass = mix(grass, haze, view.haze.amount * fade);
    const onPitch = z >= PITCH_FROM && z <= PITCH_TO;
    const onSurround = z >= PITCH_FROM - sw * 2 && z <= PITCH_TO + sw * 2;
    const pL = xAt(-PITCH_HALF, z);
    const pR = xAt(PITCH_HALF, z);
    const sL = xAt(-PITCH_HALF - sw, z);
    const sR = xAt(PITCH_HALF + sw, z);
    // The dark edge line is a couple of pixels wide close up, one far away.
    const edgeW = Math.max(1, Math.round((sR - pR) * 0.18));
    for (let x = 0; x < W; x++) {
      let c;
      if (onPitch && x >= pL && x < pR) c = texture(pitchBase, x, y, seed + 3, speck);
      else if (onSurround && x >= sL && x < sR) {
        const outer = x < sL + edgeW || x >= sR - edgeW;
        c = outer ? texture(edge, x, y, seed + 5) : texture(surround, x, y, seed + 4, fleck);
      } else c = texture(grass, x, y, seed);
      px.put(x, y, c);
    }
  }

  // Fill a world-space rectangle on the ground (x1..x2 across, z1..z2 along); at least one pixel each way.
  const fillWorld = (x1, x2, z1, z2, colour, blend = 1) => {
    const yTop = Math.round(rowOf(z2));
    const yBot = Math.max(yTop, Math.round(rowOf(z1)) - 1);
    for (let y = yTop; y <= yBot; y++) {
      const z = yBot === yTop ? (z1 + z2) / 2 : closeRowDepth(y + CLOSE_Y_OFFSET);
      const a = Math.round(xAt(x1, z));
      const b = Math.max(a + 1, Math.round(xAt(x2, z)));
      for (let x = a; x < b; x++) px.blend(x, y, colour, blend);
    }
  };

  // Cracks, if this pitch has them.
  if (look.cracks) {
    const crackColour = shade(speck, -26);
    for (const line of cracks(look.cracks, seed + 9)) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const steps = 8;
        for (let s = 0; s <= steps; s++) {
          const wx = a.x + ((b.x - a.x) * s) / steps;
          const wz = a.z + ((b.z - a.z) * s) / steps;
          px.blend(Math.round(xAt(wx, wz)), Math.round(rowOf(wz)), crackColour, 0.8);
        }
      }
    }
  }

  // Scuffed earth where the bowlers land and the batters stand.
  const scuff = shade(mix(pitchBase, rgb(look.worn), 0.6), -18);
  fillWorld(-0.45, 0.45, -0.3, 0.4, scuff, 0.45);
  fillWorld(-0.45, 0.45, PITCH_LENGTH - 0.4, PITCH_LENGTH + 0.3, scuff, 0.45);

  // Creases: bowling, popping and return, at both ends.
  const white = rgb(ground.crease);
  for (const [zBowl, sign] of [
    [0, 1],
    [PITCH_LENGTH, -1],
  ]) {
    const zPop = zBowl + sign * POPPING;
    fillWorld(-RETURN_X, RETURN_X, zBowl - CREASE_HALF, zBowl + CREASE_HALF, white);
    fillWorld(-POPPING_HALF, POPPING_HALF, zPop - CREASE_HALF, zPop + CREASE_HALF, white);
    for (const x of [-RETURN_X, RETURN_X]) {
      const zBack = zBowl - sign * POPPING;
      fillWorld(x - CREASE_HALF * 1.6, x + CREASE_HALF * 1.6, Math.min(zPop, zBack), Math.max(zPop, zBack), white);
    }
  }

  // The far stumps (the near ones are a separate sprite, drawn over the striker).
  const wood = rgb(ground.stumps.wood);
  const woodShade = rgb(ground.stumps.shade);
  const bail = rgb(ground.stumps.bail);
  let top = H;
  for (const sx of STUMP_X) {
    const base = projectFromStriker(sx, 0, PITCH_LENGTH);
    const tip = projectFromStriker(sx, STUMP_HEIGHT, PITCH_LENGTH);
    const x = Math.round(base.x);
    top = Math.round(tip.y - CLOSE_Y_OFFSET);
    for (let y = top; y <= Math.round(base.y - CLOSE_Y_OFFSET); y++) {
      px.put(x, y, wood);
      px.put(x + 1, y, woodShade);
    }
  }
  const bl = Math.round(projectFromStriker(STUMP_X[0], 0, PITCH_LENGTH).x);
  const br = Math.round(projectFromStriker(STUMP_X[2], 0, PITCH_LENGTH).x) + 1;
  for (let x = bl; x <= br; x++) px.put(x, top - 1, bail);

  return px.done();
}

// --- Wide view -------------------------------------------------------------

export function buildWide(ground, painting, pitch, seed = 1) {
  const px = new Pixels(paintingCanvas(painting));
  const view = ground.wide;
  const light = rgb(view.grass.light);
  const dark = rgb(view.grass.dark);
  const surround = rgb(ground.surround.colour);
  const edge = rgb(ground.surround.edge);
  const { base: pitchBase, speck } = pitchColours(pitch);
  const rope = rgb(view.rope.colour);
  const ropeShade = rgb(view.rope.shade);
  const ring = view.innerCircle;
  const ringColour = rgb(ring.colour);
  const white = rgb(ground.crease);

  const top = Math.floor(ROPE.cy - ROPE.ryFar);
  const bottom = Math.ceil(ROPE.cy + ROPE.ryNear);
  for (let y = top; y <= bottom; y++) {
    const ry = y < ROPE.cy ? ROPE.ryFar : ROPE.ryNear;
    const dy = (y - ROPE.cy) / ry;
    let band = 0;
    for (const e of view.stripes.edgesY) if (y >= e) band++;
    const grass = (band % 2 === 1) === view.stripes.firstLight ? light : dark;
    for (let x = 0; x < W; x++) {
      const dx = (x - ROPE.cx) / ROPE.rx;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      // Pixels in from the rope, roughly.
      const inFrom = (1 - d) * Math.min(ROPE.rx, ry);
      if (inFrom < 1) {
        px.put(x, y, rope);
        continue;
      }
      if (inFrom < 2) {
        px.put(x, y, ropeShade);
        continue;
      }
      px.put(x, y, texture(grass, x, y, seed));
      // The fielding circle.
      const cx = (x - ring.cx) / ring.rx;
      const cy = (y - ring.cy) / ring.ry;
      if (Math.abs(Math.sqrt(cx * cx + cy * cy) - 1) * ring.ry < 0.55) px.blend(x, y, ringColour, 0.75);
    }
  }

  // The pitch, its rim and creases. Lengthways they come from the camera's mapping;
  // across, the wide view draws the strip narrower than true (as the painting did) - see wide.pitch.
  const shape = view.pitch;
  const cx = Math.round(projectWide(0, 0, 0).x);
  const yOf = (z) => Math.round(projectWide(0, 0, z).y);
  const yFar = yOf(PITCH_TO);
  const yNear = yOf(PITCH_FROM);
  const rim = shape.rim;
  // Slightly narrower at the far end.
  const halfAt = (y) => Math.round(shape.halfFar + ((shape.halfNear - shape.halfFar) * (y - yFar)) / Math.max(1, yNear - yFar));
  for (let y = yFar - rim; y <= yNear + rim; y++) {
    const half = halfAt(clamp(y, yFar, yNear));
    for (let x = cx - half - rim; x <= cx + half + rim; x++) {
      const inPitch = y >= yFar && y <= yNear && Math.abs(x - cx) <= half;
      const outerRim = Math.abs(x - cx) > half + rim - 1 || y < yFar - rim + 1 || y > yNear + rim - 1;
      if (inPitch) px.put(x, y, texture(pitchBase, x, y, seed + 3, speck));
      else if (outerRim) px.put(x, y, texture(edge, x, y, seed + 5));
      else px.put(x, y, texture(surround, x, y, seed + 4, rgb(ground.surround.fleck)));
    }
  }
  const across = (y, h) => {
    for (let x = cx - h; x <= cx + h; x++) px.put(x, y, white);
  };
  const wood = rgb(ground.stumps.wood);
  const woodShade = rgb(ground.stumps.shade);
  for (const [zBowl, sign] of [
    [0, 1],
    [PITCH_LENGTH, -1],
  ]) {
    const yBowl = yOf(zBowl);
    const yPop = yOf(zBowl + sign * POPPING);
    const half = halfAt(yBowl);
    across(yBowl, half - 2);
    across(yPop, half + rim - 2);
    for (const x of [cx - half + 2, cx + half - 2]) {
      for (let y = Math.min(yBowl, yPop) - 2; y <= Math.max(yBowl, yPop) + 2; y++) px.put(x, y, white);
    }
    // Stumps standing up from the bowling crease, seen from behind.
    for (let y = yBowl - shape.stumps; y <= yBowl; y++) {
      for (const dx of [-2, 0, 2]) {
        px.put(cx + dx, y, woodShade);
        px.put(cx + dx + 1, y, wood);
      }
    }
  }
  return px.done();
}

/** Both views for a ground and the current state of the pitch. */
export function buildGround(ground, images, pitch, seed = 1) {
  return {
    close: buildClose(ground, images[ground.close.scenery], pitch, seed),
    wide: buildWide(ground, images[ground.wide.scenery], pitch, seed),
  };
}
