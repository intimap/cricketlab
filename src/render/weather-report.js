import { WIDTH, COLORS, drawPanel } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { drawWeatherIcon, ICON } from "./weather-icon.js";

const PANEL = { x: 150, y: 34, w: 340, h: 196 };

/**
 * The weather report before play (and each morning of a Test), clear of the commentators' box in the bottom
 * left. report: { title, ground, id, name, sky, temp, effects: [..], rain (or ""), status (or "") }.
 */
export function drawWeatherReport(report, now) {
  const { x, y, w, h } = PANEL;
  const mid = x + w / 2;
  drawPanel(x, y, w, h, "rgba(10,28,18,0.94)", COLORS.gold2);
  drawText(report.title, mid, y + 8, { align: "center", color: COLORS.gold, scale: 2 });
  drawText(report.ground, mid, y + 26, { align: "center", color: COLORS.dim });
  // The icon large on the left, the weather beside it.
  drawWeatherIcon(report.id, x + 22, y + 44, 3);
  const tx = x + 22 + ICON.w * 3 + 16;
  drawText(report.name, tx, y + 46, { color: COLORS.white, scale: 2 });
  drawText(`${report.sky}, ${report.temp}C`, tx, y + 64, { color: COLORS.cream });
  let row = y + 92;
  drawText("CONDITIONS", x + 22, row, { color: COLORS.gold });
  for (const line of report.effects) {
    row += 11;
    drawText(`- ${line}`, x + 22, row, { color: COLORS.cream });
  }
  if (report.rain) {
    row += 15;
    drawText(report.rain, x + 22, row, { color: "#6cb6ff" });
  }
  if (report.status) drawText(report.status, mid, y + h - 30, { align: "center", color: COLORS.white });
  if (Math.floor(now * 2) % 2 === 0) drawText("SPACE TO PLAY", mid, y + h - 14, { align: "center", color: COLORS.gold });
}

/** Rain has stopped play: what it has cost (scenes/match-rain.js), at the top, clear of the commentators. */
export function drawRainReport(report, now) {
  const w = 316;
  const h = 34 + report.lines.length * 12 + 16;
  const x = (WIDTH - w) / 2;
  const y = 30;
  drawPanel(x, y, w, h, "rgba(10,20,28,0.92)", "#6cb6ff");
  drawWeatherIcon("rain", x + 10, y + 8, 1);
  drawText("RAIN STOPS PLAY", WIDTH / 2, y + 8, { align: "center", color: COLORS.white, scale: 2 });
  report.lines.forEach((line, i) => drawText(line, WIDTH / 2, y + 30 + i * 12, { align: "center", color: COLORS.cream }));
  if (Math.floor(now * 2) % 2 === 0) drawText(report.prompt, WIDTH / 2, y + h - 12, { align: "center", color: COLORS.gold });
}

export { PANEL as WEATHER_REPORT_PANEL };
