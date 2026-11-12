import { COLORS, WIDTH } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { drawPracticePanel, practicePanelWidth, PRACTICE_PANEL_STEP } from "../render/practice-panel.js";
import { screenRows, stepScreenRow, screenBlurb } from "./menu-screen.js";

/**
 * The Esc menu's SCREEN page: the same CRT preset and parts as the menu's (scenes/menu-screen.js), in the
 * settings panel, with the game left clear behind it to see the look on. Up and down pick a row, left and
 * right change it, Enter on DONE (or Esc) goes back to the Esc menu.
 */

export function updateScreenPage(menu) {
  const rows = screenRows();
  menu.srow = Math.min(menu.srow ?? 0, rows.length - 1);
  if (keys.pressed("ArrowUp")) menu.srow = (menu.srow + rows.length - 1) % rows.length;
  if (keys.pressed("ArrowDown")) menu.srow = (menu.srow + 1) % rows.length;
  const key = rows[menu.srow][0];
  const dir = keys.pressed("ArrowRight") ? 1 : keys.pressed("ArrowLeft") ? -1 : 0;
  if (dir && key !== "done") {
    stepScreenRow(key, dir);
    sfx.click();
  }
  const done = key === "done" && (keys.pressed("Enter") || keys.pressed("Space"));
  if (done || keys.pressed("Escape") || keys.pressed("Backspace")) menu.screen = "menu";
}

export function drawScreenPage(menu, now) {
  const rows = screenRows();
  const w = Math.max(260, practicePanelWidth(rows));
  const h = 34 + rows.length * PRACTICE_PANEL_STEP;
  const x = (WIDTH - w) / 2;
  const sel = menu.srow ?? 0;
  drawPracticePanel(x, 40, w, h, { title: "SCREEN: THE CRT LOOK", rows, sel, now });
  drawText(screenBlurb(rows[sel][0]), WIDTH / 2, 46 + h, { align: "center", color: COLORS.cream, outline: "rgba(0,0,0,0.8)" });
}
