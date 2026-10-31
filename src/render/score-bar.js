import { WIDTH, HEIGHT, COLORS, fillRect, drawBar } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";
import { drawTeamFlag, FLAG_SIZE } from "./team-flag.js";

export const HUD_Y = 324;
export const staminaColor = (s) => (s > 0.6 ? "#7cd67c" : s > 0.35 ? COLORS.gold : COLORS.red);
const LEFT = 4 + FLAG_SIZE.w + 6;
const RIGHT = WIDTH - LEFT;
const GAP = 10;

/** Fit names and delivery descriptions, keeping scores and figures intact. */
function fit(text, width) {
  if (textWidth(text) <= width) return text;
  let short = text;
  while (short.length && textWidth(short + "..") > width) short = short.slice(0, -1);
  return short ? short + ".." : "";
}

function playerLabel(player, figures, width) {
  const nameWidth = width - textWidth(figures) - textWidth(" ");
  const name = fit(player.short.toUpperCase(), nameWidth);
  return name ? `${name} ${figures}` : figures;
}

/** Two information lines framed by the batting and bowling flags; commentary below. */
export function drawScoreBar(inn, commentary, deliveryLabel) {
  fillRect(0, HUD_Y, WIDTH, HEIGHT - HUD_Y, COLORS.green);
  fillRect(0, HUD_Y, WIDTH, 1, COLORS.gold2);
  fillRect(0, HUD_Y + 1, WIDTH, 1, "#2c6b45");
  const y1 = HUD_Y + 4;
  const y2 = HUD_Y + 15;
  drawTeamFlag(inn.batTeam, 4, y1);
  drawTeamFlag(inn.bowlTeam, WIDTH - 4 - FLAG_SIZE.w, y1);

  // Both batters and their partnership share the batting line.
  const partnership = `P'SHIP ${inn.partnership.runs}(${inn.partnership.balls})`;
  const chase = inn.target !== null ? `NEED ${inn.runsNeeded} OFF ${inn.ballsLeft}` : "";
  const chaseWidth = chase ? textWidth(chase) + GAP : 0;
  const playerWidth = Math.floor((RIGHT - LEFT - chaseWidth - textWidth(partnership) - 2 * GAP - 7) / 2);
  const striker = inn.bat[inn.striker];
  const other = inn.bat[inn.nonStriker];
  drawText("•", LEFT, y1, { color: COLORS.gold });
  let x = LEFT + 7;
  x += drawText(playerLabel(striker.p, `${striker.runs}(${striker.balls})`, playerWidth), x, y1,
    { color: COLORS.cream }) + GAP;
  x += drawText(playerLabel(other.p, `${other.runs}(${other.balls})`, playerWidth), x, y1,
    { color: COLORS.dim }) + GAP;
  drawText(partnership, x, y1, { color: COLORS.gold });
  if (chase) drawText(chase, RIGHT, y1, { align: "right", color: COLORS.gold });

  // The second line keeps bowling details and the current over together.
  const balls = inn.overBalls.slice(-8).map(b => String(b).toUpperCase());
  const overWidth = textWidth("THIS OVER") + (balls.length ? 6 : 0) +
    balls.reduce((width, word) => width + textWidth(word), 0) + Math.max(0, balls.length - 1) * 5;
  const overX = RIGHT - overWidth;
  x = overX + drawText("THIS OVER", overX, y2, { color: COLORS.dim }) + 6;
  for (const word of balls) {
    const color = word === "W" ? COLORS.red : word === "4" || word === "6" ? COLORS.gold : COLORS.cream;
    x += drawText(word, x, y2, { color }) + 5;
  }
  const bowler = inn.bowl[inn.currentBowler];
  if (bowler) {
    const staminaWidth = textWidth("STA") + 3 + 28;
    const staminaX = overX - GAP - staminaWidth;
    const detailWidth = staminaX - GAP - LEFT;
    const figures = `${inn.bowlerFigures(bowler)} (${inn.bowlerOvers(bowler)})`;
    const full = `${bowler.p.short.toUpperCase()} ${figures}`;
    const bowlerWidth = deliveryLabel ? Math.min(textWidth(full), Math.floor(detailWidth * 0.58)) : detailWidth;
    x = LEFT + drawText(playerLabel(bowler.p, figures, bowlerWidth), LEFT, y2, { color: COLORS.cream }) + GAP;
    if (deliveryLabel) drawText(fit(deliveryLabel, staminaX - GAP - x), x, y2, { color: COLORS.gold });
    drawText("STA", staminaX, y2, { color: COLORS.dim });
    drawBar(staminaX + textWidth("STA") + 3, y2 + 1, 28, 5, bowler.stamina, staminaColor(bowler.stamina));
  }

  drawText(fit(commentary, WIDTH - 8), 4, HUD_Y + 26, { color: COLORS.cream });
}
