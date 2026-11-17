import { fillRect } from "../engine/screen.js";
import { darken } from "./kit.js";

/**
 * The wide view's small figures running: a four-frame cycle, side-on when they run across the screen and
 * face-on when they run towards or away from it. Legs reach and kick back, the far leg and arm a shade
 * darker so the stride reads, the arms pump against the legs, and the body rises off the ground between
 * strides. Each frame is pixel art in cells of the figure's scale: c cap, s shirt (t the far side), p pants
 * (q the far side). Side-on frames face right; running left they're drawn mirrored.
 */

const SIDE = [
  // Both feet off the ground: the near leg reaching, the far leg kicked back, the arms opposite.
  { lift: 1, rows: ["...cc..", "...cc..", "..ssss.", ".t.ss.s", "...ss..", "..qpp..", ".q...p.", "q.....p"] },
  // Landed on the near leg, under him; the far knee driving through.
  { lift: 0, rows: ["...cc..", "...cc..", "..sss..", "..tss..", "..sss..", "...pqq.", "...p.q.", "...p..."] },
  // Off the ground again, the other way: the far leg reaching, the near one kicked back.
  { lift: 1, rows: ["...cc..", "...cc..", "..ssss.", ".s.ss.t", "...ss..", "..pqq..", ".p...q.", "p.....q"] },
  // Landed on the far leg; the near knee driving through.
  { lift: 0, rows: ["...cc..", "...cc..", "..sss..", "..sst..", "..sss..", "...qpp.", "...q.p.", "...q..."] },
];

const FRONT = [
  // One knee up and the other arm up; then both feet off the ground; then the other side.
  { lift: 0, rows: [".ccc.", ".ccc.", "ssss.", "s.sss", "..sss", ".p.q.", ".p.q.", ".p..."] },
  { lift: 1, rows: [".ccc.", ".ccc.", ".sss.", "sssss", ".sss.", ".p.q.", ".p.q.", ".p.q."] },
  { lift: 0, rows: [".ccc.", ".ccc.", ".ssss", "sss.s", "sss..", ".p.q.", ".p.q.", "...q."] },
  { lift: 1, rows: [".ccc.", ".ccc.", ".sss.", "sssss", ".sss.", ".p.q.", ".p.q.", ".p.q."] },
];

/** Which frames for a run on screen along (dx, dy), and which way they face: side-on unless it's mostly up or down. */
export function runFrames(dir) {
  if (!dir || Math.abs(dir.x) >= Math.abs(dir.y) * 0.7) return { frames: SIDE, flip: (dir?.x ?? 1) < 0 };
  return { frames: FRONT, flip: false };
}

/**
 * Draw a small figure running, feet at (x, y): `k` px a cell, `phase` counting strides (one cycle each
 * whole number), `dir` the way he's going on screen ({ x, y }, or null), and his colours.
 */
export function drawTinyRun(x, y, k, phase, dir, { cap, shirt, pants }) {
  const { frames, flip } = runFrames(dir);
  const frame = frames[Math.floor((((phase % 1) + 1) % 1) * frames.length)];
  const colours = { c: cap, s: shirt, t: darken(shirt, 40), p: pants, q: darken(pants, 40) };
  const rows = frame.rows;
  const width = rows[0].length;
  const mid = Math.floor(width / 2);
  const px = Math.max(1, Math.round(k));
  for (let r = 0; r < rows.length; r++) {
    const top = y + (r - rows.length - frame.lift) * k;
    for (let i = 0; i < width; i++) {
      const colour = colours[rows[r][i]];
      if (!colour) continue;
      const col = flip ? mid - (i - mid) : i;
      fillRect(Math.round(x + (col - mid - 0.5) * k), Math.round(top), px, px, colour);
    }
  }
}
