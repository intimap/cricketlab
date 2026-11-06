// The pixel work for the fit tool (tools/fit-painted.mjs): an image painted or generated for one of a
// ground's layers, cut to the shape the code draws for that layer (render/venue/venue-paint-over.js), any
// holes inside the shape filled from the drawn layer, and its colours snapped to a small palette so it
// sits with the pixel art round it. Plain arrays, so the checks run without a browser.

/** Nearest colour in `palette` ([[r, g, b]...]) to (r, g, b). */
export function nearest(palette, r, g, b) {
  let best = palette[0];
  let d = Infinity;
  for (const c of palette) {
    const e = (c[0] - r) ** 2 * 0.3 + (c[1] - g) ** 2 * 0.59 + (c[2] - b) ** 2 * 0.11;
    if (e < d) {
      d = e;
      best = c;
    }
  }
  return best;
}

/**
 * A palette of `k` colours for the opaque pixels of `rgba` (where `keep(i)` says so): k-means, started from
 * colours spread far apart, on a sample of at most 20000 pixels. Deterministic.
 */
export function paletteOf(rgba, k, keep = () => true) {
  const all = [];
  for (let i = 0; i < rgba.length / 4; i++) if (rgba[i * 4 + 3] >= 128 && keep(i)) all.push(i);
  if (!all.length) return [];
  const step = Math.max(1, Math.floor(all.length / 20000));
  const pts = [];
  for (let n = 0; n < all.length; n += step) pts.push([rgba[all[n] * 4], rgba[all[n] * 4 + 1], rgba[all[n] * 4 + 2]]);
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // Start from the first sample, then each next centre the sample farthest from those chosen.
  const centres = [pts[0].slice()];
  const near = pts.map((p) => dist(p, centres[0]));
  while (centres.length < Math.min(k, pts.length)) {
    let far = 0;
    for (let i = 1; i < pts.length; i++) if (near[i] > near[far]) far = i;
    if (near[far] === 0) break;
    centres.push(pts[far].slice());
    for (let i = 0; i < pts.length; i++) near[i] = Math.min(near[i], dist(pts[i], centres[centres.length - 1]));
  }
  for (let round = 0; round < 10; round++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let best = 0;
      let d = Infinity;
      centres.forEach((c, i) => {
        const e = dist(p, c);
        if (e < d) {
          d = e;
          best = i;
        }
      });
      const s = sums[best];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    }
    sums.forEach((s, i) => {
      if (s[3]) centres[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centres.map((c) => c.map(Math.round));
}

/**
 * Fit an image (already scaled to the layer's w x h) to one layer of a drawn picture:
 *   image    the painted or generated pixels, RGBA
 *   drawn    the drawn picture's pixels, RGBA (alpha 0 is sky), and `layer` its layer index for each pixel
 *   index    which layer this is
 *   loose    let paint go over the sky as well (a tree crown painted taller), not just the layer's shape
 *   palette  [[r, g, b]...] to snap to, or null to keep the image's colours
 * Returns { rgba, stats: { shape, painted, filled, cut, colours } }: pixels in the shape, how many came
 * from the image, how many holes were filled from the drawn layer, how much paint fell outside and was cut.
 */
export function fitLayer({ w, h, image, drawn, layer, index, loose = false, palette = null }) {
  const out = new Uint8ClampedArray(w * h * 4);
  const used = new Set();
  let shape = 0;
  let painted = 0;
  let filled = 0;
  let cut = 0;
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    const inShape = drawn[j + 3] > 0 && layer[i] === index;
    const sky = drawn[j + 3] === 0;
    const opaque = image[j + 3] >= 128;
    if (inShape) shape++;
    if (!inShape && !(loose && sky)) {
      if (opaque) cut++;
      continue;
    }
    if (!opaque) {
      if (!inShape) continue;
      // A hole in the paint: the drawn layer shows through, so nothing goes missing.
      out[j] = drawn[j];
      out[j + 1] = drawn[j + 1];
      out[j + 2] = drawn[j + 2];
      out[j + 3] = 255;
      filled++;
      continue;
    }
    const c = palette ? nearest(palette, image[j], image[j + 1], image[j + 2]) : [image[j], image[j + 1], image[j + 2]];
    out[j] = c[0];
    out[j + 1] = c[1];
    out[j + 2] = c[2];
    out[j + 3] = 255;
    used.add((c[0] << 16) | (c[1] << 8) | c[2]);
    painted++;
  }
  return { rgba: out, stats: { shape, painted, filled, cut, colours: used.size } };
}
