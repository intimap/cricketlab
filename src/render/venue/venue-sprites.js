import { hash, noise, PAL } from "./venue-materials.js";

/**
 * Trees and people as pixel sprites (venue-raster.js drawSprite): drawn at the size the camera sees them,
 * shaded in daylight from the upper left. A tree's crown is a few leaf clumps, each a dithered ball, so it
 * reads as foliage at any size; its near side is brought forward so trees in front cover those behind.
 */

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Each kind of tree: four tones from shade to highlight, the trunk, and the crown's shape. */
export const TREES = {
  oak: { tones: ["#22441e", "#2e5a27", "#3f7531", "#578f3e"].map(hex), trunk: hex("#5a4430"), wide: 1, tall: 0.85, clumps: 7 },
  elm: { tones: ["#284e24", "#36672c", "#4b8236", "#659c46"].map(hex), trunk: hex("#5e4a34"), wide: 0.85, tall: 1.05, clumps: 8 },
  gum: {
    tones: ["#3a4c2c", "#4f6638", "#6a8246", "#879e5c"].map(hex),
    trunk: hex("#cfc6b2"),
    wide: 0.8,
    tall: 1.1,
    clumps: 6,
    sparse: true,
  },
  pine: {
    tones: ["#1b3622", "#25482b", "#305b36", "#437147"].map(hex),
    trunk: hex("#4a3828"),
    wide: 0.55,
    tall: 1.5,
    clumps: 6,
    cone: true,
  },
};

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** A tree `height` m tall (crown about half its height across), seeded. Returns paint(put, x, y, ppm). */
export function treeSprite(kind, height, seed) {
  const t = TREES[kind] ?? TREES.oak;
  const crownR = height * 0.32 * t.wide;
  const crownY = height - crownR * t.tall;
  // The leaf clumps: placed in the crown, larger in the middle.
  const clumps = [];
  for (let i = 0; i < t.clumps; i++) {
    const a = hash(i, 1, seed) * Math.PI * 2;
    const d = Math.sqrt(hash(i, 2, seed)) * 0.62;
    const r = (0.38 + hash(i, 3, seed) * 0.22) * crownR;
    let dx = Math.cos(a) * d * crownR;
    let dy = Math.sin(a) * d * crownR * t.tall;
    // A pine narrows to a point.
    if (t.cone) dx *= 1 - (dy / (crownR * t.tall) + 1) * 0.4;
    clumps.push({ dx, dy, r });
  }
  // The middle one, so no crown is hollow.
  clumps.push({ dx: 0, dy: 0, r: crownR * 0.6 });
  // Lower clumps drawn last: they're nearer the camera's eye line.
  clumps.sort((a, b) => a.dy - b.dy);
  return (put, x, y, ppm) => {
    // Trunk: from the ground into the crown, a darker right side.
    const tw = Math.max(1, Math.round(height * 0.045 * ppm * (kind === "gum" ? 0.8 : 1)));
    const top = Math.round(y - (crownY - crownR * 0.2) * ppm);
    for (let py = top; py <= Math.round(y); py++)
      for (let k = 0; k < tw; k++) put(x - (tw >> 1) + k, py, k === tw - 1 && tw > 1 ? shadeOf(t.trunk, -30) : t.trunk, 0.05);
    const cx = x;
    const cy = y - crownY * ppm;
    for (const c of clumps) {
      const rx = c.r * ppm;
      if (rx < 0.5) continue;
      const ox = cx + c.dx * ppm;
      const oy = cy - c.dy * ppm;
      const r2 = Math.ceil(rx);
      for (let py = -r2; py <= r2; py++)
        for (let px = -r2; px <= r2; px++) {
          const nx = px / rx;
          const ny = py / rx;
          const rr = nx * nx + ny * ny;
          if (rr > 1) continue;
          const X = Math.round(ox + px);
          const Y = Math.round(oy + py);
          const nz = Math.sqrt(1 - rr);
          const lift = (nz * c.r + 0.3 * crownR) * 0.6;
          if (put.shows && !put.shows(X, Y, lift)) continue;
          // Ragged edges and, for a gum, gaps in the canopy.
          const n = noise(X >> (ppm > 6 ? 1 : 0), Y >> (ppm > 6 ? 1 : 0), seed & 63);
          if (rr > 0.7 && n < (rr - 0.7) * 2.6) continue;
          if (t.sparse && n < 0.1 && rr < 0.8) continue;
          // Light from the upper left, a little towards the viewer; the underside darker.
          const light = -0.55 * nx - 0.65 * ny + 0.5 * nz + (c.dy / (crownR * 1.2)) * 0.25;
          const k = light * 2.2 + 1.6 + (BAYER[Y & 3][X & 3] / 16 - 0.5) * 0.9 + (n - 0.5) * 0.7;
          const tone = t.tones[Math.max(0, Math.min(3, Math.floor(k)))];
          put(X, Y, tone, lift);
        }
    }
  };
}

const shadeOf = (c, d) => [c[0] + d, c[1] + d, c[2] + d];

/**
 * A spectator: sitting (on a bank) or standing; seeded shirt, skin and hair, now and then a sun hat.
 * Returns paint(put, x, y, ppm), standing at (x, y).
 */
export function personSprite(seed, standing = false) {
  const shirt = PAL.shirts[Math.floor(hash(seed, 1) * PAL.shirts.length)];
  const skin = PAL.skins[Math.floor(hash(seed, 2) * PAL.skins.length)];
  const hair = PAL.hair[Math.floor(hash(seed, 3) * PAL.hair.length)];
  const hat = hash(seed, 4) < 0.2 ? (hash(seed, 5) < 0.5 ? hex("#f4f0e0") : hex("#d8c088")) : null;
  const legs = [hex("#3a4a6a"), hex("#d8d2c0"), hex("#4a3c30"), hex("#6a7a5a")][Math.floor(hash(seed, 6) * 4)];
  return (put, x, y, ppm) => {
    const head = Math.max(1, Math.round(0.22 * ppm));
    const bodyW = Math.max(1, Math.round(0.42 * ppm));
    const bodyH = Math.max(1, Math.round((standing ? 0.6 : 0.45) * ppm));
    const legH = standing ? Math.max(1, Math.round(0.75 * ppm)) : Math.max(0, Math.round(0.12 * ppm));
    const x0 = Math.round(x - bodyW / 2);
    let py = Math.round(y);
    for (let i = 0; i < legH; i++, py--)
      for (let k = 0; k < bodyW; k++) if (!standing || bodyW < 3 || k !== bodyW >> 1) put(x0 + k, py, legs, 0.1);
    for (let i = 0; i < bodyH; i++, py--)
      for (let k = 0; k < bodyW; k++)
        put(x0 + k, py, i === bodyH - 1 && bodyW > 2 && (k === 0 || k === bodyW - 1) ? skin : shirt, 0.1);
    const hx = Math.round(x - head / 2);
    for (let i = 0; i < head; i++, py--)
      for (let k = 0; k < head; k++)
        put(hx + k, py, hat && i === head - 1 ? hat : i === head - 1 && head > 1 ? hair : skin, 0.12);
    if (hat && head > 1) for (let k = -1; k <= head; k++) put(hx + k, py + 1, hat, 0.13);
  };
}

/** A beach umbrella: a coloured dome on a pole, `seed` picking the colour. */
export function umbrellaSprite(seed) {
  const colour = PAL.rugs[Math.floor(hash(seed, 7) * PAL.rugs.length)];
  return (put, x, y, ppm) => {
    const r = Math.max(2, Math.round(1.1 * ppm));
    const top = Math.round(y - 1.9 * ppm);
    for (let py = top; py <= Math.round(y); py++) put(Math.round(x), py, PAL.white, 0.2);
    for (let py = 0; py <= Math.ceil(r * 0.55); py++) {
      const half = Math.round(r * Math.sqrt(Math.max(0, 1 - (py / (r * 0.6)) ** 2)));
      for (let k = -half; k <= half; k++)
        put(
          Math.round(x) + k,
          top + py - Math.round(r * 0.5),
          Math.floor((k + r) / Math.max(1, r / 2)) % 2 ? colour : PAL.canvas,
          0.3,
        );
    }
  };
}
