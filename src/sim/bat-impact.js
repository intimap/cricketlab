import { clamp } from "../math.js";
import { BALL_RADIUS } from "./geometry.js";

/** Metres along the blade, measured from the toe towards the handle. */
export const BAT_BLADE = Object.freeze({ length: 0.56, sweet: 0.20, halfWidth: 0.054, handle: 0.72 });

/**
 * A contact-plane approximation, independent of the animated bat rig. The blade
 * points down for drives and defence, and across the body for cuts/pulls/sweeps.
 * Its length axis points from toe to handle; width is perpendicular to it.
 */
export function bladeAngle(type, back) {
  if (type === "sweep" || (type === "cutpull" && back === "pull")) return Math.PI / 2;
  if (type === "reverseSweep" || (type === "cutpull" && back === "cut")) return -Math.PI / 2;
  if (type === "ramp") return Math.PI / 4;
  return 0;
}

/** Resolve the ball centre against the blade, including the ball's radius. */
export function batImpact({ dx, dy, timing, type, back, sweetWidth }) {
  const angle = bladeAngle(type, back);
  const across = dx * Math.cos(angle) - dy * Math.sin(angle);
  // Timing moves contact a little along the blade instead of adding fresh dice.
  const along = BAT_BLADE.sweet + dx * Math.sin(angle) + dy * Math.cos(angle) - 0.035 * timing;
  const width = Math.abs(across);
  const outer = BAT_BLADE.halfWidth + BALL_RADIUS;
  const faceWidth = Math.min(sweetWidth, BAT_BLADE.halfWidth);
  const missed = width > outer || along < -BALL_RADIUS || along > BAT_BLADE.handle + BALL_RADIUS;
  const region = along > BAT_BLADE.length ? "handle" : along < 0.10 ? "toe" : along > 0.40 ? "splice" : "middle";
  // Effective rebound falls smoothly away from the sweet spot, with a softer splice.
  const offset = along - BAT_BLADE.sweet;
  const span = offset < 0 ? BAT_BLADE.sweet : BAT_BLADE.length - BAT_BLADE.sweet;
  const offCentre = clamp(Math.abs(offset) / span);
  const energy = 1 - (offset < 0 ? 0.32 : 0.42) * offCentre * offCentre;
  const edge = width > faceWidth;
  // This is bat/ball overlap, not an extra chance roll at the thin/thick boundary.
  const thickness = clamp((outer - width) / (outer - faceWidth));
  const faceQuality = 1 - 0.35 * clamp(width / faceWidth);
  return { across, along, region, missed, edge, thickness, energy, faceQuality, horizontal: Math.abs(Math.sin(angle)) > 0.9 };
}

/** Continuous edge response; thin inside edges go finer than thick ones too. */
export function edgeExit(impact, ballSpeed, batSpeed, defending, side) {
  const t = impact.thickness;
  const thinSpeed = side > 0 ? 0.62 * ballSpeed * (defending ? 0.55 : 1) : 0.32 * ballSpeed;
  const thickSpeed = side > 0 ? 0.42 * ballSpeed + 0.35 * batSpeed : 0.38 * ballSpeed + 0.25 * batSpeed;
  return {
    speed: thinSpeed + (thickSpeed - thinSpeed) * t,
    bearing: side > 0 ? 166 - 44 * t : -174 + 42 * t,
    spread: 8 + 14 * t,
    elevation: side > 0 ? 6 + t - (defending ? 4 + 2 * t : 0) : 2,
  };
}
