import { lightingFor } from "./venue-light.js";
import { polar } from "./venue-map.js";
import { frame } from "./venue-geometry.js";
import { hash } from "./venue-materials.js";
import { scatterClouds } from "../ground-paint.js";

/** What goes behind and over a relit picture (venue-build.js): the sky, and the floodlights' glow at night. */

/**
 * The sky behind a picture, as pixels: the look's gradient down to the horizon row, dithered, with stars
 * at night and (the close view) clouds. { data, rows, foot }: `rows` rows of `data`, `foot` below them.
 */
export function skyPixels(w, horizon, look, images, clouds) {
  const L = lightingFor(look);
  const top = [1, 3, 5].map((i) => parseInt(L.sky.top.slice(i, i + 2), 16));
  const foot = [1, 3, 5].map((i) => parseInt(L.sky.foot.slice(i, i + 2), 16));
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const rows = Math.max(1, horizon);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = rows;
  const g = canvas.getContext("2d");
  const img = g.createImageData(w, rows);
  const bands = 7;
  for (let y = 0; y < rows; y++) {
    const t = y / rows;
    for (let x = 0; x < w; x++) {
      const k = Math.min(bands, Math.floor(t * bands + bayer[(y & 3) * 4 + (x & 3)] / 16)) / bands;
      const j = (y * w + x) * 4;
      img.data[j] = top[0] + (foot[0] - top[0]) * k;
      img.data[j + 1] = top[1] + (foot[1] - top[1]) * k;
      img.data[j + 2] = top[2] + (foot[2] - top[2]) * k;
      img.data[j + 3] = 255;
    }
  }
  for (let i = 0; i < L.stars; i++) {
    const j = (Math.floor(hash(i, 2, 77) * rows * 0.7) * w + Math.floor(hash(i, 1, 77) * w)) * 4;
    img.data[j] = img.data[j + 1] = img.data[j + 2] = i % 5 ? 170 : 255;
  }
  g.putImageData(img, 0, 0);
  const glow = look.hd?.glow ?? look.glow;
  if (glow && !look.hd?.sky) {
    const wash = g.createLinearGradient(0, rows * 0.3, 0, rows);
    wash.addColorStop(0, "rgba(255,208,138,0)");
    wash.addColorStop(1, glow.colour);
    g.globalAlpha = glow.amount * 0.6;
    g.fillStyle = wash;
    g.fillRect(0, 0, w, rows);
    g.globalAlpha = 1;
  }
  if (clouds && images["close/clouds"]) scatterClouds(g, images["close/clouds"], clouds, 7, look.clouds);
  return { data: g.getImageData(0, 0, w, rows).data, rows, foot };
}

/** Floodlight glow round each lamp head in the picture (from full effects' bloom, but always on at night). */
export function paintLampGlow(g, pic, map) {
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const p of map.parts) {
    if (p.kind !== "floodlight") continue;
    const f = frame(polar(p.bearing, p.radius), (p.bearing + 180) % 360);
    const head = f.point(0, -0.9);
    const at = pic.cam.project({ x: head.x, y: p.height + 1.3, z: head.z });
    if (!at) continue;
    const size = (8 * pic.cam.fy) / at.depth;
    for (const [radius, alpha] of [
      [size * 1.4, 0.55],
      [size * 5, 0.18],
    ]) {
      const halo = g.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius);
      halo.addColorStop(0, `rgba(255,248,220,${alpha})`);
      halo.addColorStop(1, "rgba(255,248,220,0)");
      g.fillStyle = halo;
      g.fillRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
    }
  }
  g.restore();
}
