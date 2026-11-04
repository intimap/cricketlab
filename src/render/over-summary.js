import { WIDTH, COLORS, drawPanel } from "../engine/screen.js";
import { drawText, wrapText } from "../engine/text.js";
import { drawPitchMap, pitchDotColour } from "./pitch-map.js";

/**
 * The end-of-over summary while the player bowls: the over ball by ball, where each pitched, and one line on
 * how it went (sim/over-review.js). Clear of the commentators' box in the bottom left.
 * summary: { title, dots, line, facing }.
 */
export function drawOverSummary(summary, now) {
  const w = 300;
  const h = 122;
  const x = (WIDTH - w) / 2 + 40;
  const y = 40;
  drawPanel(x, y, w, h, "rgba(10,28,18,0.94)", COLORS.gold2);
  drawText(summary.title, x + 12, y + 8, { color: COLORS.gold });
  // The balls in order, coloured as on the map.
  summary.dots.forEach((d, i) => {
    const label = d.wicket ? "W" : d.extra ? "X" : String(d.runs);
    drawText(label, x + 14 + i * 14, y + 22, { color: pitchDotColour(d) });
  });
  wrapText(summary.line, 30).forEach((line, i) => drawText(line, x + 12, y + 40 + i * 11, { color: COLORS.cream }));
  drawPitchMap(x + w - 92, y + 6, 84, h - 12, summary.dots, { title: "THE OVER", facing: summary.facing });
  if (Math.floor(now * 2) % 2 === 0) drawText("SPACE = NEXT OVER", x + 12, y + h - 14, { color: COLORS.dim });
}
