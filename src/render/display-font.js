import { fillRect } from "../engine/screen.js";
import { GLYPHS, GLYPH_ROWS, SPACE_CELLS } from "./display-glyphs.js";

/**
 * The display font: the game's big lettering (the title, the announcements), drawn from its glyphs
 * (render/display-glyphs.js) at any whole-pixel scale. Each letter has a two-tone fill split by a pale line, a
 * deeper base row, a dark outline and a hard shadow under it, in one of the palettes below. All drawn as
 * rectangles, so it stays crisp at every size.
 */

/** Each palette: the top of the letters, the line across them, the lower half, the base row, the outline and shadow. */
export const DISPLAY_PALETTES = {
  // Gold to green.
  title: { top: "#ffcf3a", line: "#fff1a8", low: "#3fae4f", base: "#1f6e33", edge: "#0f2416" },
  // Light blue to blue.
  four: { top: "#a8deff", line: "#eaf7ff", low: "#3384e0", base: "#1c56a8", edge: "#0b1a33" },
  // Pink to purple.
  six: { top: "#ff9ad6", line: "#ffe3f4", low: "#9a4fe0", base: "#5f2aa0", edge: "#1d0b30" },
  // Reds.
  out: { top: "#ff7a66", line: "#ffd6cc", low: "#d6302a", base: "#8f1616", edge: "#290707" },
  // Whites, the line and base in cool greys so the shape still reads.
  lbw: { top: "#ffffff", line: "#b9c4d4", low: "#e9eef5", base: "#a7b3c4", edge: "#141a24" },
  // Greens, for a decision that goes the batter's way.
  notOut: { top: "#a6f2bc", line: "#e6ffee", low: "#2fb35a", base: "#1a7a3a", edge: "#08240f" },
};

/** The rows where the fill changes: the line across the letters (at the top of this row), and the base row. */
const LINE_ROW = 3;
const BASE_ROW = GLYPH_ROWS - 1;

/** Whether the font has every character of `text` (lower case counts as upper). */
export const displayHas = (text) => [...text.toUpperCase()].every((ch) => ch === " " || GLYPHS[ch]);

const grids = new Map();
/** The ink of a whole line of text, cell by cell: { width, ink: rows of booleans }. Cached by text. */
function gridOf(text) {
  const key = text.toUpperCase();
  if (grids.has(key)) return grids.get(key);
  const columns = [];
  [...key].forEach((ch, i) => {
    if (i > 0) columns.push(null);
    const glyph = GLYPHS[ch];
    if (!glyph) for (let c = 0; c < SPACE_CELLS; c++) columns.push(null);
    else for (let c = 0; c < glyph[0].length; c++) columns.push(glyph.map((row) => row[c] === "#"));
  });
  const ink = Array.from({ length: GLYPH_ROWS }, (_, r) => columns.map((col) => !!col?.[r]));
  const grid = { width: columns.length, ink };
  grids.set(key, grid);
  return grid;
}

/** The text's size on screen (px) at `scale`, outline and shadow included. */
export function displaySize(text, scale = 4) {
  return { w: (gridOf(text).width + 2) * scale, h: (GLYPH_ROWS + 3) * scale };
}

/** Draw each run of cells in a row where `on(r, c)` holds as one rectangle. */
function runs(rows, cols, on, draw) {
  for (let r = 0; r < rows; r++) {
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      const set = c < cols && on(r, c);
      if (set && start < 0) start = c;
      if (!set && start >= 0) {
        draw(r, start, c - start);
        start = -1;
      }
    }
  }
}

/**
 * Draw `text` with its top-left at (x, y) (the outline's corner), or centred on x, or ending at x.
 * opts: { scale (px a cell, whole numbers), palette (a DISPLAY_PALETTES name or a palette), align }.
 */
export function drawDisplayText(text, x, y, { scale = 4, palette = "title", align = "left" } = {}) {
  const p = typeof palette === "string" ? DISPLAY_PALETTES[palette] : palette;
  const s = Math.max(1, Math.round(scale));
  const { width, ink } = gridOf(text);
  const left = Math.round(align === "center" ? x - ((width + 2) * s) / 2 : align === "right" ? x - (width + 2) * s : x);
  const top = Math.round(y);
  const inked = (r, c) => r >= 0 && r < GLYPH_ROWS && c >= 0 && c < width && ink[r][c];
  // The outline: every cell touching ink (the grid with a cell's margin all round); the shadow, the same a cell lower.
  const near = (r, c) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (inked(r - 1 + dr, c - 1 + dc)) return true;
    return false;
  };
  const edge = (r, start, n) => fillRect(left + start * s, top + r * s, n * s, s, p.edge);
  runs(GLYPH_ROWS + 2, width + 2, near, (r, start, n) => {
    edge(r, start, n);
    edge(r + 1, start, n);
  });
  // The fill, row by row: the top colour, the line across, the lower colour, the base.
  const line = Math.max(1, Math.round(s / 3));
  runs(GLYPH_ROWS, width, inked, (r, start, n) => {
    const px = left + (start + 1) * s;
    const py = top + (r + 1) * s;
    fillRect(px, py, n * s, s, r < LINE_ROW ? p.top : r === BASE_ROW ? p.base : p.low);
    if (r === LINE_ROW) fillRect(px, py, n * s, line, p.line);
  });
}
