import { COLORS, fillCircle, fillRect } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";

const DIAMETER = 15;
const STEP = 17;
const MAX_VISIBLE = 8;

/** Keep extras as separate deliveries; empty spheres represent balls still to come. */
export function overBallLayout(symbols) {
  const played = symbols.map(symbol => String(symbol).toUpperCase());
  const legal = played.filter(symbol => symbol !== "WD" && symbol !== "NB").length;
  const entries = played.slice(-MAX_VISIBLE).map(symbol => symbol === "0" ? "." : symbol);
  const remaining = Math.min(Math.max(0, 6 - legal), MAX_VISIBLE - entries.length);
  for (let i = 0; i < remaining; i++) entries.push("");
  const hidden = Math.max(0, played.length - MAX_VISIBLE);
  const prefix = hidden ? `+${hidden}` : "";
  const width = (prefix ? textWidth(prefix) + 5 : 0) +
    Math.max(0, entries.length * STEP - (STEP - DIAMETER));
  return { entries, prefix, width };
}

/** Shaded pixel spheres keep two-letter extras legible without emoji or image assets. */
export function drawOverBalls(layout, right, y) {
  let x = right - layout.width;
  if (layout.prefix) x += drawText(layout.prefix, x, y, { color: COLORS.dim }) + 5;
  for (const label of layout.entries) {
    const wicket = label === "W";
    const boundary = label === "4" || label === "6";
    const extra = label === "WD" || label === "NB";
    const center = x + 7;
    const cy = y + 3;
    const rim = wicket ? COLORS.red : boundary || extra ? COLORS.gold : COLORS.gold2;
    const body = wicket ? COLORS.red : boundary ? COLORS.gold : "#203a2a";
    fillCircle(center, cy, 7, label ? rim : "#34543f");
    fillCircle(center, cy, 6, label ? body : COLORS.green);
    if (label) {
      fillRect(center - 4, cy - 4, 2, 1, boundary ? COLORS.cream : COLORS.dim);
      if (label === ".") fillCircle(center, cy, 1.5, COLORS.cream);
      else drawText(label, center, y, { align: "center", color: boundary ? COLORS.green : COLORS.cream, shadow: null });
    }
    x += STEP;
  }
}
