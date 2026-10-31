import { COLORS, drawPanel } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { eyeMultiplier } from "../sim/eye.js";
import { drawEasedBar } from "./feedback.js";

export const BATTER_PANEL = { x: 4, y: 4, w: 108, h: 48 };
/** Default pressure-bar position, also re-exported by hud.js for existing callers. */
export const PRESSURE_BAR = { x: 10, y: 41, w: 96 };

export function meterAnchors(top = BATTER_PANEL.y) {
  const center = BATTER_PANEL.x + BATTER_PANEL.w / 2;
  return { eye: { x: center, y: top + 22 }, pressure: { x: center, y: top + 46 } };
}

/** The striker's eye and bowling pressure share a compact, two-row panel. */
export function drawBatterMeters({ eye, pressure, eyeShown = eye, pressureShown = pressure, now = 0, top = BATTER_PANEL.y }) {
  const { x, w, h } = BATTER_PANEL;
  const full = eye >= 1;
  drawPanel(x, top, w, h, "rgba(10,28,18,0.88)", full ? COLORS.gold : COLORS.gold2);
  drawText("EYE", x + 6, top + 5, { color: COLORS.gold });
  drawText(`x${eyeMultiplier(eye).toFixed(2)}`, x + w - 6, top + 5, {
    color: eye > 0 ? COLORS.gold : COLORS.dim, align: "right",
  });
  const glow = full && Math.floor(now * 4) % 2 === 0;
  drawEasedBar(x + 6, top + 15, w - 12, 5, eyeShown, eye,
    glow ? COLORS.white : eyeShown > 0.6 ? COLORS.gold : "#7ec8ff");
  const pressureColor = pressure > 0.6 ? COLORS.red : pressure > 0.35 ? COLORS.gold : "#7ec8ff";
  drawText("PRESSURE", x + 6, top + 27, { color: COLORS.dim });
  drawText(`${Math.round(pressure * 100)}%`, x + w - 6, top + 27, { color: pressureColor, align: "right" });
  drawEasedBar(PRESSURE_BAR.x, top + 37, PRESSURE_BAR.w, 5, pressureShown, pressure, pressureColor);
}
