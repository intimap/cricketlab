import { fillCircle, plot } from "../engine/screen.js";
import { groundShadow } from "./kit.js";

// Players are drawn in kit.js, batter-rig.js and figures.js; re-exported so older imports keep working.
export * from "./kit.js";
export { BATTER_POSES, lerpPose, reachPose, solveBatterRig, drawBatter } from "./batter/batter-rig.js";
export * from "./figures.js";

/** Ball colours: its rim, and its face as it loses its shine (new, worn, old), and the glint. */
const BALLS = {
  red: { rim: "#3b0a0a", faces: ["#c4161c", "#a3201e", "#7e2a22"], glint: "#ffb3a8" },
  // Under lights it's the pink ball, easier to pick up at night.
  pink: { rim: "#4a1030", faces: ["#ff5fa8", "#e2559a", "#b94a82"], glint: "#ffe0ef" },
};

/** The ball (`kind`: "red" or "pink"); brighter (shinier) when `shine` is high. */
export function drawBall(x, y, radius, shine, kind = "red") {
  const ball = BALLS[kind] ?? BALLS.red;
  const face = ball.faces[shine > 0.5 ? 0 : shine > 0.2 ? 1 : 2];
  fillCircle(x, y, radius, ball.rim);
  fillCircle(x, y, Math.max(0.5, radius - 0.6), face);
  if (radius >= 2) plot(x - radius * 0.35, y - radius * 0.35, ball.glint);
}

export function drawShadow(x, y, radius) {
  groundShadow(x, y, Math.max(1, radius * 1.1), Math.max(0.5, radius * 0.45), 0.38);
}
