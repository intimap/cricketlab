import { COLORS, fillRect, plot } from "../engine/screen.js";
import { BAT_FACE, PAD, groundShadow } from "./kit.js";

/** The wide view's tiny figures, and which pose a fielder's state shows. */

/**
 * A tiny figure for the wide view, feet at (x, y).
 * pose: idle | run | dive | down | diveAlong | celebrate | throw | keeper | batter. opts: { bat?, shirt?, pants?, dir? }
 * `diveAlong` is a batter diving for his crease, stretched out along opts.dir (a unit vector on screen).
 */
export function drawTinyFigure(x, y, scale, pose, cap, phase = 0, opts = {}) {
  const k = Math.max(1, scale * 1.45);
  // Whites unless a coloured kit is given (opts.shirt, opts.pants).
  const shirt = opts.shirt ?? COLORS.cream;
  const pants = opts.pants ?? "#e8e2cc";
  const rect = (rx, ry, w, h, color) =>
    fillRect(x + rx * k, y + ry * k, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), color);
  groundShadow(x, y, 3 * k, 1, 0.35);
  if (pose === "diveAlong") {
    // Legs trailing, the body flat, the cap and then the bat reaching out ahead.
    const { x: dx, y: dy } = opts.dir;
    const along = (from, to, size, color) => {
      const px = Math.max(1, Math.round(size * k));
      for (let t = from; t <= to; t += 0.5)
        fillRect(Math.round(x + dx * t * k - px / 2), Math.round(y - 1.5 * k + dy * t * k - px / 2), px, px, color);
    };
    along(-5, -2, 1.5, pants);
    along(-2, 2, 2, shirt);
    along(2.5, 3.5, 2, cap);
    if (opts.bat) along(4.5, 7, 1, BAT_FACE);
    return;
  }
  if (pose === "dive" || pose === "down") {
    rect(-4, -3, 8, 2, shirt);
    rect(-5, -4, 2, 2, cap);
    rect(3, -3, 2, 1, pants);
    return;
  }
  const stride = pose === "run" ? (Math.sin(phase * Math.PI * 2) > 0 ? 1 : -1) : 0;
  rect(-1 - (stride > 0 ? 1 : 0), -3, 1, 3, pants);
  rect(1 + (stride < 0 ? 1 : 0), -3, 1, 3, pants);
  if (opts.bat) {
    rect(-1, -3, 1, 2, PAD);
    rect(1, -3, 1, 2, PAD);
  }
  rect(-1, -6, 3, 3, shirt);
  rect(-1, -8, 3, 2, cap);
  if (pose === "celebrate") {
    rect(-2, -9, 1, 2, shirt);
    rect(2, -9, 1, 2, shirt);
  } else if (pose === "throw") {
    rect(2, -9, 1, 3, shirt);
  } else if (pose === "keeper") {
    rect(-2, -5, 1, 1, "#f0b030");
    rect(2, -5, 1, 1, "#f0b030");
  }
  if (opts.bat) {
    plot(x + 2 * k, y - 4 * k, BAT_FACE);
    plot(x + 2 * k, y - 3 * k, BAT_FACE);
    plot(x + 3 * k, y - 2 * k, BAT_FACE);
  }
}

/**
 * The small figure's pose for a fielder's state (sim/fielder-motion.js): crouched
 * ready or set, on the ground after a dive and getting up, the crow-hop run into a throw.
 */
export function fielderPose(f, t, phase) {
  const since = t - f.stateAt;
  if (f.state === "dive") return "dive";
  if (f.state === "down" || (f.state === "getUp" && since < 0.2)) return "down";
  if (f.state === "celebrate") return "celebrate";
  if (f.state === "crowHop") return "run";
  if (f.state === "throw" && since < 0.4) return "throw";
  if (f.curSpeed > 0.5 || (f.state === "idle" && phase === "return")) return "run";
  if (f.role === "keeper" || f.state === "ready" || f.state === "set") return "keeper";
  return "idle";
}
