import { ctx, fillCircle, strokeEllipse } from "../engine/screen.js";

/**
 * Broadcast touches on the delivery in the close view: a short fading trail behind the ball, and a
 * pitch-map reticle where it will land, closing in as it gets there and flashing as it bounces.
 * Pure drawing: the scene works out the positions (scenes/match-view.js).
 */

/** Trail colours: white behind a quick, a warm yellow-red behind a spinner. */
const TRAIL_PACE = [255, 255, 255];
const TRAIL_SPIN = [255, 196, 120];
/** The newest trail dot's opacity; older ones fade towards nothing. */
const TRAIL_ALPHA = 0.45;

/** The reticle's colour, and its flash on the bounce. */
const RETICLE = "rgba(255,236,170,0.55)";
const FLASH = "rgba(255,255,255,0.95)";
/** Its radius (screen px at scale 1) on release and as the ball lands; flattened by the camera's angle. */
const RETICLE_FROM = 16;
const RETICLE_TO = 5;
const RETICLE_FLAT = 0.35;

/**
 * The trail: `points` are the ball's last few screen positions, newest first ({ x, y, r }), each
 * drawn smaller and fainter than the one before.
 */
export function drawBallTrail(points, spin) {
  const [r, g, b] = spin ? TRAIL_SPIN : TRAIL_PACE;
  ctx.save();
  points.forEach((p, i) => {
    const fade = 1 - (i + 1) / (points.length + 1);
    ctx.globalAlpha = TRAIL_ALPHA * fade;
    fillCircle(p.x, p.y, Math.max(0.6, p.r * (0.85 - 0.12 * i)), `rgb(${r},${g},${b})`);
  });
  ctx.restore();
}

/**
 * The landing reticle at screen point p (with its perspective scale p.s against the striker's end):
 * k runs 0..1 from release to the bounce, closing the ring in; flash (0..1) lights it white as it lands.
 */
export function drawPitchReticle(p, k, flash, scale) {
  const rx = (RETICLE_FROM + (RETICLE_TO - RETICLE_FROM) * k) * scale;
  const ry = Math.max(1, rx * RETICLE_FLAT);
  const colour = flash > 0 ? FLASH : RETICLE;
  ctx.save();
  if (flash > 0) ctx.globalAlpha = flash;
  strokeEllipse(p.x, p.y, rx, ry, colour);
  // Four ticks pointing in, and a dot on the spot.
  ctx.fillStyle = colour;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ctx.fillRect(Math.round(p.x + dx * (rx + 2)), Math.round(p.y + dy * (ry + 1)), dx ? 2 : 1, dy ? 1 : 1);
  }
  ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  ctx.restore();
}
