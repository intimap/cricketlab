import { COLORS, drawPanel, fillRect } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { clamp } from "../math.js";

/**
 * The top-left meter: PRESSURE, BAT vs BALL. One bar with a marker that starts in the middle; the striker's
 * eye (sim/eye.js) pulls it towards BAT, the innings' pressure (sim/innings.js) towards BALL. Presentation
 * only: the eye and the pressure work as they always have. The weakness a batter has given away (when
 * bowling at him) sits in a strip under it.
 */

export const BATTER_PANEL = { x: 4, y: 4, w: 108, h: 37 };
/** The bar itself, inside the panel (its top is relative to the panel's). */
export const PRESSURE_BAR = { x: 10, y: 15, w: 96, h: 7 };
/** How much more pressure pulls than the eye: pressure rarely passes 0.6, an eye in fills to 1. */
export const PRESSURE_WEIGHT = 1.5;
/** How near an end (of the -1..1 balance) counts as there, for the glow. */
const AT_END = 0.95;
const BAT_COLOUR = COLORS.gold;
const BALL_COLOUR = COLORS.red;

/** Who's on top, -1 (the ball, all the way) to 1 (the bat): the eye less the weighted pressure. */
export const batVsBall = (eye, pressure) => clamp(eye - PRESSURE_WEIGHT * (pressure ?? 0), -1, 1);

/** Where the floating words come off the meter (scenes/match-panels.js): its bar, whichever they're about. */
export function meterAnchors(top = BATTER_PANEL.y) {
  const at = { x: BATTER_PANEL.x + BATTER_PANEL.w / 2, y: top + PRESSURE_BAR.y + 12 };
  return { eye: at, pressure: at };
}

/**
 * Draw the meter. `eye` and `pressure` (null in the nets: none) are where they are; `eyeShown` and
 * `pressureShown` where the bar has got to as it eases after them (scenes/match-feedback.js).
 */
export function drawBatterMeters({
  eye,
  pressure,
  eyeShown = eye,
  pressureShown = pressure,
  now = 0,
  top = BATTER_PANEL.y,
  tag = "",
}) {
  const { x, w, h } = BATTER_PANEL;
  const balance = batVsBall(eyeShown, pressureShown);
  const atBat = batVsBall(eye, pressure) >= AT_END;
  const atBall = batVsBall(eye, pressure) <= -AT_END;
  const pulse = Math.floor(now * 4) % 2 === 0;
  drawPanel(x, top, w, h, "rgba(10,28,18,0.88)", atBat ? BAT_COLOUR : atBall ? BALL_COLOUR : COLORS.gold2);
  drawText("PRESSURE", x + w / 2, top + 5, { align: "center", color: COLORS.gold });

  // The bar: dark, a notch at the middle, filled from the middle out to the marker in the side's colour.
  const bx = x + PRESSURE_BAR.x - BATTER_PANEL.x;
  const by = top + PRESSURE_BAR.y;
  const bw = PRESSURE_BAR.w;
  const mid = bx + bw / 2;
  fillRect(bx - 1, by - 1, bw + 2, PRESSURE_BAR.h + 2, COLORS.black);
  fillRect(bx, by, bw, PRESSURE_BAR.h, "#203a2a");
  // The bat's end is on the left: a positive balance moves the marker left.
  const marker = Math.round(mid - (balance * bw) / 2);
  const glow = (atBat || atBall) && pulse;
  const fill = balance >= 0 ? BAT_COLOUR : BALL_COLOUR;
  if (marker < mid) fillRect(marker, by, mid - marker, PRESSURE_BAR.h, glow ? COLORS.white : fill);
  else if (marker > mid) fillRect(mid, by, marker - mid, PRESSURE_BAR.h, glow ? COLORS.white : fill);
  fillRect(mid, by - 1, 1, PRESSURE_BAR.h + 2, COLORS.dim);
  fillRect(marker - 1, by - 2, 3, PRESSURE_BAR.h + 4, COLORS.white);
  drawText("BAT", bx, by + PRESSURE_BAR.h + 3, { color: balance > 0.05 ? BAT_COLOUR : COLORS.dim });
  drawText("BALL", bx + bw, by + PRESSURE_BAR.h + 3, { align: "right", color: balance < -0.05 ? BALL_COLOUR : COLORS.dim });
  if (tag) {
    drawPanel(x, top + h + 2, w, 13, "rgba(60,18,10,0.9)", COLORS.red);
    drawText(tag, x + w / 2, top + h + 5, { align: "center", color: COLORS.gold });
  }
}
