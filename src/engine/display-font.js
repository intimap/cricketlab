import { ctx } from "./screen.js";
import { drawText } from "./text.js";

/**
 * A big display font loaded from a font file, for headline text. The outline glyphs are snapped to hard
 * pixels (no anti-aliasing) so they sit with the bitmap font in the 640x360 frame.
 */
const FAMILY = "CricketDisplay";
let ready = false;
const cache = new Map();

/** Load the font at `url`. Until it's in, display text falls back to the bitmap font. */
export async function loadDisplayFont(url) {
  try {
    const face = new FontFace(FAMILY, `url(${url})`);
    document.fonts.add(await face.load());
    ready = true;
  } catch {
    ready = false;
  }
}

const OUTLINE = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
];

/** Render `text` at `size` px in `color`, with every pixel fully on or off. */
function renderCrisp(text, size, color) {
  const key = `${text}|${size}|${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  g.font = `${size}px ${FAMILY}`;
  const m = g.measureText(text);
  const top = Math.ceil(m.actualBoundingBoxAscent);
  c.width = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 2);
  c.height = Math.max(1, top + Math.ceil(m.actualBoundingBoxDescent) + 2);
  g.font = `${size}px ${FAMILY}`;
  g.fillStyle = color;
  g.fillText(text, 1 + m.actualBoundingBoxLeft, 1 + top);
  const img = g.getImageData(0, 0, c.width, c.height);
  // Half-covered pixels go solid, the rest clear: the pixel-art look.
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= 110 ? 255 : 0;
  g.putImageData(img, 0, 0);
  if (cache.size > 200) cache.clear();
  cache.set(key, c);
  return c;
}

/**
 * Draw headline text in the display font, top edge at `y`; returns its height.
 * opts: size (px), align ("left" | "center" | "right"), color, outline (colour, 1px per `thick`), thick.
 */
export function drawDisplayText(text, x, y, opts = {}) {
  const size = opts.size ?? 48;
  if (!ready) {
    const scale = Math.max(2, Math.round(size / 9));
    drawText(text, x, y, { scale, align: opts.align, color: opts.color, outline: opts.outline });
    return 7 * scale;
  }
  const glyphs = renderCrisp(text, size, opts.color ?? "#ffffff");
  let left = x;
  if (opts.align === "center") left = x - glyphs.width / 2;
  else if (opts.align === "right") left = x - glyphs.width;
  left = Math.round(left);
  y = Math.round(y);
  if (opts.outline) {
    const edge = renderCrisp(text, size, opts.outline);
    const d = opts.thick ?? 2;
    for (const [dx, dy] of OUTLINE) ctx.drawImage(edge, left + dx * d, y + dy * d);
  }
  ctx.drawImage(glyphs, left, y);
  return glyphs.height;
}
