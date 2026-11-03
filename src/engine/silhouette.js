import { WIDTH, HEIGHT, ctx, drawInto } from "./screen.js";

/**
 * Cast shadows from sprites: draw a sprite into a scratch canvas, keep only its shape, then lay that shape
 * on the ground with a shear, as low sun or floodlights would. Knows nothing about what the sprite is.
 * Per frame: beginShadows, then takeSilhouette and castSilhouette for each sprite, then endShadows.
 */

/**
 * Scratch canvases, one per sprite slot in a frame, each just big enough for its sprite. (Copying from a
 * canvas snapshots all of it, so one frame-sized scratch redrawn per sprite would copy the whole frame each time.)
 */
const pads = [];

function pad(slot, w, h) {
  let p = pads[slot];
  if (!p || p.canvas.width < w || p.canvas.height < h) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(w, p?.canvas.width ?? 0);
    canvas.height = Math.max(h, p?.canvas.height ?? 0);
    const g = canvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    p = pads[slot] = { canvas, g };
  }
  return p;
}

/**
 * Draw `draw` (which paints at screen coordinates) within `box` ({ x, y, w, h }) into scratch slot `slot`
 * and turn it solid black. Returns the silhouette for castSilhouette; null if it's off screen.
 */
export function takeSilhouette(draw, box, slot = 0) {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const w = Math.min(WIDTH, Math.ceil(box.x + box.w)) - x;
  const h = Math.min(HEIGHT, Math.ceil(box.y + box.h)) - y;
  if (w <= 0 || h <= 0) return null;
  const { canvas, g } = pad(slot, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.save();
  g.beginPath();
  g.rect(0, 0, w, h);
  g.clip();
  g.translate(-x, -y);
  drawInto(g, draw);
  g.restore();
  g.save();
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  g.restore();
  return { canvas, x, y, w, h };
}

/** The shadows of one frame, built at half size and laid over the frame in one go (see beginShadows). */
let layer = null;
let layerCtx = null;

/** Start a frame's shadows: an empty half-size layer. Shadows overlapping in it don't darken twice. */
export function beginShadows() {
  if (!layer) {
    layer = document.createElement("canvas");
    layer.width = WIDTH / 2;
    layer.height = HEIGHT / 2;
    layerCtx = layer.getContext("2d");
    layerCtx.imageSmoothingEnabled = false;
  }
  layerCtx.setTransform(1, 0, 0, 1, 0, 0);
  layerCtx.clearRect(0, 0, layer.width, layer.height);
}

/**
 * Lay the silhouette taken last (`box`) flat on the ground from the sprite's feet at (footX, footY): each
 * pixel `h` above the feet lands (gx * h, gy * h) from them. Goes into the frame's shadow layer.
 */
export function castSilhouette(box, footX, footY, gx, gy) {
  if (!box) return;
  // Half size, then x' = x + gx (footY - y), y' = footY + gy (footY - y): a shear about the feet.
  layerCtx.setTransform(0.5, 0, -0.5 * gx, -0.5 * gy, 0.5 * gx * footY, 0.5 * footY * (1 + gy));
  layerCtx.drawImage(box.canvas, 0, 0, box.w, box.h, box.x, box.y, box.w, box.h);
}

/** Lay the frame's shadows over it at `alpha`, scaled back up (2px to a pixel: they're soft-edged anyway). */
export function endShadows(alpha) {
  if (!layer || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(layer, 0, 0, WIDTH, HEIGHT);
  ctx.restore();
}
