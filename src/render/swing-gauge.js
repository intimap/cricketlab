import { COLORS, fillRect } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

/**
 * The swing gauge, for batting with the bat on a stick (scenes/bat-stick.js), like a golf game's: an arc
 * from forward (top) round to back (bottom), with the backswing's zones marked (part way: attack; to the
 * stop: loft), a needle where the stick is now, and the shot it will be underneath.
 *
 * `g`: { y (the stick, -1 forward .. 1 back), depth (the backswing so far, 0..1), back, full (the zones'
 * starts), label, colour }.
 */

const R = 20;
/** The arc runs from straight up (forward) round the right-hand side to straight down (back). */
const angleOf = (y) => (y * Math.PI) / 2;
const at = (x, y, a, r) => ({ x: Math.round(x + Math.cos(a) * r), y: Math.round(y + Math.sin(a) * r) });

function arc(x, y, from, to, colour) {
  for (let v = from; v <= to; v += 0.02) {
    const p = at(x, y, angleOf(v), R);
    fillRect(p.x - 1, p.y - 1, 2, 2, colour);
  }
}

export function drawSwingGauge(x, y, g) {
  fillRect(x - 3, y - R - 3, R + 7, 2 * R + 6, "rgba(10, 30, 18, 0.55)");
  arc(x, y, -1, g.back, "#2c6b45");
  arc(x, y, g.back, g.full, "#7cd67c");
  arc(x, y, g.full, 1, COLORS.gold);
  // How far back he went this time.
  if (g.depth > 0) {
    const p = at(x, y, angleOf(g.depth), R + 3);
    fillRect(p.x - 1, p.y - 1, 3, 3, COLORS.cream);
  }
  // The needle: where the stick is now.
  const tip = angleOf(Math.max(-1, Math.min(1, g.y)));
  for (let r = 0; r <= R - 2; r += 1) {
    const p = at(x, y, tip, r);
    fillRect(p.x, p.y, 1, 1, COLORS.cream);
  }
  fillRect(x - 1, y - 1, 3, 3, COLORS.cream);
  if (g.label) drawText(g.label, x + R / 2, y + R + 6, { align: "center", color: g.colour ?? COLORS.cream });
}
