import { ctx, COLORS } from "./screen.js";

// 5x7 bitmap font. Each row is a 5-bit mask, most significant bit on the left.
const GLYPHS = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14],
  1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14],
  7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 2, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 14, 0, 0, 0],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "*": [0, 4, 21, 14, 21, 4, 0],
  "%": [24, 25, 2, 4, 8, 19, 3],
  "#": [10, 10, 31, 10, 31, 10, 10],
  "=": [0, 0, 31, 0, 31, 0, 0],
  "<": [2, 4, 8, 16, 8, 4, 2],
  ">": [8, 4, 2, 1, 2, 4, 8],
  _: [0, 0, 0, 0, 0, 0, 31],
  "|": [4, 4, 4, 4, 4, 4, 4],
  "~": [0, 0, 0, 12, 12, 0, 0],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "↑": [4, 14, 21, 4, 4, 4, 4],
  "↓": [4, 4, 4, 4, 21, 14, 4],
  "←": [0, 4, 8, 31, 8, 4, 0],
  "→": [0, 4, 2, 31, 2, 4, 0],
  "↗": [15, 3, 5, 9, 16, 0, 0],
  "↖": [30, 24, 20, 18, 1, 0, 0],
  "↘": [0, 0, 16, 9, 5, 3, 15],
  "↙": [0, 0, 1, 18, 20, 24, 30],
  "[": [14, 8, 8, 8, 8, 8, 14],
  "]": [14, 2, 2, 2, 2, 2, 14],
  "•": [0, 0, 14, 14, 14, 0, 0],
};

// Rendered strings are cached as small canvases, keyed by colour, scale and text.
const cache = new Map();

function renderText(text, color, scale) {
  const key = `${color}|${scale}|${text}`;
  let canvas = cache.get(key);
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.width = Math.max(1, textWidth(text, scale));
  canvas.height = 7 * scale;
  const c = canvas.getContext("2d");
  c.fillStyle = color;
  let x = 0;
  for (const ch of text) {
    const rows = GLYPHS[ch.toUpperCase()] ?? GLYPHS["?"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (rows[row] & (16 >> col)) c.fillRect(x + col * scale, row * scale, scale, scale);
      }
    }
    x += 6 * scale;
  }
  if (cache.size > 600) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

export function textWidth(text, scale = 1) {
  return Math.max(0, text.length * 6 * scale - scale);
}

const OUTLINE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
];

/**
 * Draw text in the pixel font and return its width.
 * opts: scale, align ("left" | "center" | "right"), color, outline (colour),
 * shadow (colour, or null for none; ignored when outlined).
 */
export function drawText(text, x, y, opts = {}) {
  const scale = opts.scale ?? 1;
  const width = textWidth(text, scale);
  let left = x;
  if (opts.align === "center") left = x - width / 2;
  else if (opts.align === "right") left = x - width;
  left = Math.round(left);
  y = Math.round(y);
  if (opts.outline) {
    const outline = renderText(text, opts.outline, scale);
    const d = Math.max(1, scale / 2);
    for (const [dx, dy] of OUTLINE_OFFSETS) ctx.drawImage(outline, left + dx * d, y + dy * d);
  }
  if (opts.shadow !== null && !opts.outline) {
    ctx.drawImage(renderText(text, opts.shadow ?? "rgba(0,0,0,0.6)", scale), left + 1, y + 1);
  }
  ctx.drawImage(renderText(text, opts.color ?? COLORS.cream, scale), left, y);
  return width;
}

/** Greedy word wrap to lines of at most `maxChars` characters. */
export function wrapText(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}
