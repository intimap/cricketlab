import { MID_PITCH, BOUNDARY, STUMPS_HALF_WIDTH, PITCH_LENGTH } from "../sim/geometry.js";

// Two hand-tuned projections, each matched to its background painting.

// --- Close camera: low behind one set of stumps, looking down the pitch. ---
// It normally sits behind the striker; it can swap to behind the bowler, where
// the same painting serves (the two ends look alike) with the world turned round.

/** Vertical offset of the close-camera background and everything drawn on it. */
export const CLOSE_Y_OFFSET = -24;
const HORIZON_Y = 69.2;
const DEPTH_GAIN = 2250;
const CAMERA_Z = 8.53;
const LATERAL_GAIN = 880;
const HEIGHT_GAIN = 700;

// Widen the stumps a little so the ball's line against them reads clearly.
function warpLateral(x) {
  const a = Math.abs(x);
  const w = a <= STUMPS_HALF_WIDTH ? a * 1.75 : 0.1995 + (a - STUMPS_HALF_WIDTH) * 0.95;
  return Math.sign(x) * w;
}

let fromBowlerEnd = false;

/** Put the close camera behind the bowler (true) or behind the striker (false). */
export function setCloseEnd(bowlerEnd) {
  fromBowlerEnd = bowlerEnd;
}

export const closeFromBowlerEnd = () => fromBowlerEnd;

/** How far down the pitch a world z is from the camera's end (its stumps are at 0). */
export function closeDepth(z) {
  return fromBowlerEnd ? PITCH_LENGTH - z : z;
}

function depthScale(depth) {
  return 1 / Math.max(0.6, depth + CAMERA_Z);
}

/** Screen y of the ground at a depth from the camera's end. */
export function closeGroundY(depth) {
  return HORIZON_Y + DEPTH_GAIN * depthScale(depth) + CLOSE_Y_OFFSET;
}

/** Inverse of closeGroundY: the depth (m from the camera's end) of the ground at screen row y. */
export function closeRowDepth(y) {
  return DEPTH_GAIN / Math.max(0.01, y - CLOSE_Y_OFFSET - HORIZON_Y) - CAMERA_Z;
}

/** World point to screen as seen from behind the striker, whichever end the camera is at. */
export function projectFromStriker(x, y, z) {
  const s = depthScale(z);
  return { x: 320 + warpLateral(x) * LATERAL_GAIN * s, y: closeGroundY(z) - y * HEIGHT_GAIN * s, s };
}

/** World point to screen: { x, y, s } where s is the depth scale. */
export function projectClose(x, y, z) {
  return fromBowlerEnd ? projectFromStriker(-x, y, PITCH_LENGTH - z) : projectFromStriker(x, y, z);
}

/** Screen pixels per metre of height at world z. */
export function closePixelsPerMetre(z) {
  return HEIGHT_GAIN * depthScale(closeDepth(z));
}

// --- Wide camera: high behind the bowler's end, whole ground in view. ---
// Piecewise linear: the pitch gets more room than the outfield.

const WIDE_CX = 319;
const WIDE_CY = 200;
const WIDE_HALF_PITCH = 46;
const WIDE_NEAR_Y = 330;
const WIDE_FAR_Y = 110;
const WIDE_HALF_W = 299;
const WIDE_PITCH_PX = 20;

/** Screen y for a distance `d` along the pitch from the centre (positive = towards the camera). */
function wideY(d) {
  if (Math.abs(d) <= MID_PITCH) return WIDE_CY + (d / MID_PITCH) * WIDE_HALF_PITCH;
  if (d > 0) {
    return WIDE_CY + WIDE_HALF_PITCH + ((d - MID_PITCH) / (BOUNDARY - MID_PITCH)) * (WIDE_NEAR_Y - WIDE_CY - WIDE_HALF_PITCH);
  }
  return WIDE_CY - WIDE_HALF_PITCH - ((-d - MID_PITCH) / (BOUNDARY - MID_PITCH)) * (WIDE_CY - WIDE_HALF_PITCH - WIDE_FAR_Y);
}

function wideX(x) {
  const a = Math.abs(x);
  const w =
    a <= 1.5 ? a * WIDE_PITCH_PX : 1.5 * WIDE_PITCH_PX + ((a - 1.5) / (BOUNDARY - 1.5)) * (WIDE_HALF_W - 1.5 * WIDE_PITCH_PX);
  return WIDE_CX + Math.sign(x) * w;
}

/** Ground point to screen through the piecewise-linear mapping alone. */
function rawWide(x, z) {
  return { x: wideX(x), y: wideY(MID_PITCH - z) };
}

function rawUnprojectWide(sx, sy) {
  const dx = sx - WIDE_CX;
  const a = Math.abs(dx);
  const x =
    Math.sign(dx) *
    (a <= 1.5 * WIDE_PITCH_PX
      ? a / WIDE_PITCH_PX
      : 1.5 + ((a - 1.5 * WIDE_PITCH_PX) / (WIDE_HALF_W - 1.5 * WIDE_PITCH_PX)) * (BOUNDARY - 1.5));
  const dy = sy - WIDE_CY;
  let d;
  if (Math.abs(dy) <= WIDE_HALF_PITCH) d = (dy / WIDE_HALF_PITCH) * MID_PITCH;
  else if (dy > 0) d = MID_PITCH + ((dy - WIDE_HALF_PITCH) / (WIDE_NEAR_Y - WIDE_CY - WIDE_HALF_PITCH)) * (BOUNDARY - MID_PITCH);
  else d = -(MID_PITCH + ((-dy - WIDE_HALF_PITCH) / (WIDE_CY - WIDE_HALF_PITCH - WIDE_FAR_Y)) * (BOUNDARY - MID_PITCH));
  return { x, z: MID_PITCH - d };
}

// The boundary rope as painted in the wide background: an ellipse, slightly
// deeper on the near side. The linear mapping above puts the 66 m boundary on
// a rounded rectangle instead, so it is bent to fit this.
export const ROPE = { cx: 318.5, cy: 215, rx: 297.5, ryFar: 108, ryNear: 113 };

/** t > 0 where the ray from the ground centre along (vx, vy) meets the painted rope. */
function ropeHit(vx, vy) {
  const ox = WIDE_CX - ROPE.cx;
  const oy = WIDE_CY - ROPE.cy;
  for (const [ry, near] of [
    [ROPE.ryFar, false],
    [ROPE.ryNear, true],
  ]) {
    const a = (vx / ROPE.rx) ** 2 + (vy / ry) ** 2;
    const b = 2 * ((ox * vx) / ROPE.rx ** 2 + (oy * vy) / ry ** 2);
    const c = (ox / ROPE.rx) ** 2 + (oy / ry) ** 2 - 1;
    const t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    if (WIDE_CY + t * vy >= ROPE.cy === near) return t;
  }
  return 1;
}

/**
 * How much to stretch a ground point's offset from the centre so the boundary
 * lands on the painted rope. 1 at the middle, easing to the full correction
 * at the boundary and beyond.
 */
function ropeCorrection(x, z) {
  const dz = z - MID_PITCH;
  const dist = Math.hypot(x, dz);
  if (dist < 1e-6) return 1;
  const edge = rawWide((x / dist) * BOUNDARY, MID_PITCH + (dz / dist) * BOUNDARY);
  const k = ropeHit(edge.x - WIDE_CX, edge.y - WIDE_CY);
  return 1 + (k - 1) * Math.min(1, (dist / BOUNDARY) ** 2);
}

/** World point to screen: { x, y, s } where s scales sprites (smaller further away). */
export function projectWide(x, y, z) {
  const raw = rawWide(x, z);
  const k = ropeCorrection(x, z);
  const sx = WIDE_CX + (raw.x - WIDE_CX) * k;
  const sy = WIDE_CY + (raw.y - WIDE_CY) * k;
  const s = 0.7 + 0.3 * ((sy - WIDE_FAR_Y) / (WIDE_NEAR_Y - WIDE_FAR_Y));
  return { x: sx, y: sy - y * 2.4 * s, s };
}

/** Screen point to ground position (inverse of projectWide at y = 0). */
export function unprojectWide(sx, sy) {
  // Undo the rope correction by fixed-point iteration; it changes slowly, so this converges fast.
  let k = 1;
  let g = rawUnprojectWide(sx, sy);
  for (let i = 0; i < 8; i++) {
    g = rawUnprojectWide(WIDE_CX + (sx - WIDE_CX) / k, WIDE_CY + (sy - WIDE_CY) / k);
    k = ropeCorrection(g.x, g.z);
  }
  return g;
}
