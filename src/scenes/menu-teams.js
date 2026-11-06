import { WIDTH, COLORS } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { TEAMS, TEAM_IDS } from "../sim/team-list.js";
import { drawTeamSheet, SHEET } from "../render/team-sheet.js";

/**
 * The menu's team-selection page: your side on the left and the computer's on the right, each with its
 * flag and XI. Up and down pick a side, left and right change its team (never the same as the other's),
 * Enter goes on to where and when, Esc goes back. Takes the menu (scenes/menu.js).
 */

const SIDES = ["team", "opponent"];
const GAP = 16;
const TOP = 92;

/** Squads are built once for showing (sim/team-list.js builds a fresh one for each match). */
const shown = new Map();
const squad = (id) => {
  if (!shown.has(id)) shown.set(id, (TEAMS[id] ?? TEAMS.AUS)());
  return shown.get(id);
};

export function updateTeams(menu) {
  const cfg = menu.cfg;
  menu.side ??= 0;
  if (keys.pressed("ArrowUp") || keys.pressed("ArrowDown") || keys.pressed("Tab")) {
    menu.side = 1 - menu.side;
    sfx.click();
  }
  const dir = keys.pressed("ArrowRight") ? 1 : keys.pressed("ArrowLeft") ? -1 : 0;
  if (dir) {
    const key = SIDES[menu.side];
    const other = cfg[SIDES[1 - menu.side]];
    // Round the teams, stepping over the one the other side has.
    let i = TEAM_IDS.indexOf(cfg[key]);
    do i = (i + dir + TEAM_IDS.length) % TEAM_IDS.length;
    while (TEAM_IDS[i] === other);
    cfg[key] = TEAM_IDS[i];
    sfx.click();
  }
  if (keys.pressed("Escape")) return menu.turn("game", "next");
  if (keys.pressed("Enter") || keys.pressed("Space")) {
    sfx.click();
    menu.turn("setup", "start");
  }
}

export function drawTeams(menu) {
  const cfg = menu.cfg;
  const left = (WIDTH - 2 * SHEET.w - GAP) / 2;
  const labels = menu.practice ? ["YOUR SIDE", "FACING"] : ["YOU", "THE COMPUTER"];
  SIDES.forEach((key, i) =>
    drawTeamSheet(squad(cfg[key]), left + i * (SHEET.w + GAP), TOP, { label: labels[i], active: menu.side === i, now: menu.t }),
  );
  drawText("UP/DOWN = SIDE    LEFT/RIGHT = TEAM    ENTER = NEXT    ESC = BACK", WIDTH / 2, TOP + SHEET.h + 10, {
    align: "center",
    color: COLORS.dim,
  });
  drawText("BAT: WEIGHT (KG)   + BIG EDGES   L / S LONG OR SHORT HANDLE", WIDTH / 2, TOP + SHEET.h + 22, {
    align: "center",
    color: COLORS.dim,
  });
}
