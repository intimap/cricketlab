import { WIDTH, HEIGHT, COLORS, fillRect, drawBar } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";
import { drawTeamFlag, FLAG_SIZE } from "./team-flag.js";
import { overBallLayout, drawOverBalls } from "./over-balls.js";

export const HUD_Y = 320;
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
  const y2 = HUD_Y + 18;
  drawTeamFlag(inn.batTeam, 4, y1);
  drawTeamFlag(inn.bowlTeam, WIDTH - 4 - FLAG_SIZE.w, y1);

  // Keep all bowling details together on the upper right, without losing batting scores.
  const bowler = inn.bowl[inn.currentBowler];
  const striker = inn.bat[inn.striker];
  const other = inn.bat[inn.nonStriker];
  const strikerScore = `${striker.runs}(${striker.balls})`;
  const otherScore = `${other.runs}(${other.balls})`;
  const partnership = `P'SHIP ${inn.partnership.runs}(${inn.partnership.balls})`;
  const chase = inn.target !== null ? `NEED ${inn.runsNeeded} OFF ${inn.ballsLeft}` : "";
  const figures = bowler ? `${inn.bowlerFigures(bowler)} (${inn.bowlerOvers(bowler)})` : "";
  const staminaWidth = textWidth("STA") + 3 + 28;
  const fullBowlerWidth = bowler ? textWidth(`${bowler.p.short.toUpperCase()} ${figures}`) : 0;
  const battingMinimum = 7 + 2 * GAP + textWidth(partnership) + textWidth(strikerScore) + textWidth(otherScore) +
    12 + Math.min(29, textWidth(striker.p.short)) + Math.min(29, textWidth(other.p.short));
  const preferredBowling = fullBowlerWidth + staminaWidth + GAP + (deliveryLabel ? textWidth(deliveryLabel) + GAP : 0);
  const bowlingWidth = bowler ? Math.min(preferredBowling, RIGHT - LEFT - battingMinimum - GAP) : 0;
  const bowlingContent = bowlingWidth - staminaWidth - GAP - (deliveryLabel ? GAP : 0);
  const minimumBowler = bowler ? Math.min(29, textWidth(bowler.p.short)) + 6 + textWidth(figures) : 0;
  const bowlerWidth = deliveryLabel
    ? Math.min(fullBowlerWidth, Math.max(minimumBowler, Math.floor(bowlingContent * 0.65))) : bowlingContent;
  const battingRight = bowler ? RIGHT - bowlingWidth - GAP : RIGHT;
  const playerSpace = battingRight - LEFT - textWidth(partnership) - 2 * GAP - 7;
  const strikerWidth = Math.floor((playerSpace + textWidth(strikerScore) - textWidth(otherScore)) / 2);
  const otherWidth = playerSpace - strikerWidth;
  drawText("•", LEFT, y1, { color: COLORS.gold });
  let x = LEFT + 7;
  x += drawText(playerLabel(striker.p, strikerScore, strikerWidth), x, y1,
    { color: COLORS.cream }) + GAP;
  x += drawText(playerLabel(other.p, otherScore, otherWidth), x, y1,
    { color: COLORS.dim }) + GAP;
  drawText(partnership, x, y1, { color: COLORS.gold });
  if (bowler) {
    const staminaX = RIGHT - staminaWidth;
    const bowlerRight = staminaX - GAP;
    const deliveryRight = bowlerRight - bowlerWidth - GAP;
    if (deliveryLabel) {
      drawText(fit(deliveryLabel, bowlingContent - bowlerWidth), deliveryRight, y1,
        { align: "right", color: COLORS.gold });
    }
    drawText(playerLabel(bowler.p, figures, bowlerWidth), bowlerRight, y1, { align: "right", color: COLORS.cream });
    drawText("STA", staminaX, y1, { color: COLORS.dim });
    drawBar(staminaX + textWidth("STA") + 3, y1 + 1, 28, 5, bowler.stamina, staminaColor(bowler.stamina));
  }

  // The lower line is reserved for the chase and the over's individual deliveries.
  drawOverBalls(overBallLayout(inn.overBalls), RIGHT, y2);
  if (chase) drawText(chase, LEFT, y2, { color: COLORS.gold });

  drawText(fit(commentary, WIDTH - 8), 4, HUD_Y + 31, { color: COLORS.cream });
}
