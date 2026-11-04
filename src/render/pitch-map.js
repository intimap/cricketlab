import { COLORS, fillRect, drawPanel } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

/**
 * A pitch map: where balls pitched (sim/innings.js notes each), seen as the close camera sees the pitch,
 * the batter's stumps at the bottom, with the length bands marked. Each ball a dot by what came of it.
 */

const MAX_Z = 12;
const HALF_WIDTH = 1.25;
const BANDS = [
  [0, 2.6, "#3c2a4e"],
  [2.6, 4.5, "#2f4a2c"],
  [4.5, 7.5, "#4a4426"],
  [7.5, 12, "#4a2c2a"],
];

/** The dot's colour: a wicket red, a boundary gold, beaten blue, runs cream, a dot ball green, an extra grey. */
export function pitchDotColour(dot) {
  if (dot.wicket) return COLORS.red;
  if (dot.extra) return COLORS.grey;
  if (dot.runs >= 4) return COLORS.gold;
  if (dot.beaten) return "#6cb6ff";
  return dot.runs > 0 ? COLORS.cream : "#7cd67c";
}

/** The map in a box at (x, y), w by h, with a title; `facing` turns a left-hander's map round. */
export function drawPitchMap(x, y, w, h, dots, { title = "PITCH MAP", facing = 1 } = {}) {
  drawPanel(x, y, w, h, "rgba(13,35,24,0.92)", COLORS.gold2);
  drawText(title, x + w / 2, y + 4, { align: "center", color: COLORS.dim });
  const top = y + 14;
  const bottom = y + h - 6;
  const left = x + 6;
  const right = x + w - 6;
  const zy = (z) => bottom - (Math.min(MAX_Z, Math.max(0, z)) / MAX_Z) * (bottom - top);
  for (const [z0, z1, colour] of BANDS) fillRect(left, zy(z1), right - left, zy(z0) - zy(z1), colour);
  // The stumps at the bottom, and the popping crease.
  const cx = (left + right) / 2;
  fillRect(cx - 2, bottom - 1, 5, 2, COLORS.cream);
  fillRect(left, zy(1.22), right - left, 1, "rgba(244,236,208,0.5)");
  for (const d of dots) {
    const px = cx + ((d.x * facing) / HALF_WIDTH) * ((right - left) / 2);
    if (px < left || px > right) continue;
    const py = zy(d.z);
    fillRect(px - 1, py - 1, 3, 3, "#0a0a0a");
    fillRect(px - 1, py - 1, 2, 2, pitchDotColour(d));
  }
}
