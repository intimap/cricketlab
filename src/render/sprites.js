import { fillCircle, plot } from "../engine/screen.js";
import { groundShadow } from "./kit.js";

// Players are drawn in kit.js, batter-rig.js and figures.js; re-exported so older imports keep working.
export * from "./kit.js";
export { BATTER_POSES, lerpPose, reachPose, solveBatterRig, drawBatter } from "./batter-rig.js";
export * from "./figures.js";

/** The ball; redder (shinier) when `shine` is high. */
export function drawBall(x, y, radius, shine) {
  const color = shine > 0.5 ? "#c4161c" : shine > 0.2 ? "#a3201e" : "#7e2a22";
  fillCircle(x, y, radius, "#3b0a0a");
  fillCircle(x, y, Math.max(0.5, radius - 0.6), color);
  if (radius >= 2) plot(x - radius * 0.35, y - radius * 0.35, "#ffb3a8");
}

export function drawShadow(x, y, radius) {
  groundShadow(x, y, Math.max(1, radius * 1.1), Math.max(0.5, radius * 0.45), 0.38);
}
