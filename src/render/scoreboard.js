import { fillRect, COLORS } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

/**
 * The ground's own scoreboard, painted into the scenery, showing the real
 * score: the board's face is cleared and the lines drawn over it each frame.
 * Small boards (the wide view) use a tiny 3x5 font to match the art; big ones
 * use the game's font. Where each board is lives in grounds.js (`scoreboard`).
 */

// 3x5 glyphs: one 3-bit row mask per line, left bit first.
const TINY = {
  0: [7, 5, 5, 5, 7],
  1: [2, 6, 2, 2, 7],
  2: [7, 1, 7, 4, 7],
  3: [7, 1, 7, 1, 7],
  4: [5, 5, 7, 1, 1],
  5: [7, 4, 7, 1, 7],
  6: [7, 4, 7, 5, 7],
  7: [7, 1, 1, 1, 1],
  8: [7, 5, 7, 5, 7],
  9: [7, 5, 7, 1, 7],
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [3, 4, 4, 4, 3],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 6, 3],
  R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
  "/": [1, 1, 2, 4, 4],
  ".": [0, 0, 0, 0, 2],
  "-": [0, 0, 7, 0, 0],
  "'": [2, 2, 0, 0, 0],
};

function drawTiny(text, x, y, color) {
  let cx = x;
  for (const ch of text) {
    const rows = TINY[ch];
    if (rows) {
      rows.forEach((mask, r) => {
        for (let c = 0; c < 3; c++) if (mask & (4 >> c)) fillRect(cx + c, y + r, 1, 1, color);
      });
    }
    cx += 4;
  }
}

/** What the board says, a line each: score, then the target or the other side's total, overs, and so on. */
function boardLines(scene, big) {
  const match = scene.match;
  const inn = scene.inn;
  const score = `${inn.batTeam.abbr} ${inn.runs}/${inn.wkts}`;
  const overs = `OV ${inn.oversText}`;
  const other = [...match.innings].reverse().find((i) => i !== inn && i.batTeam.abbr !== inn.batTeam.abbr);
  const them = other && `${other.batTeam.abbr} ${other.runs}/${other.wkts}`;
  if (!big) {
    if (inn.target !== null) return [score, `TGT ${inn.target}`, overs];
    return them ? [score, them, overs] : [score, overs];
  }
  if (inn.target !== null) return [score, overs, `NEED ${inn.runsNeeded}`, `OFF ${inn.ballsLeft}`];
  return [score, them ?? overs, them ? overs : `RR ${inn.runRate.toFixed(2)}`, `P'SHIP ${inn.partnership.runs}`];
}

/**
 * Paint the live score onto a ground's scoreboard. board: { x, y, w, h, face, big?, lines: [row...] }
 * in the scenery's own pixels; `yOffset` is where that scenery is drawn on screen.
 */
export function drawScoreboard(scene, board, yOffset = 0) {
  if (!board || !scene.inn) return;
  const top = board.y + yOffset;
  fillRect(board.x, top, board.w, board.h, board.face);
  const lines = boardLines(scene, board.big);
  lines.slice(0, board.lines.length).forEach((text, i) => {
    const color = i === 0 ? COLORS.gold : COLORS.cream;
    const y = board.lines[i] + yOffset;
    if (board.big) drawText(text, board.x + board.w / 2, y, { color, align: "center", shadow: null });
    else drawTiny(text, Math.round(board.x + (board.w - (text.length * 4 - 1)) / 2), y, color);
  });
}
