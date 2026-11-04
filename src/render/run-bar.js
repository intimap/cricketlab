import { COLORS, fillRect, drawPanel } from "../engine/screen.js";
import { CREASE, PITCH_LENGTH, RUN_LENGTH } from "../sim/geometry.js";
import { HUD_Y } from "./score-bar.js";

/**
 * The run bar: the pitch laid on its side just above the score bar while the ball's in play, the
 * striker's end on the left, with each batter where he is along it (scenes/run-bar.js says when). The
 * stumps and popping creases are marked; a batter out of his ground has a red edge, in it a green one,
 * and an arrow shows which way he's going. When a throw's coming in, that end's stumps flash.
 *
 * bar: { runners: [{ progress (0 at the striker's end's crease, 1 at the other), dir (-1, 0, 1), kit }],
 *        throwTo: 0, 1 or null }
 */

/** Between the commentary box (on the left) and the speed gun (on the right). */
export const RUN_BAR = Object.freeze({ x: 264, y: HUD_Y - 18, w: 256, h: 16 });

const PITCH = "#b59d64";
const CREASE_LINE = "#f4f4ee";
const STUMPS = "#e6cf96";
const IN = "#7be07b";
const OUT = "#ff5a3c";

export function drawRunBar(bar, now = 0) {
  const { x, y, w, h } = RUN_BAR;
  drawPanel(x, y, w, h, "rgba(10,28,18,0.88)", COLORS.gold2);
  const left = x + 12;
  const right = x + w - 12;
  const at = (z) => Math.round(left + ((z + 0.5) / (PITCH_LENGTH + 1)) * (right - left));
  const mid = y + Math.floor(h / 2);
  fillRect(at(-0.3), mid - 1, at(PITCH_LENGTH + 0.3) - at(-0.3), 3, PITCH);
  for (const z of [CREASE, PITCH_LENGTH - CREASE]) fillRect(at(z), mid - 5, 1, 11, CREASE_LINE);
  for (const [end, z] of [
    [0, 0],
    [1, PITCH_LENGTH],
  ]) {
    // The ball on its way to these stumps: they flash.
    const coming = bar.throwTo === end && Math.floor(now * 8) % 2 === 0;
    const colour = coming ? OUT : STUMPS;
    for (const dx of [-2, 0, 2]) fillRect(at(z) + dx, mid - 4, 1, 8, colour);
    if (bar.throwTo === end) fillRect(at(z) - 1, y + 1, 3, 2, OUT);
  }
  for (const r of bar.runners) {
    const px = at(CREASE + r.progress * RUN_LENGTH);
    const out = r.progress > 0.001 && r.progress < 0.999;
    // A thick edge (red out of his ground, green in it), then his side's shirt and cap.
    fillRect(px - 4, mid - 6, 9, 13, out ? OUT : IN);
    fillRect(px - 2, mid - 2, 5, 7, r.kit.shirt);
    fillRect(px - 2, mid - 4, 5, 2, r.kit.cap);
    if (r.dir) {
      const tip = px + r.dir * 6;
      fillRect(tip, mid - 1, 1, 3, COLORS.cream);
      fillRect(tip - r.dir, mid - 2, 1, 5, COLORS.cream);
    }
  }
}
