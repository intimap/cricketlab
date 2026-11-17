import { ctx, COLORS } from "./screen.js";
import { GLYPHS, GAP, HEIGHT } from "./font-glyphs.js";

/** The glyph for a character (capitals only; anything unknown is a question mark). */
const glyphOf = (ch) => GLYPHS[ch.toUpperCase()] ?? GLYPHS[ch] ?? GLYPHS["?"];

// Rendered strings are cached as small canvases, keyed by colour, scale and text.
const cache = new Map();

function renderText(text, color, scale) {
  const key = `${color}|${scale}|${text}`;
  let canvas = cache.get(key);
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.width = Math.max(1, textWidth(text, scale));
  canvas.height = HEIGHT * scale;
  const c = canvas.getContext("2d");
  c.fillStyle = color;
  let x = 0;
  for (const ch of text) {
    const g = glyphOf(ch);
    for (let row = 0; row < HEIGHT; row++) {
      for (let col = 0; col < g.w; col++) {
        if (g.rows[row] & (1 << (g.w - 1 - col))) c.fillRect(x + col * scale, row * scale, scale, scale);
      }
    }
    x += (g.w + GAP) * scale;
  }
  if (cache.size > 600) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

/** How wide (px) `text` is drawn: each letter its own width, a pixel between them. */
export function textWidth(text, scale = 1) {
  let w = 0;
  for (const ch of text) w += glyphOf(ch).w + GAP;
  return Math.max(0, (w - GAP) * scale);
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

/**
 * Greedy word wrap to lines that fit the room `maxChars` letters of the old fixed-width font took (6 px
 * each), measured in this font: so a box sized for that many characters is still filled, not overrun.
 */
export function wrapText(text, maxChars) {
  const room = maxChars * 6;
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = (line + " " + word).trim();
    if (textWidth(next) > room) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
