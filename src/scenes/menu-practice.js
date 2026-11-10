import { WIDTH, COLORS } from "../engine/screen.js";
import { drawText, wrapText } from "../engine/text.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { TEAM_IDS } from "../sim/team-list.js";
import { fixPractice } from "../sim/practice.js";
import { drawTeamSheet, SHEET } from "../render/team-sheet.js";
import { drawPracticePanel } from "../render/practice-panel.js";
import { squad } from "./menu-teams.js";
import { practiceRows, stepRow } from "./practice-rows.js";

/**
 * The menu's practice page (in place of choosing the teams): one squad, its sheet on the left with the batter
 * and bowler lit, and on the right whether you bat or bowl, the squad, who bats and who bowls and (batting)
 * what he bowls. Up and down pick a row, left and right change it, Enter goes on to where and when, Esc back.
 * The choices are kept in the menu's cfg (cfg.mode, cfg.team, cfg.practice) for createMatch (sim/formats.js).
 */

const GAP = 12;
const PANEL_W = 300;
const TOP = 92;
/** The sheet's lit rows: the batter gold, the bowler blue. */
const BAT_MARK = "#5a4a12";
const BOWL_MARK = "#1c3e5c";

/** The page's state: the menu's choices, the practice settings made good for the squad. */
function stateOf(cfg) {
  const team = squad(cfg.team);
  cfg.practice = fixPractice(cfg.practice ?? {}, team);
  return { settings: cfg.practice, team, mode: cfg.mode, pitch: cfg.pitch };
}

export function updatePractice(menu) {
  const cfg = menu.cfg;
  const rows = practiceRows(stateOf(cfg), "menu");
  menu.prow = Math.min(menu.prow ?? 0, rows.length - 1);
  if (keys.pressed("ArrowUp")) {
    menu.prow = (menu.prow + rows.length - 1) % rows.length;
    sfx.click();
  }
  if (keys.pressed("ArrowDown") || keys.pressed("Tab")) {
    menu.prow = (menu.prow + 1) % rows.length;
    sfx.click();
  }
  const dir = keys.pressed("ArrowRight") ? 1 : keys.pressed("ArrowLeft") ? -1 : 0;
  if (dir) {
    const key = rows[menu.prow][0];
    if (key === "mode") cfg.mode = cfg.mode === "bat" ? "bowl" : "bat";
    else if (key === "team") {
      cfg.team = TEAM_IDS[(TEAM_IDS.indexOf(cfg.team) + dir + TEAM_IDS.length) % TEAM_IDS.length];
      cfg.practice = fixPractice(cfg.practice, squad(cfg.team));
    } else cfg.practice = stepRow(stateOf(cfg), key, dir);
    sfx.click();
  }
  if (keys.pressed("Escape")) return menu.turn("game", "next");
  if (keys.pressed("Enter") || keys.pressed("Space")) {
    sfx.click();
    menu.turn("setup", "start");
  }
}

export function drawPractice(menu) {
  const cfg = menu.cfg;
  const state = stateOf(cfg);
  const { settings: s, team } = state;
  const left = (WIDTH - SHEET.w - GAP - PANEL_W) / 2;
  drawTeamSheet(team, left, TOP, {
    label: "THE SQUAD",
    active: false,
    now: menu.t,
    marks: { [s.batter]: BAT_MARK, [s.bowler]: BOWL_MARK },
  });
  const rows = practiceRows(state, "menu");
  const x = left + SHEET.w + GAP;
  drawPracticePanel(x, TOP, PANEL_W, SHEET.h, { title: "IN THE NETS", rows, sel: menu.prow ?? 0, now: menu.t });
  // Under the rows: what RANDOM means, and that it can all change in the session.
  const note =
    cfg.mode === "bat"
      ? "RANDOM IS HIS OWN CHOICE. ESC > PRACTICE CHANGES IT ALL AS YOU GO"
      : "ESC > PRACTICE CHANGES WHO BATS, WHO BOWLS OR THE PITCH AS YOU GO";
  wrapText(note, 46).forEach((line, i) =>
    drawText(line, x + PANEL_W / 2, TOP + SHEET.h - 26 + i * 10, { align: "center", color: COLORS.dim }),
  );
  drawText("UP/DOWN = CHOOSE    LEFT/RIGHT = CHANGE    ENTER = NEXT    ESC = BACK", WIDTH / 2, TOP + SHEET.h + 10, {
    align: "center",
    color: COLORS.dim,
  });
  drawText("GOLD = BATTING   BLUE = BOWLING   NO OVERS, NO SCORE: THE COACH RATES EVERY BALL", WIDTH / 2, TOP + SHEET.h + 22, {
    align: "center",
    color: COLORS.dim,
  });
}
