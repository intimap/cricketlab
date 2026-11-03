import { WIDTH, HEIGHT, ctx, drawInto } from "./screen.js";

/**
 * Pixel-art outlines: draw a sprite with a 1px border of one colour round its whole shape, as hand-drawn
 * sprites have, so it reads cleanly against any background. Knows nothing about what the sprite is.
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

/** Draw `draw` (painting at screen coordinates, within `box`) with a 1px `colour` outline round it. */
export function drawOutlined(draw, box, colour) {
  const x = Math.max(0, Math.floor(box.x) - 1);
  const y = Math.max(0, Math.floor(box.y) - 1);
  const w = Math.min(WIDTH, Math.ceil(box.x + box.w) + 1) - x;
  const h = Math.min(HEIGHT, Math.ceil(box.y + box.h) + 1) - y;
  if (w <= 0 || h <= 0) return draw();
  const sprite = pad(0, w, h);
  const edge = pad(1, w, h);
  for (const { g, canvas } of [sprite, edge]) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
  }
  sprite.g.translate(-x, -y);
  drawInto(sprite.g, draw);
  sprite.g.setTransform(1, 0, 0, 1, 0, 0);
  // The outline: the sprite's shape in one colour, laid one pixel out each way, under the sprite.
  edge.g.drawImage(sprite.canvas, 0, 0);
  edge.g.globalCompositeOperation = "source-in";
  edge.g.fillStyle = colour;
  edge.g.fillRect(0, 0, w, h);
  edge.g.globalCompositeOperation = "source-over";
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    ctx.drawImage(edge.canvas, 0, 0, w, h, x + dx, y + dy, w, h);
  }
  ctx.drawImage(sprite.canvas, 0, 0, w, h, x, y, w, h);
}
