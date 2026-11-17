import { ctx, COLORS } from "./screen.js";
import { GLYPHS, SMALL_GLYPHS, GAP, HEIGHT, CASED_HEIGHT } from "./font-glyphs.js";
import { FIELD_GLYPHS } from "./font-field.js";

/** The glyph for a character (capitals only; anything unknown is a question mark). */
const capital = (ch) => GLYPHS[ch.toUpperCase()] ?? GLYPHS[ch] ?? GLYPHS["?"];
/**
 * A glyph in a style: false, the text font in capitals however it's written; true ("cased"), keeping small
 * letters; "field", the field font (capitals, for words over the play).
 */
const glyphOf = (ch, style) =>
  style === "field" ? (FIELD_GLYPHS[ch.toUpperCase()] ?? capital(ch)) : (style && SMALL_GLYPHS[ch]) || capital(ch);

// Rendered strings are cached as small canvases, keyed by colour, scale and text.
const cache = new Map();

function renderText(text, color, scale, cased = false) {
  const key = `${color}|${scale}|${cased || 0}|${text}`;
  let canvas = cache.get(key);
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.width = Math.max(1, textWidth(text, scale, cased));
  canvas.height = (cased === true ? CASED_HEIGHT : HEIGHT) * scale;
  const c = canvas.getContext("2d");
  c.fillStyle = color;
  let x = 0;
  for (const ch of text) {
    const g = glyphOf(ch, cased);
    for (let row = 0; row < g.rows.length; row++) {
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
export function textWidth(text, scale = 1, cased = false) {
  let w = 0;
  for (const ch of text) w += glyphOf(ch, cased).w + GAP;
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
 * opts: scale, align ("left" | "center" | "right"), color, outline (colour), cased (keep small letters), font ("field": the field font),
 * shadow (colour, or null for none; ignored when outlined).
 */
export function drawText(text, x, y, opts = {}) {
  const scale = opts.scale ?? 1;
  const cased = opts.font === "field" ? "field" : !!opts.cased;
  const width = textWidth(text, scale, cased);
  let left = x;
  if (opts.align === "center") left = x - width / 2;
  else if (opts.align === "right") left = x - width;
  left = Math.round(left);
  y = Math.round(y);
  if (opts.outline) {
    const outline = renderText(text, opts.outline, scale, cased);
    const d = Math.max(1, scale / 2);
    for (const [dx, dy] of OUTLINE_OFFSETS) ctx.drawImage(outline, left + dx * d, y + dy * d);
  }
  if (opts.shadow !== null && !opts.outline) {
    ctx.drawImage(renderText(text, opts.shadow ?? "rgba(0,0,0,0.6)", scale, cased), left + 1, y + 1);
  }
  ctx.drawImage(renderText(text, opts.color ?? COLORS.cream, scale, cased), left, y);
  return width;
}

/**
 * Greedy word wrap to lines that fit the room `maxChars` letters of the old fixed-width font took (6 px
 * each), measured in this font: so a box sized for that many characters is still filled, not overrun.
 */
export function wrapText(text, maxChars, cased = false) {
  const room = maxChars * 6;
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = (line + " " + word).trim();
    if (textWidth(next, 1, cased) > room) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
