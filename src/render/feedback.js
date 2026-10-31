import { ctx, fillRect, drawBar, COLORS } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

/**
 * Arcade feedback, drawn: the batting timing meter and its callout, floating words over the striker
 * and the HUD, and bars that ease to new values with a white flash as they rise. Pure drawing; what
 * to show and when is decided in scenes/match-feedback.js.
 */

const PERFECT_GOLD = "#ffe066";
const EARLY_CYAN = "#5fe0ff";
const LATE_CRIMSON = "#e0283c";
/** The timing meter spans this many windows either side of perfect (beyond 2.4 is a clean miss). */
const SPAN = 2.4;
/** Inside this (windows) is PERFECT; inside 1 is timed. Matches scenes/match-feedback.js. */
export const PERFECT_TIMING = 0.3;

/** The callout word and colour for a timing error in windows (negative early). */
export function timingCallout(timing) {
  if (Math.abs(timing) <= PERFECT_TIMING) return { text: "PERFECT", color: PERFECT_GOLD };
  return timing < 0 ? { text: "EARLY", color: EARLY_CYAN } : { text: "LATE", color: LATE_CRIMSON };
}

/**
 * A small horizontal timing meter centred on x: the timed window, the perfect band in its middle,
 * and a mark where the swing was, with the callout above. `fade` (0..1) fades it out.
 */
export function drawTimingMeter(x, y, timing, fade) {
  const w = 120;
  const left = Math.round(x - w / 2);
  const toX = (v) => Math.round(left + ((Math.max(-SPAN, Math.min(SPAN, v)) + SPAN) / (2 * SPAN)) * w);
  ctx.save();
  ctx.globalAlpha = fade;
  fillRect(left - 1, y - 1, w + 2, 7, COLORS.black);
  fillRect(left, y, w, 5, "#203a2a");
  fillRect(toX(-1), y, toX(1) - toX(-1), 5, "#3d6e4a");
  fillRect(toX(-PERFECT_TIMING), y, toX(PERFECT_TIMING) - toX(-PERFECT_TIMING), 5, PERFECT_GOLD);
  fillRect(toX(-PERFECT_TIMING) - 1, y - 1, 1, 7, COLORS.black);
  fillRect(toX(PERFECT_TIMING), y - 1, 1, 7, COLORS.black);
  const mark = toX(timing);
  fillRect(mark - 1, y - 3, 3, 11, COLORS.white);
  const call = timingCallout(timing);
  drawText(call.text, x, y - 12, { align: "center", color: call.color, outline: "rgba(0,0,0,0.8)" });
  ctx.restore();
}

/** A floating word: rises `rise` px and fades over its life (age 0..1). */
export function drawFloat(text, x, y, color, age, rise = 18) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - age * age);
  drawText(text, x, Math.round(y - rise * age), { align: "center", color, outline: "rgba(0,0,0,0.8)" });
  ctx.restore();
}

/**
 * A bar easing towards its value: drawn at `shown`, with a white flash over the part it is still
 * rising into (up to `target`).
 */
export function drawEasedBar(x, y, w, h, shown, target, color, background) {
  if (target > shown) {
    drawBar(x, y, w, h, target, COLORS.white, background);
    fillRect(x, y, Math.max(0, Math.min(1, shown)) * w, h, color);
  } else drawBar(x, y, w, h, shown, color, background);
}
