import { MID_PITCH, BOUNDARY, STUMPS_HALF_WIDTH } from "../sim/geometry.js";

// Two hand-tuned projections, each matched to its background painting.

// --- Close camera: behind the bowler's arm, looking at the striker. ---

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

function depthScale(z) {
  return 1 / Math.max(0.6, z + CAMERA_Z);
}

/** Screen y of the ground at depth z. */
export function closeGroundY(z) {
  return HORIZON_Y + DEPTH_GAIN * depthScale(z) + CLOSE_Y_OFFSET;
}

/** World point to screen: { x, y, s } where s is the depth scale. */
export function projectClose(x, y, z) {
  const s = depthScale(z);
  return { x: 320 + warpLateral(x) * LATERAL_GAIN * s, y: closeGroundY(z) - y * HEIGHT_GAIN * s, s };
}

/** Screen pixels per metre of height at depth z. */
export function closePixelsPerMetre(z) {
  return HEIGHT_GAIN * depthScale(z);
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

/** World point to screen: { x, y, s } where s scales sprites (smaller further away). */
export function projectWide(x, y, z) {
  const sy = wideY(MID_PITCH - z);
  const s = 0.7 + 0.3 * ((sy - WIDE_FAR_Y) / (WIDE_NEAR_Y - WIDE_FAR_Y));
  return { x: wideX(x), y: sy - y * 2.4 * s, s };
}

/** Screen point to ground position (inverse of projectWide at y = 0). */
export function unprojectWide(sx, sy) {
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
