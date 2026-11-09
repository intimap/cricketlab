import { ctx } from "../engine/screen.js";
import { RING_COLOURS } from "./ball-ring.js";

/**
 * The length zone on the pitch (the batting cue: scenes/match-ball.js): the band a ball's about to pitch in,
 * flashed across the pitch in the ring's colour for that length (render/ball-ring.js). Bands run in metres
 * from the striker's stumps, as sim/delivery.js lengthName names them; a spinner's good length ends sooner.
 */
const BANDS = {
  purple: [1.22, 2.6],
  green: [2.6, 4.5],
  gold: [4.5, 7.5],
  red: [7.5, 11.5],
};
const SPIN_GOOD_TO = 6.5;
/** Half the width it's painted across (m): the pitch between the return creases. */
const HALF_WIDTH = 1.3;

/** The band (m from the striker's stumps) for a ring colour. */
export function zoneBand(colour, spinner) {
  const [from, to] = BANDS[colour] ?? BANDS.gold;
  if (!spinner) return [from, to];
  if (colour === "gold") return [from, SPIN_GOOD_TO];
  if (colour === "red") return [SPIN_GOOD_TO, to];
  return [from, to];
}

/** Paint the zone with `project` (x, y, z → screen), at `alpha`. */
export function drawLengthZone(project, colour, spinner, alpha) {
  const [from, to] = zoneBand(colour, spinner);
  const corners = [
    project(-HALF_WIDTH, 0, from),
    project(HALF_WIDTH, 0, from),
    project(HALF_WIDTH, 0, to),
    project(-HALF_WIDTH, 0, to),
  ];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = RING_COLOURS[colour] ?? RING_COLOURS.gold;
  ctx.beginPath();
  corners.forEach((p, i) => (i ? ctx.lineTo(Math.round(p.x), Math.round(p.y)) : ctx.moveTo(Math.round(p.x), Math.round(p.y))));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = Math.min(1, alpha * 1.6);
  ctx.strokeStyle = RING_COLOURS[colour] ?? RING_COLOURS.gold;
  ctx.stroke();
  ctx.restore();
}
