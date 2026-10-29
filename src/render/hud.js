import { WIDTH, HEIGHT, COLORS, fillRect, fillCircle, fillEllipse, strokeEllipse, drawPanel, drawBar } from "../engine/screen.js";
import { drawText, textWidth, wrapText } from "../engine/text.js";
import { clamp } from "../math.js";
import { MID_PITCH, BOUNDARY, distFromCentre } from "../sim/geometry.js";

/** Top of the score bar along the bottom of the screen. */
export const HUD_Y = 324;

export const staminaColor = (s) => (s > 0.6 ? "#7cd67c" : s > 0.35 ? COLORS.gold : COLORS.red);

/** Bottom bar: score, batters, this over, bowler and the commentary line (the pitch and ball are on the scorecard). */
export function drawScoreBar(inn, commentary, deliveryLabel) {
  fillRect(0, HUD_Y, WIDTH, HEIGHT - HUD_Y, COLORS.gold2);
  fillRect(0, HUD_Y + 1, WIDTH, HEIGHT - HUD_Y - 1, COLORS.green);
  fillRect(0, HUD_Y + 1, WIDTH, 1, "#2c6b45");

  // The score, double size at the left edge, across the first two rows. The box fits the widest score,
  // so the text beside it doesn't shift as the total grows.
  const y1 = HUD_Y + 4;
  const scoreW = textWidth(`${inn.batTeam.abbr} 000/10`, 2) + 12;
  fillRect(2, HUD_Y + 2, scoreW, 20, inn.batTeam.colour);
  drawText(`${inn.batTeam.abbr} ${inn.runs}/${inn.wkts}`, 8, HUD_Y + 5, { color: COLORS.white, scale: 2 });
  const left = scoreW + 8;

  // Row 1: overs, batters, partnership, this over.
  drawText(`OV ${inn.oversText}`, left, y1, { color: COLORS.gold });
  const striker = inn.bat[inn.striker];
  const other = inn.bat[inn.nonStriker];
  let x = left + 56;
  drawText("•", x, y1, { color: COLORS.gold });
  x += 7;
  x += drawText(`${striker.p.short.toUpperCase()} ${striker.runs}(${striker.balls})`, x, y1, { color: COLORS.cream }) + 10;
  x += drawText(`${other.p.short.toUpperCase()} ${other.runs}(${other.balls})`, x, y1, { color: COLORS.dim }) + 10;
  if (inn.target !== null) {
    drawText(`NEED ${inn.runsNeeded} OFF ${inn.ballsLeft}`, x, y1, { color: COLORS.gold });
  } else {
    drawText(`P'SHIP ${inn.partnership.runs}(${inn.partnership.balls})`, x, y1, { color: COLORS.dim });
  }

  let right = 636;
  const balls = inn.overBalls.slice(-8);
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    const w = Math.max(9, textWidth(b) + 4);
    right -= w + 1;
    const color = b === "W" ? COLORS.red : b === "4" || b === "6" ? COLORS.gold2 : b === "." ? "#24563a" : "#2f6a48";
    fillRect(right, y1 - 2, w, 10, color);
    drawText(b, right + w / 2, y1 - 0.5, { align: "center", color: COLORS.white, shadow: null });
  }

  // Row 2: bowler, delivery, stamina, pressure.
  const y2 = HUD_Y + 15;
  const bowler = inn.bowl[inn.currentBowler];
  if (bowler) {
    x = left;
    x +=
      drawText(`${bowler.p.short.toUpperCase()} ${inn.bowlerFigures(bowler)} (${inn.bowlerOvers(bowler)})`, x, y2, {
        color: COLORS.cream,
      }) + 6;
    if (deliveryLabel) x += drawText(deliveryLabel, x, y2, { color: COLORS.gold }) + 6;
    drawText("STA", x, y2, { color: COLORS.dim });
    x += 20;
    drawBar(x, y2 + 1, 36, 5, bowler.stamina, staminaColor(bowler.stamina));
    x += 42;
  }
  // Pressure on the batting side.
  drawText("PRS", x, y2, { color: COLORS.dim });
  x += 20;
  drawBar(x, y2 + 1, 28, 5, inn.pressure, inn.pressure > 0.6 ? COLORS.red : inn.pressure > 0.35 ? COLORS.gold : "#7ec8ff");

  // Row 3: commentary.
  drawText(commentary.length > 104 ? commentary.slice(0, 101) + ".." : commentary, 4, HUD_Y + 26, { color: COLORS.cream });
}

/** Top-down ground map: fielders, keeper, batters and the ball. */
export function drawMiniMap(left, top, fielders, runners, ball, keeper) {
  const cx = left + 40;
  const cy = top + 30;
  fillEllipse(cx, cy, 42, 32, "rgba(10,20,10,0.55)");
  fillEllipse(cx, cy, 40, 30, "rgba(40,110,60,0.75)");
  strokeEllipse(cx, cy, 40, 30, COLORS.cream);
  fillRect(cx - 1, cy - 6, 2, 12, "#c8b07a");
  const toMap = (p) => ({ x: cx + (p.x / BOUNDARY) * 40, y: cy + ((MID_PITCH - p.z) / BOUNDARY) * 30 });
  for (const f of fielders) {
    const p = toMap(f);
    fillRect(p.x - 1, p.y - 1, 2, 2, COLORS.cream);
  }
  if (keeper) {
    const p = toMap(keeper);
    fillRect(p.x - 1, p.y - 1, 2, 2, COLORS.gold);
  }
  for (const r of runners) {
    const p = toMap(r);
    fillRect(p.x - 1, p.y - 1, 2, 2, "#7ec8ff");
  }
  if (ball && distFromCentre(ball.x, ball.z) < 70) {
    const p = toMap(ball);
    fillCircle(p.x, p.y, 1.5, COLORS.red);
  }
}

/**
 * Banner messages ("FOUR!", "OUT!"...). Each: { text, sub?, color, t0, dur, scale?, y? }.
 * They pop in over the first 0.15s and vanish in the last 0.25s.
 */
export function drawBanners(banners, now) {
  for (const b of banners) {
    const age = now - b.t0;
    if (age < 0 || age > b.dur) continue;
    const grow = age < 0.15 ? 0.6 + (age / 0.15) * 0.4 : 1;
    const scale = Math.max(2, Math.round((b.scale ?? 5) * grow));
    const y = b.y ?? 110;
    const fade = age > b.dur - 0.25 ? (b.dur - age) / 0.25 : 1;
    if (fade <= 0.05) continue;
    const w = textWidth(b.text, scale) + 24;
    fillRect(WIDTH / 2 - w / 2, y - 6, w, 7 * scale + 12, "rgba(10,30,20,0.72)");
    fillRect(WIDTH / 2 - w / 2, y - 6, w, 2, COLORS.gold);
    fillRect(WIDTH / 2 - w / 2, y + 7 * scale + 4, w, 2, COLORS.gold);
    drawText(b.text, WIDTH / 2, y, { scale, color: b.color, outline: COLORS.black, align: "center" });
    if (b.sub) drawText(b.sub, WIDTH / 2, y + 7 * scale + 10, { align: "center", color: COLORS.cream, outline: COLORS.black });
  }
}

/** Full scorecard panel: batting card, bowling figures and conditions. */
export function drawScorecard(inn, x, y, w, h, title) {
  drawPanel(x, y, w, h);
  drawText(title, x + w / 2, y + 7, { align: "center", color: COLORS.gold, scale: 2 });
  let row = y + 26;
  drawText(`${inn.batTeam.name} ${inn.runs}/${inn.wkts}  (${inn.oversText} OV, RR ${inn.runRate.toFixed(2)})`, x + 10, row, {
    color: COLORS.white,
  });
  row += 12;
  const dim = { color: COLORS.dim };
  const dimRight = { color: COLORS.dim, align: "right" };
  drawText("BATTER", x + 10, row, dim);
  drawText("R", x + 300, row, dimRight);
  drawText("B", x + 330, row, dimRight);
  drawText("4S", x + 352, row, dimRight);
  drawText("6S", x + 374, row, dimRight);
  row += 9;
  for (const [i, b] of inn.bat.entries()) {
    if (!b.batted) continue;
    const notOut = !b.out && (i === inn.striker || i === inn.nonStriker);
    const color = notOut ? COLORS.gold : COLORS.cream;
    drawText(`${b.p.name.toUpperCase()}${notOut ? "*" : ""}`, x + 10, row, { color });
    // The dismissal has to fit before the runs column.
    const how = b.out ? b.how.toUpperCase() : notOut ? "NOT OUT" : "";
    drawText(how.length > 19 ? how.slice(0, 18) + "." : how, x + 170, row, dim);
    drawText(String(b.runs), x + 300, row, { color, align: "right" });
    drawText(String(b.balls), x + 330, row, dimRight);
    drawText(String(b.fours), x + 352, row, dimRight);
    drawText(String(b.sixes), x + 374, row, dimRight);
    row += 9;
  }
  const e = inn.extras;
  drawText(`EXTRAS ${e.b + e.lb + e.w + e.nb} (B ${e.b}, LB ${e.lb}, W ${e.w}, NB ${e.nb})`, x + 10, row + 2, dim);
  row += 14;
  if (inn.fow.length) {
    const lines = wrapText("FOW: " + inn.fow.map((f) => `${f.score}-${f.wkt} (${f.name})`).join(", "), Math.floor((w - 20) / 6));
    for (const line of lines.slice(0, 2)) {
      drawText(line, x + 10, row, dim);
      row += 9;
    }
  }

  const bx = x + 400;
  let by = y + 38;
  drawText("BOWLER", bx, by, dim);
  drawText("O", bx + 130, by, dimRight);
  drawText("M", bx + 148, by, dimRight);
  drawText("R", bx + 172, by, dimRight);
  drawText("W", bx + 190, by, dimRight);
  by += 9;
  for (const b of inn.bowl) {
    if (!b.balls) continue;
    drawText(b.p.short.toUpperCase(), bx, by, { color: COLORS.cream });
    drawText(inn.bowlerOvers(b), bx + 130, by, { color: COLORS.cream, align: "right" });
    drawText(String(b.maidens), bx + 148, by, dimRight);
    drawText(String(b.runs), bx + 172, by, { color: COLORS.cream, align: "right" });
    drawText(String(b.wkts), bx + 190, by, { color: COLORS.gold, align: "right" });
    by += 9;
  }
  by += 8;
  const ball = inn.ball;
  drawText("CONDITIONS", bx, by, { color: COLORS.gold });
  by += 10;
  drawText(`PITCH: ${inn.pitch.type.name}`, bx, by, dim);
  by += 9;
  drawText(`WEAR ${(inn.pitch.wear * 100).toFixed(0)}%`, bx, by, dim);
  by += 9;
  drawText(`BALL ${ball.number}: ${ball.overs.toFixed(1)} OV, ${ball.label}`, bx, by, dim);
  by += 9;
  drawText(`HARD ${(ball.hardness * 100).toFixed(0)} SHINE ${(ball.shine * 100).toFixed(0)}`, bx, by, dim);
  by += 9;
  drawText(`ROUGH ${(ball.rough * 100).toFixed(0)} REVERSE ${(ball.reverse * 100).toFixed(0)}`, bx, by, dim);
}

/** Comic speech bubble whose tail points down at (x, y). */
export function drawSpeechBubble(text, x, y) {
  const lines = wrapText(text, 24);
  const w = Math.max(...lines.map((l) => l.length)) * 6 + 7;
  const h = lines.length * 9 + 5;
  const left = Math.round(clamp(x - w / 2, 3, WIDTH - w - 3));
  const top = Math.round(Math.max(3, y - h - 4));
  const ink = "#101010";
  const paper = "#fbfbf4";
  fillRect(left - 1, top - 1, w + 2, h + 2, ink);
  fillRect(left, top, w, h, paper);
  // Tail.
  const tx = Math.round(clamp(x, left + 4, left + w - 6));
  const ty = top + h;
  fillRect(tx - 1, ty, 5, 1, paper);
  fillRect(tx, ty + 1, 3, 1, paper);
  fillRect(tx + 1, ty + 2, 1, 1, paper);
  fillRect(tx - 2, ty, 1, 1, ink);
  fillRect(tx + 4, ty, 1, 1, ink);
  fillRect(tx - 1, ty + 1, 1, 1, ink);
  fillRect(tx + 3, ty + 1, 1, 1, ink);
  fillRect(tx, ty + 2, 1, 1, ink);
  fillRect(tx + 2, ty + 2, 1, 1, ink);
  fillRect(tx + 1, ty + 3, 1, 1, ink);
  lines.forEach((line, i) => drawText(line, left + 4, top + 3 + i * 9, { color: "#151515", shadow: null }));
}
