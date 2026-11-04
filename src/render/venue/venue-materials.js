import { FLAG, LAYER } from "./venue-raster.js";

/**
 * What the scenery's surfaces are made of: each material is shade(u, v, ppm, x, y) for a face (venue-raster.js),
 * u along it and v up it in metres, ppm its pixels per metre there, (x, y) the pixel. Detail smaller than a
 * couple of pixels is drawn by the pixel instead (every other row or column), so nothing shimmers into moire.
 * Colours are the midday daylight look; venue-light.js relights them.
 */

/** Deterministic noise in [0, 1) for integers. */
export function hash(a, b, seed = 0) {
  let n = (a * 374761393 + b * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Per-pixel grain from a small table (tiling every 64 px, too fine to see), much cheaper than hashing. */
const NOISE = Float32Array.from({ length: 64 * 64 }, (_, i) => hash(i & 63, i >> 6, 99));
export const noise = (x, y, seed = 0) => NOISE[(((y + seed * 23) & 63) << 6) | ((x + seed * 37) & 63)];

const add = (c, d) => [c[0] + d, c[1] + d, c[2] + d];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const PAL = {
  white: hex("#ece7d4"),
  whiteLine: hex("#c4bca2"),
  cream: hex("#e4d8b8"),
  trim: hex("#2e5a3c"),
  trimLight: hex("#3f7450"),
  roof: hex("#4c7d48"),
  roofDark: hex("#355f36"),
  roofLight: hex("#62935a"),
  roofRed: hex("#8e4a36"),
  roofRedDark: hex("#6e3626"),
  brick: hex("#93503a"),
  brickDark: hex("#74392a"),
  mortar: hex("#b89a82"),
  glass: hex("#31404e"),
  glassShine: hex("#5d7488"),
  frame: hex("#f3f1e6"),
  shadowIn: hex("#2a2f2c"),
  seat: hex("#2f6040"),
  seatDark: hex("#21462e"),
  concrete: hex("#a9a596"),
  concreteDark: hex("#86837a"),
  grass: hex("#5c9a3a"),
  grassDark: hex("#4b8530"),
  bank: hex("#67a03f"),
  bankDark: hex("#548b33"),
  gravel: hex("#b9ad8e"),
  gravelDark: hex("#9f9476"),
  steel: hex("#9aa0a6"),
  steelDark: hex("#6c7278"),
  lampOff: hex("#d8dcd8"),
  screenWhite: hex("#f1f1e8"),
  screenWhiteLine: hex("#d6d6cc"),
  screenBlack: hex("#1c1e22"),
  screenBlackLine: hex("#2c2f34"),
  screenFrame: hex("#7a7f86"),
  board: hex("#1d3a2c"),
  boardLine: hex("#2b4e3c"),
  tin: hex("#e8e6d8"),
  canvas: hex("#f0ece0"),
  clockFace: hex("#f6f2e2"),
  gold: hex("#c8a040"),
  shirts: [
    "#d8453e",
    "#f2f0e8",
    "#3f6fc0",
    "#e8c040",
    "#2c2c34",
    "#78b85a",
    "#e2833e",
    "#9a5aa8",
    "#5ab8cc",
    "#f8f8f4",
    "#c23048",
    "#ffd6e0",
    "#3a8a5a",
  ].map(hex),
  skins: ["#ecc4a0", "#d4a27c", "#b07c56", "#7a523a", "#f4d6b8"].map(hex),
  hair: ["#2a1e18", "#5a3c28", "#b08c50", "#1e1e1e", "#c8c4bc", "#8a5a30"].map(hex),
  rugs: ["#c84a3a", "#3a64b0", "#e8d060", "#f2f2ea", "#5a9a50", "#d06aa0"].map(hex),
};

/** The crowd's colours as pixels on the crowd layer, made once. */
const onCrowd = (list) => list.map((c) => [...c, 0, LAYER.crowd]);
const CROWD = { shirts: onCrowd(PAL.shirts), skins: onCrowd(PAL.skins), hair: onCrowd(PAL.hair) };
const ON_BANK = PAL.rugs.map((c) => [...c, FLAG.shadowed]);
const BANK = [PAL.bankDark, PAL.bank, add(PAL.bank, 18)].map((c) => [...c, FLAG.shadowed]);

/** A plain surface with a little grain. */
export function flat(colour, grain = 5, seed = 1) {
  return (u, v, ppm, x, y) => add(colour, (noise(x, y, seed) - 0.5) * grain);
}

/** Every `period` metres, or every other pixel when that's under 3 px: is (metres m, at ppm) on a line? */
function lineAt(m, period, ppm, width = 1) {
  const px = period * ppm;
  if (px < 3) return Math.floor(m * ppm) % 2 === 0 && px >= 1.4;
  return ((m % period) + period) % period < width / ppm;
}

/** Painted weatherboards: a shadow line under each board. */
export function weatherboard(colour = PAL.white, line = PAL.whiteLine, board = 0.3) {
  return (u, v, ppm, x, y) => (lineAt(v, board, ppm) ? line : add(colour, (noise(x, y, 7) - 0.5) * 4));
}

/** Brick, with mortar lines when there's room for them. */
export function brick(colour = PAL.brick) {
  return (u, v, ppm, x, y) => {
    if (ppm < 5) return add(colour, (noise(x, y, 9) - 0.5) * 12);
    const course = Math.floor(v / 0.25);
    const off = course % 2 ? 0.25 : 0;
    if (lineAt(v, 0.25, ppm) || lineAt(u + off, 0.5, ppm)) return PAL.mortar;
    return hash(Math.floor((u + off) / 0.5), course, 3) < 0.25 ? PAL.brickDark : colour;
  };
}

/** Corrugated iron: ribs running up the roof. */
export function iron(colour = PAL.roof, dark = PAL.roofDark, light = PAL.roofLight) {
  return (u, v, ppm, x, y) => {
    const rib = lineAt(u, 0.4, ppm);
    if (rib) return dark;
    return hash(Math.floor(u / 0.4), Math.floor(v / 2), 5) < 0.08 ? light : colour;
  };
}

/**
 * A wall of `base` with windows: in each storey band [v0, v1] a window every `spacing` m of `width`,
 * framed; the glass is flagged to glow at night. `doors` [u0, u1] ranges are doorways on the ground floor.
 */
export function windowed(base, { storeys, spacing = 3, width = 1.4, margin = 1.5, length, doors = [] }) {
  const count = Math.max(1, Math.floor((length - margin * 2 + spacing - width) / spacing));
  const start = (length - (count - 1) * spacing - width) / 2;
  return (u, v, ppm, x, y) => {
    for (const [v0, v1] of storeys) {
      if (v < v0 || v > v1) continue;
      const k = Math.floor((u - start) / spacing);
      const wu = u - start - k * spacing;
      if (k < 0 || k >= count || wu > width) break;
      const edge = 1 / ppm;
      if (wu < edge || wu > width - edge || v < v0 + edge || v > v1 - edge) return PAL.frame;
      // A glazing bar across the middle, and a glint in the top corner.
      if (width * ppm > 6 && Math.abs(v - (v0 + v1) / 2) < edge / 2) return PAL.frame;
      return v > v1 - (v1 - v0) * 0.25 && wu < width * 0.35 ? [...PAL.glassShine, FLAG.window] : [...PAL.glass, FLAG.window];
    }
    for (const [d0, d1] of doors) {
      if (u >= d0 && u <= d1 && v < 2.4) return u - d0 < 1 / ppm || d1 - u < 1 / ppm ? PAL.frame : PAL.shadowIn;
    }
    return base(u, v, ppm, x, y);
  };
}

/**
 * Seating rows up a sloping face, each seat a person or empty (seeded): heads in the top of the seat and
 * shirts below. The people are on the crowd layer. `rows` m deep along v, seats `seat` m wide.
 */
export function seating({ rowDepth = 0.8, seat = 0.5, full = 0.7, seed = 1, colour = PAL.seat, dark = PAL.seatDark } = {}) {
  return (u, v, ppm, x, y) => {
    const row = Math.floor(v / rowDepth);
    const col = Math.floor(u / seat);
    const fu = u / seat - col;
    const fv = v / rowDepth - row;
    if (fv < 0.18) return dark;
    if (hash(col, row, seed) > full) return colour;
    const h = hash(col, row, seed + 1);
    const shirt = CROWD.shirts[Math.floor(h * PAL.shirts.length)];
    // Small at this distance: a shirt with a head pixel on top.
    const tall = rowDepth * ppm;
    const head = tall >= 4 ? fv > 0.62 : fv > 0.8;
    if (head) {
      if (fu < 0.25 || fu > 0.75) return colour;
      const hair = hash(col, row, seed + 2) < 0.35;
      return hair ? CROWD.hair[Math.floor(h * 7) % PAL.hair.length] : CROWD.skins[Math.floor(h * 11) % PAL.skins.length];
    }
    if (fu < 0.1 || fu > 0.9) return colour;
    return shirt;
  };
}

/** A grass bank, with picnic rugs here and there (the people on it are sprites: venue-people.js). */
export function bankGrass(seed = 1, rugs = 0.12) {
  return (u, v, ppm, x, y) => {
    const cu = Math.floor(u / 2.2);
    const cv = Math.floor(v / 2.2);
    if (hash(cu, cv, seed) < rugs) {
      const fu = u / 2.2 - cu;
      const fv = v / 2.2 - cv;
      if (fu > 0.2 && fu < 0.8 && fv > 0.25 && fv < 0.75) return ON_BANK[Math.floor(hash(cu, cv, seed + 1) * PAL.rugs.length)];
    }
    const h = noise(x, y, seed + 3);
    return BANK[h < 0.25 ? 0 : h > 0.96 ? 2 : 1];
  };
}

/** The picket fence: white pickets with gaps, a rail behind; pointed tops. */
export function pickets(height = 1.05) {
  return (u, v, ppm) => {
    const period = 0.15;
    const px = period * ppm;
    const at = px >= 3 ? ((u % period) + period) % period < 0.09 : Math.floor(u * ppm) % 2 === 0;
    const rail = Math.abs(v - 0.3) < Math.max(0.05, 0.5 / ppm) || Math.abs(v - 0.8) < Math.max(0.05, 0.5 / ppm);
    if (v > height - Math.max(0.06, 1 / ppm))
      return at && px >= 3 && ((u % period) + period) % period > 0.02 && ((u % period) + period) % period < 0.07
        ? PAL.white
        : null;
    if (at) return v < 0.08 ? PAL.whiteLine : PAL.white;
    return rail ? PAL.whiteLine : null;
  };
}

/** A sightscreen: white (or black for the white ball) boards in a grey frame. */
export function sightscreen(black = false) {
  const face = black ? PAL.screenBlack : PAL.screenWhite;
  const seam = black ? PAL.screenBlackLine : PAL.screenWhiteLine;
  return (u, v, ppm, x, y) => {
    if (v < 0.35) return PAL.screenFrame;
    if (u < 1.5 / ppm || v > 4.65 - 0.2 / ppm) return PAL.screenFrame;
    return lineAt(u, 2, ppm) && 2 * ppm > 6 ? seam : face;
  };
}

/** The scoreboard's face: a dark board with rows of tin plates (the real score is written over it). */
export function scoreboardFace(width, height) {
  return (u, v, ppm) => {
    const edge = 1.2 / ppm;
    if (u < edge || u > width - edge || v < edge || v > height - edge) return PAL.frame;
    // Plates in two rows, left and right, round where the score is written.
    const row = Math.floor((v / height) * 4);
    if (row === 0 && Math.floor(u / 0.9) % 2 === 0 && v > height * 0.06 && v < height * 0.2) return PAL.boardLine;
    return lineAt(v, height / 4, ppm) && height * ppm > 20 ? PAL.boardLine : PAL.board;
  };
}

/** Canvas with coloured stripes (a marquee). */
export function striped(colour, width = 0.8) {
  return (u, v, ppm) => (Math.floor(u / width) % 2 ? colour : PAL.canvas);
}

/** A floodlight head: rows of lamps, flagged to glow at night. */
export function lampHead() {
  return (u, v, ppm) => {
    const cu = Math.floor(u / 0.8);
    const cv = Math.floor(v / 0.7);
    const fu = u / 0.8 - cu;
    const fv = v / 0.7 - cv;
    if (0.8 * ppm < 2) return [...PAL.lampOff, FLAG.lamp];
    return fu > 0.15 && fu < 0.85 && fv > 0.15 && fv < 0.85 ? [...PAL.lampOff, FLAG.lamp] : PAL.steelDark;
  };
}

/** A clock face on the gable: a white disc, a gold rim, the hands at ten to three. */
export function clockFace(cu, cv, radius) {
  return (u, v, ppm) => {
    const du = u - cu;
    const dv = v - cv;
    const r = Math.hypot(du, dv);
    if (r > radius) return null;
    if (r > radius - Math.max(0.08, 1 / ppm)) return PAL.gold;
    const a = Math.atan2(du, dv);
    const hand = (angle, len) => Math.abs(a - angle) < 0.25 && r < len;
    if (r < Math.max(0.06, 0.8 / ppm) || hand(-1.05, radius * 0.75) || hand(1.57, radius * 0.6)) return PAL.shadowIn;
    return PAL.clockFace;
  };
}

/** A material a shade darker (in a band of a wall; a whole face uses its `bright` instead). */
export const darker = (m, k) => {
  const cache = new Map();
  return (u, v, ppm, x, y) => {
    const c = m(u, v, ppm, x, y);
    if (!c) return c;
    let d = cache.get(c);
    if (!d) {
      d = [c[0] * k, c[1] * k, c[2] * k, c[3], c[4]];
      if (cache.size < 256) cache.set(c, d);
    }
    return d;
  };
};
/** A wall made of bands, each material up to its height (v, m). */
/** A wall made of bands: each material up to its height (v, m). */
export const bands = (list) => (u, v, ppm, x, y) => {
  for (const [top, m] of list) if (v <= top) return m(u, v, ppm, x, y);
  return list[list.length - 1][1](u, v, ppm, x, y);
};
/** Plain painted and bare surfaces. */
export const white = flat(PAL.white, 4, 3);
export const trim = flat(PAL.trim, 4, 4);
export const post = flat(PAL.frame, 3, 5);
export const steel = flat(PAL.steel, 6, 6);
export const concrete = flat(PAL.concrete, 8, 7);
