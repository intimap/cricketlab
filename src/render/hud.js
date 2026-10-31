import { WIDTH, HEIGHT, COLORS, fillRect, fillCircle, fillEllipse, strokeEllipse, drawPanel, drawBar } from "../engine/screen.js";
import { drawText, textWidth, wrapText } from "../engine/text.js";
import { clamp } from "../math.js";
export { PRESSURE_BAR } from "./batter-meters.js";
import { MID_PITCH, BOUNDARY, distFromCentre } from "../sim/geometry.js";

/** Top of the score bar along the bottom of the screen. */
export const HUD_Y = 324;

export const staminaColor = (s) => (s > 0.6 ? "#7cd67c" : s > 0.35 ? COLORS.gold : COLORS.red);

/** Bottom bar: batters, bowler, partnership, this over and the last ball's call. */
export function drawScoreBar(inn, commentary, deliveryLabel) {
  fillRect(0, HUD_Y, WIDTH, HEIGHT - HUD_Y, COLORS.gold2);
  fillRect(0, HUD_Y + 1, WIDTH, HEIGHT - HUD_Y - 1, COLORS.green);
  fillRect(0, HUD_Y + 1, WIDTH, 1, "#2c6b45");
  const left = 4;
  const right = WIDTH - 4;

  // Row 1, left: the batters, the striker marked.
  const y1 = HUD_Y + 4;
  const striker = inn.bat[inn.striker];
  const other = inn.bat[inn.nonStriker];
  let x = left;
  drawText("•", x, y1, { color: COLORS.gold });
  x += 7;
  x += drawText(`${striker.p.short.toUpperCase()} ${striker.runs}(${striker.balls})`, x, y1, { color: COLORS.cream }) + 10;
  drawText(`${other.p.short.toUpperCase()} ${other.runs}(${other.balls})`, x, y1, { color: COLORS.dim });

  // Row 1, right: bowler, figures, delivery and stamina, laid out from the right.
  let r = right;
  const bowler = inn.bowl[inn.currentBowler];
  if (bowler) {
    r -= 36 + 8;
    drawBar(r, y1 + 1, 36, 5, bowler.stamina, staminaColor(bowler.stamina));
    r -= textWidth("STA") + 3;
    drawText("STA", r, y1, { color: COLORS.dim });
    if (deliveryLabel) {
      r -= textWidth(deliveryLabel) + 6;
      drawText(deliveryLabel, r, y1, { color: COLORS.gold });
    }
    const figures = `${bowler.p.short.toUpperCase()} ${inn.bowlerFigures(bowler)} (${inn.bowlerOvers(bowler)})`;
    drawText(figures, r - 6, y1, { color: COLORS.cream, align: "right" });
  }

  // Row 2, left: the partnership, and what's needed in a chase.
  const y2 = HUD_Y + 15;
  x = left + drawText(`P'SHIP ${inn.partnership.runs}(${inn.partnership.balls})`, left, y2, { color: COLORS.dim }) + 10;
  if (inn.target !== null) drawText(`NEED ${inn.runsNeeded} OFF ${inn.ballsLeft}`, x, y2, { color: COLORS.gold });

  // Row 2, right: this over, ball by ball in words ("DOT, DOT, 2, 4"), boundaries and wickets picked out.
  const balls = inn.overBalls.slice(-8);
  r = right;
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    const word = (b === "." ? "DOT" : b) + (i < balls.length - 1 ? "," : "");
    const color = b === "W" ? COLORS.red : b === "4" || b === "6" ? COLORS.gold : b === "." ? COLORS.dim : COLORS.cream;
    r -= textWidth(word);
    drawText(word, r, y2, { color });
    r -= 6;
  }
  drawText("THIS OVER", r - (balls.length ? 4 : 0), y2, { color: COLORS.dim, align: "right" });

  // Row 3: commentary.
  drawText(commentary.length > 104 ? commentary.slice(0, 101) + ".." : commentary, 4, HUD_Y + 26, { color: COLORS.cream });
}

/** Width and height of the score box in the top right of the screen. */
const SCORE_BOX = { w: 132, h: 33 };

/** The score, double size, with the overs under it, in a box in the top right corner. */
export function drawScoreBox(inn) {
  const x = WIDTH - 4 - SCORE_BOX.w;
  const y = 4;
  drawPanel(x, y, SCORE_BOX.w, SCORE_BOX.h, inn.batTeam.colour, COLORS.gold2);
  drawText(`${inn.batTeam.abbr} ${inn.runs}/${inn.wkts}`, x + SCORE_BOX.w / 2, y + 5, {
    color: COLORS.white,
    scale: 2,
    align: "center",
    outline: "rgba(0,0,0,0.5)",
  });
  drawText(`OV ${inn.oversText}`, x + SCORE_BOX.w / 2, y + 22, {
    color: COLORS.gold,
    align: "center",
    outline: "rgba(0,0,0,0.5)",
  });
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

/** Broadcast card fitted to the pixel frame, with a short arcade pop. */
export function drawBroadcastBanner(title, color, sub, pop = 1, skippable = false) {
  const scale = Math.min(4, Math.max(1, Math.floor(584 / Math.max(1, textWidth(title, 1)))));
  const y = 102 + Math.round((1 - pop) * 12);
  // Score celebrations use the same green, brass and cream as the score HUD.
  const trim = skippable ? COLORS.gold : color;
  const ink = skippable ? COLORS.cream : color;
  drawPanel(16, y - 12, WIDTH - 32, skippable ? 104 : 82, COLORS.green, skippable ? COLORS.gold2 : color);
  fillRect(20, y - 8, WIDTH - 40, 3, trim);
  drawText(title, WIDTH / 2, y + 5, { scale, align: "center", color: ink, outline: COLORS.black });
  drawText(sub, WIDTH / 2, y + 43, { align: "center", color: COLORS.cream });
  if (skippable) drawText("SPACE / ENTER / TAP TO SKIP", WIDTH / 2, y + 72, { align: "center", color: COLORS.dim });
}
