import { COLORS, fillRect, drawPanel } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";

/**
 * The practice settings panel: on the menu's practice page (scenes/menu-practice.js) and in a session's Esc
 * menu (scenes/practice-session.js). A title, then rows of label and value; the chosen row is lit, its value
 * between arrows. A row with no label is a button (DONE).
 *
 * rows: [key, label, value]; `sel` the chosen row; `step` the rows' spacing.
 */

export const PRACTICE_PANEL_STEP = 15;
/** Where the values start, from the panel's left edge. */
const VALUE_X = 84;

export function drawPracticePanel(x, y, w, h, { title, rows, sel, now, step = PRACTICE_PANEL_STEP }) {
  drawPanel(x, y, w, h, "#0d2318");
  drawText(title, x + w / 2, y + 7, { align: "center", color: COLORS.gold });
  fillRect(x + 8, y + 18, w - 16, 1, "#2c6b45");
  const top = y + 26;
  rows.forEach(([, label, value], i) => {
    const ry = top + i * step;
    const selected = sel === i;
    if (selected) fillRect(x + 6, ry - 4, w - 12, step - 1, "#24563a");
    const color = selected ? COLORS.gold : COLORS.cream;
    if (!label) {
      drawText(value, x + w / 2, ry, { align: "center", color });
      return;
    }
    drawText(label, x + 10, ry, { color: COLORS.dim });
    // Shown between arrows when chosen (blinking), as the menu's rows are.
    const arrows = selected && Math.floor(now * 2) % 2 === 0;
    drawText(arrows ? `< ${value} >` : `  ${value}`, x + VALUE_X, ry, { color });
  });
}

/** How wide a panel needs to be for these rows. */
export const practicePanelWidth = (rows) => VALUE_X + 20 + Math.max(...rows.map(([, , v]) => textWidth(`< ${v} >`)));
