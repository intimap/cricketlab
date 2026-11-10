import { COLORS, fillRect, drawPanel } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { drawTeamFlag, FLAG_SIZE } from "./team-flag.js";
import { styleName } from "../sim/teams.js";
import { bladeLabel } from "../sim/bats.js";

/** A team sheet's size on the team-selection screen (scenes/menu-teams.js). */
export const SHEET = { w: 290, h: 216 };
/** Where each column starts, from the sheet's left edge. */
export const COLUMNS = { number: 10, name: 28, hand: 152, bat: 169, role: 208 };

const ROW = 14;

/** A player's job on the sheet: keeper, his bowling, or batter. */
function roleOf(p) {
  if (p.keeper) return "KEEPER";
  if (p.bowl) return styleName(p.bowl);
  return "BATTER";
}

/**
 * One side's sheet: who it is (YOU, OPPONENTS), the flag and name, and the XI in batting order with each
 * player's hand, his bat (weight in kg, + big edges, L or S a long or short handle: sim/bats.js) and job. `active` is the side the arrows change, shown with its arrows and a bright edge.
 * `marks` ({ index: colour }) lights players' rows: practice's batter and bowler.
 */
export function drawTeamSheet(team, x, y, { label, active, now, marks = {} }) {
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
    if (marks[i]) fillRect(x + 6, row - 3, w - 12, ROW - 1, marks[i]);
    drawText(String(i + 1).padStart(2), x + COLUMNS.number, row, { color: COLORS.dim });
    drawText(p.name.toUpperCase(), x + COLUMNS.name, row, { color: COLORS.cream });
    drawText(left ? "LH" : "RH", x + COLUMNS.hand, row, { color: left ? COLORS.gold : COLORS.dim });
    if (p.blade) drawText(bladeLabel(p.blade), x + COLUMNS.bat, row, { color: COLORS.cream });
    drawText(roleOf(p), x + COLUMNS.role, row, { color: p.keeper ? COLORS.gold : COLORS.dim });
  });
}
