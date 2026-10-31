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

  // Batting and partnership on the left; bowler and figures anchored to the right.
  const bowler = inn.bowl[inn.currentBowler];
  const figures = bowler ? `${inn.bowlerFigures(bowler)} (${inn.bowlerOvers(bowler)})` : "";
  const bowlerWidth = bowler
    ? Math.min(textWidth(`${bowler.p.short.toUpperCase()} ${figures}`), Math.floor((RIGHT - LEFT) * 0.37)) : 0;
  const battingRight = bowler ? RIGHT - bowlerWidth - GAP : RIGHT;
  const partnership = `P'SHIP ${inn.partnership.runs}(${inn.partnership.balls})`;
  const chase = inn.target !== null ? `NEED ${inn.runsNeeded} OFF ${inn.ballsLeft}` : "";
  const playerWidth = Math.floor((battingRight - LEFT - textWidth(partnership) - 2 * GAP - 7) / 2);
  const striker = inn.bat[inn.striker];
  const other = inn.bat[inn.nonStriker];
  drawText("•", LEFT, y1, { color: COLORS.gold });
  let x = LEFT + 7;
  x += drawText(playerLabel(striker.p, `${striker.runs}(${striker.balls})`, playerWidth), x, y1,
    { color: COLORS.cream }) + GAP;
  x += drawText(playerLabel(other.p, `${other.runs}(${other.balls})`, playerWidth), x, y1,
    { color: COLORS.dim }) + GAP;
  drawText(partnership, x, y1, { color: COLORS.gold });
  if (bowler) {
    drawText(playerLabel(bowler.p, figures, bowlerWidth), RIGHT, y1, { align: "right", color: COLORS.cream });
  }

  // The lower line reserves room for the chase and the over's individual deliveries.
  const over = overBallLayout(inn.overBalls);
  const overX = RIGHT - over.width;
  drawOverBalls(over, RIGHT, y2);
  if (chase) drawText(chase, LEFT, y2, { color: COLORS.gold });
  if (bowler) {
    const staminaWidth = textWidth("STA") + 3 + 28;
    const staminaX = overX - GAP - staminaWidth;
    const deliveryLeft = LEFT + (chase ? textWidth(chase) + GAP : 0);
    if (deliveryLabel) {
      drawText(fit(deliveryLabel, staminaX - GAP - deliveryLeft), staminaX - GAP, y2,
        { align: "right", color: COLORS.gold });
    }
    drawText("STA", staminaX, y2, { color: COLORS.dim });
    drawBar(staminaX + textWidth("STA") + 3, y2 + 1, 28, 5, bowler.stamina, staminaColor(bowler.stamina));
  }

  drawText(fit(commentary, WIDTH - 8), 4, HUD_Y + 31, { color: COLORS.cream });
}
