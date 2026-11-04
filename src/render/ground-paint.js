import { clamp } from "../math.js";
import { PITCH_LENGTH } from "../sim/geometry.js";
import { PITCH_LOOKS } from "./grounds.js";
import { paintSky, dimScenery, paintLamps } from "./lighting.js";

/** The ground painter's kit: pitch and crease sizes, colour helpers, noise, a pixel buffer, scenery layers, cracks. */

export const W = 640;
export const H = 360;
// The pitch: 3.05 m wide, running a little past each set of stumps.
export const PITCH_HALF = 1.52;
export const PITCH_FROM = -1.3;
export const PITCH_TO = PITCH_LENGTH + 1.3;
// The creases (m).
export const POPPING = 1.22;
export const POPPING_HALF = 1.83;
export const RETURN_X = 1.32;
export const CREASE_HALF = 0.025;
export const STUMP_X = [-0.114, 0, 0.114];
export const STUMP_HEIGHT = 0.71;

export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const shade = (c, d) => c.map((v) => v + d);

/** Deterministic noise in [0, 1) for pixel (x, y). */
export function hash(x, y, seed) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** A surface pixel: the base colour with a little jitter, and now and then a lighter blade or a darker speck. */
export function texture(base, x, y, seed, speck) {
  const h = hash(x, y, seed);
  if (h < 0.03) return shade(base, 16);
  if (h < 0.06) return speck ?? shade(base, -14);
  return shade(base, (hash(x + 911, y, seed) - 0.5) * 6);
}

/** Read/write access to a canvas's pixels. */
export class Pixels {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.img = this.ctx.getImageData(0, 0, W, H);
  }
  put(x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const d = this.img.data;
    d[i] = clamp(Math.round(c[0]), 0, 255);
    d[i + 1] = clamp(Math.round(c[1]), 0, 255);
    d[i + 2] = clamp(Math.round(c[2]), 0, 255);
    d[i + 3] = 255;
  }
  blend(x, y, c, t) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const d = this.img.data;
    this.put(x, y, mix([d[i], d[i + 1], d[i + 2]], c, t));
  }
  done() {
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
}

/**
 * The scenery a view is built on: either one painting (an asset id), or a
 * stack of layers drawn in order, each { image, x, y } (an asset id placed
 * at column x, row y; `sky: true` marks the sky) or { clouds: id, count, top, bottom } (clouds cut from a sheet and
 * scattered by the seed between those rows). A low sun warms the sky towards the horizon.
 */
export function sceneryCanvas(scenery, images, seed, light) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const layers = typeof scenery === "string" ? [{ image: scenery, y: 0 }] : scenery;
  // A look that dims the scenery (dusk, night) builds everything but the sky on its own canvas first.
  const front = light.dim && typeof scenery !== "string" ? document.createElement("canvas") : null;
  if (front) {
    front.width = W;
    front.height = H;
  }
  const lamps = [];
  for (const layer of layers) {
    const target = front && !layer.sky ? front.getContext("2d") : ctx;
    if (layer.image) target.drawImage(images[layer.image], layer.x ?? 0, layer.y ?? 0);
    if (layer.clouds) scatterClouds(target, images[layer.clouds], layer, seed, light.clouds);
    for (const [x, y, w, h] of layer.lamps ?? []) lamps.push([x + (layer.x ?? 0), y + (layer.y ?? 0), w, h]);
    if (!layer.sky) continue;
    const top = layer.y ?? 0;
    const foot = top + images[layer.image].height;
    if (light.sky) paintSky(ctx, top, foot, light, seed);
    else if (light.glow) {
      // Over the sky alone (it's all that's on the canvas yet), strongest at its foot - much of which the trees hide.
      const [r, g, b] = rgb(light.glow.colour);
      const wash = ctx.createLinearGradient(0, top, 0, foot);
      wash.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
      wash.addColorStop(0.5, `rgba(${r},${g},${b},1)`);
      wash.addColorStop(1, `rgba(${r},${g},${b},1)`);
      ctx.save();
      ctx.globalAlpha = light.glow.amount;
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = wash;
      ctx.fillRect(0, top, W, foot - top);
      ctx.restore();
    }
  }
  if (front) {
    dimScenery(front.getContext("2d"), light);
    ctx.drawImage(front, 0, 0);
  }
  paintLamps(ctx, lamps, light);
  return canvas;
}

/**
 * For each column, the top row of the scenery standing on the ground (every image layer but the sky),
 * or null for a single painting, where stands and sky can't be told apart.
 */
export function skyline(scenery, images) {
  if (typeof scenery === "string") return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  for (const layer of scenery) {
    if (layer.image && !layer.sky) ctx.drawImage(images[layer.image], layer.x ?? 0, layer.y ?? 0);
  }
  const a = ctx.getImageData(0, 0, W, H).data;
  const tops = [];
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H && a[(y * W + x) * 4 + 3] === 0) y++;
    tops.push(y);
  }
  return tops;
}

/** The shadow the stands and trees throw across the outfield (from the ground's first row down), when the sun is low. */
export function castShade(px, view, images, light) {
  const tops = light.shade && skyline(view.scenery, images);
  if (!tops) return;
  const colour = rgb(light.shade.colour);
  for (let x = 0; x < W; x++) {
    const reach = Math.max(0, view.groundFrom - tops[x]) * light.shade.length;
    for (let y = view.groundFrom; y < view.groundFrom + reach; y++) {
      // A softer last row.
      px.blend(x, y, colour, light.shade.amount * Math.min(1, view.groundFrom + reach - y));
    }
  }
}

/** The separate sprites on a sheet: bounding boxes of its opaque islands (cached on the image). */
export function sheetSprites(img) {
  if (img.sprites) return img.sprites;
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, img.width, img.height).data;
  const seen = new Uint8Array(img.width * img.height);
  const sprites = [];
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || a[i * 4 + 3] === 0) continue;
    // Flood-fill this island and take its box.
    let x0 = img.width;
    let y0 = img.height;
    let x1 = 0;
    let y1 = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const x = j % img.width;
      const y = Math.floor(j / img.width);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const k of [j - 1, j + 1, j - img.width, j + img.width]) {
        if (k < 0 || k >= seen.length || seen[k] || a[k * 4 + 3] === 0) continue;
        if (Math.abs((k % img.width) - x) > 1) continue;
        seen[k] = 1;
        stack.push(k);
      }
    }
    if (x1 - x0 > 3 && y1 - y0 > 2) sprites.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  img.sprites = sprites;
  return sprites;
}

/** Clouds from a sheet, spread across the sky without piling on top of each other. */
/**
 * The layer's clouds from the sheet, scattered by seed. `weather` (render/weather-look.js) changes how many
 * (a cloudy day's pile up and overlap) and greys them.
 */
export function scatterClouds(ctx, sheet, layer, seed, weather = null) {
  const sprites = sheetSprites(sheet);
  if (!sprites.length) return;
  const count = Math.round(layer.count * (weather?.count ?? 1));
  const overlap = (weather?.count ?? 1) > 2;
  let target = ctx;
  if (weather?.amount) {
    target = document.createElement("canvas").getContext("2d");
    target.canvas.width = W;
    target.canvas.height = H;
  }
  const placed = [];
  for (let i = 0, tries = 0; placed.length < count && tries < 300; tries++, i++) {
    const s = sprites[Math.floor(hash(i, 1, seed) * sprites.length)];
    const x = Math.round(hash(i, 2, seed) * (W + s.w) - s.w);
    const y = Math.round(layer.top + hash(i, 3, seed) * Math.max(0, layer.bottom - layer.top - s.h));
    const clash = placed.some((p) => x < p.x + p.w + 8 && x + s.w + 8 > p.x && y < p.y + p.h && y + s.h > p.y);
    if (clash && !overlap) continue;
    placed.push({ x, y, w: s.w, h: s.h });
    target.drawImage(sheet, s.x, s.y, s.w, s.h, x, y, s.w, s.h);
  }
  if (target === ctx) return;
  // Greyed for the weather, then laid on the sky.
  target.globalCompositeOperation = "source-atop";
  target.globalAlpha = weather.amount;
  target.fillStyle = weather.colour;
  target.fillRect(0, 0, W, H);
  ctx.drawImage(target.canvas, 0, 0);
}

/** Is a distance down the ground in a light stripe? `edges` are where light and dark swap. */
export function lightStripe(stripes, z) {
  let band = 0;
  for (const e of stripes.edges) if (z >= e) band++;
  // Band 1 lies between the first and second edges.
  return (band % 2 === 1) === stripes.firstLight;
}

/** The pitch's colours for its type and wear. */
export function pitchColours(pitch) {
  const look = PITCH_LOOKS[pitch.type.id] ?? PITCH_LOOKS.green;
  const wear = clamp(pitch.wear * 1.6, 0, 0.75);
  return { look, base: mix(rgb(look.base), rgb(look.worn), wear), speck: rgb(look.speck) };
}

/** Seeded crack lines across the pitch, in world coordinates. */
export function cracks(count, seed) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let x = (hash(i, 1, seed) - 0.5) * 2.4;
    let z = 1 + hash(i, 2, seed) * (PITCH_LENGTH - 2);
    let a = hash(i, 3, seed) * Math.PI * 2;
    const line = [{ x, z }];
    const steps = 4 + Math.floor(hash(i, 4, seed) * 5);
    for (let s = 0; s < steps; s++) {
      a += (hash(i, 10 + s, seed) - 0.5) * 1.6;
      x = clamp(x + Math.cos(a) * 0.12, -PITCH_HALF + 0.05, PITCH_HALF - 0.05);
      z += Math.sin(a) * 0.35;
      line.push({ x, z });
    }
    out.push(line);
  }
  return out;
}

// --- Close view ------------------------------------------------------------
