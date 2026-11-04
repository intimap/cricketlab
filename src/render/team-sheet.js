import { COLORS, fillRect, drawPanel } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { drawTeamFlag, FLAG_SIZE } from "./team-flag.js";
import { styleName } from "../sim/teams.js";

/** A team sheet's size on the team-selection screen (scenes/menu-teams.js). */
export const SHEET = { w: 290, h: 216 };

const ROW = 14;

/** A player's job on the sheet: keeper, his bowling, or batter. */
function roleOf(p) {
  if (p.keeper) return "KEEPER";
  if (p.bowl) return styleName(p.bowl);
  return "BATTER";
}

/**
 * One side's sheet: who it is (YOU, OPPONENTS), the flag and name, and the XI in batting order with each
 * player's hand and job. `active` is the side the arrows change, shown with its arrows and a bright edge.
 */
export function drawTeamSheet(team, x, y, { label, active, now }) {
  const { w, h } = SHEET;
  drawPanel(x, y, w, h, active ? "#12321f" : "#0d2318", active ? COLORS.gold : COLORS.gold2);
  drawText(label, x + w / 2, y + 7, { align: "center", color: active ? COLORS.gold : COLORS.dim });
  drawTeamFlag(team, x + 14, y + 20);
  drawText(team.name.toUpperCase(), x + 14 + FLAG_SIZE.w + 10, y + 24, { color: COLORS.white, scale: 2 });
  if (active && Math.floor(now * 2) % 2 === 0) {
    drawText("<", x + 4, y + 26, { color: COLORS.gold });
    drawText(">", x + w - 10, y + 26, { color: COLORS.gold });
  }
  const top = y + 50;
  fillRect(x + 8, top - 5, w - 16, 1, "#2c6b45");
  team.players.forEach((p, i) => {
    const row = top + i * ROW;
    const left = p.hand === "left";
    drawText(String(i + 1).padStart(2), x + 10, row, { color: COLORS.dim });
    drawText(p.name.toUpperCase(), x + 28, row, { color: COLORS.cream });
    drawText(left ? "LH" : "RH", x + 184, row, { color: left ? COLORS.gold : COLORS.dim });
    drawText(roleOf(p), x + 206, row, { color: p.keeper ? COLORS.gold : COLORS.dim });
  });
}
