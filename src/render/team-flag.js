import { COLORS, fillRect } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

export const FLAG_SIZE = { w: 36, h: 20 };

/** Small pixel flags stay sharp at the game's native resolution. */
export function drawTeamFlag(team, x, y) {
  const { w, h } = FLAG_SIZE;
  fillRect(x - 1, y - 1, w + 2, h + 2, COLORS.gold2);
  if (team.abbr === "ENG") {
    fillRect(x, y, w, h, COLORS.cream);
    fillRect(x + 15, y, 5, h, COLORS.red);
    fillRect(x, y + 8, w, 4, COLORS.red);
    return;
  }
  fillRect(x, y, w, h, team.abbr === "AUS" ? "#172a50" : team.colour);
  if (team.abbr !== "AUS") {
    drawText(team.abbr, x + w / 2, y + 6, { align: "center", color: COLORS.cream });
    return;
  }
  // The Union Jack canton and Commonwealth / Southern Cross stars.
  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i * 10 / 16);
    fillRect(x + i, y + row, 1, 1, COLORS.cream);
    fillRect(x + i, y + 9 - row, 1, 1, COLORS.cream);
  }
  fillRect(x + 6, y, 4, 10, COLORS.cream);
  fillRect(x, y + 3, 16, 4, COLORS.cream);
  fillRect(x + 7, y, 2, 10, COLORS.red);
  fillRect(x, y + 4, 16, 2, COLORS.red);
  for (const [sx, sy] of [[7, 15], [26, 4], [22, 10], [31, 11], [26, 17]]) {
    fillRect(x + sx - 1, y + sy, 3, 1, COLORS.cream);
    fillRect(x + sx, y + sy - 1, 1, 3, COLORS.cream);
  }
  fillRect(x + 29, y + 8, 1, 1, COLORS.cream);
}
