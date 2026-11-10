import { WIDTH, HEIGHT, COLORS, fillRect } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";
import { drawTeamFlag, FLAG_SIZE } from "./team-flag.js";
import { HUD_Y } from "./score-bar.js";

/**
 * Practice's strip along the bottom, in place of the score bar: no score, overs or partnership. The squad's
 * flag at each end; the batter and the bowler (and what he bowled, once it's been played); what the ball is
 * set to and the session's count; the coach's or the caller's line below.
 *
 * bar: { team, batter, bowler, delivery (label or ""), ball (the settings in words, or ""), tally (text), line }.
 */

const LEFT = 4 + FLAG_SIZE.w + 6;
const RIGHT = WIDTH - LEFT;

function fit(text, width) {
  if (textWidth(text) <= width) return text;
  let short = text;
  while (short.length && textWidth(short + "..") > width) short = short.slice(0, -1);
  return short ? short + ".." : "";
}

export function drawPracticeBar(bar) {
  fillRect(0, HUD_Y, WIDTH, HEIGHT - HUD_Y, COLORS.green);
  fillRect(0, HUD_Y, WIDTH, 1, COLORS.gold2);
  fillRect(0, HUD_Y + 1, WIDTH, 1, "#2c6b45");
  const y1 = HUD_Y + 4;
  const y2 = HUD_Y + 18;
  drawTeamFlag(bar.team, 4, y1);
  drawTeamFlag(bar.team, WIDTH - 4 - FLAG_SIZE.w, y1);
  const half = (RIGHT - LEFT) / 2 - 8;
  drawText("•", LEFT, y1, { color: COLORS.gold });
  drawText(fit(bar.batter, half - 7), LEFT + 7, y1, { color: COLORS.cream });
  const bowlerWidth = Math.min(textWidth(bar.bowler), half);
  drawText(fit(bar.bowler, half), RIGHT, y1, { align: "right", color: COLORS.cream });
  if (bar.delivery)
    drawText(fit(bar.delivery, half - bowlerWidth - 10), RIGHT - bowlerWidth - 10, y1, { align: "right", color: COLORS.gold });
  const tallyWidth = textWidth(bar.tally);
  drawText(bar.tally, RIGHT, y2, { align: "right", color: COLORS.gold });
  if (bar.ball) drawText(fit(bar.ball, RIGHT - LEFT - tallyWidth - 12), LEFT, y2, { color: COLORS.dim });
  drawText(fit(bar.line, WIDTH - 8), WIDTH / 2, HUD_Y + 31, { align: "center", color: COLORS.cream });
}
