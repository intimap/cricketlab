import { BOUNDARY, MID_PITCH, PITCH_LENGTH } from "../sim/geometry.js";
import { projectStadium, unprojectStadium } from "./stadium-camera.js";
import { PITCH_LOOKS } from "./grounds.js";

/** The single stadium painting surrounds a field rasterised through its camera. */
export function buildStadium(ground, images, pitch, seed) {
  const view = ground.wide;
  const camera = view.camera;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#90b6cf";
  ctx.fillRect(0, 0, 640, 360);
  ctx.drawImage(images[view.stadium], 0, 0, 640, 360);
  const image = ctx.getImageData(0, 0, 640, 360);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const look = PITCH_LOOKS[pitch.type.id] ?? PITCH_LOOKS.green;
  const soil = rgb(look.base), worn = rgb(look.worn);
  const wear = Math.min(0.75, pitch.wear * 1.6);
  const pitchColour = soil.map((c, i) => c + (worn[i] - c) * wear);
  const light = rgb(view.grass.light), dark = rgb(view.grass.dark);
  for (let sy = 0; sy < 360; sy++) for (let sx = 0; sx < 640; sx++) {
    const { x, z } = unprojectStadium(sx + 0.5, sy + 0.5, camera);
    const radius = Math.hypot(x, z - MID_PITCH);
    if (radius > BOUNDARY) continue;
    let colour = Math.floor((z + 100) / 7) % 2 ? light : dark;
    if (radius > BOUNDARY - 0.45) colour = rgb(view.rope.colour);
    if (Math.abs(radius - 30) < 0.16) colour = [116, 159, 100];
    if (Math.abs(x) < 1.85 && z > -1.6 && z < PITCH_LENGTH + 1.6) colour = rgb(ground.surround.colour);
    if (Math.abs(x) < 1.52 && z > -1.3 && z < PITCH_LENGTH + 1.3) colour = pitchColour;
    for (const [end, sign] of [[0, 1], [PITCH_LENGTH, -1]]) {
      if (Math.abs(z - end) < 0.28 && Math.abs(x) < 1.32 ||
          Math.abs(z - (end + sign * 1.22)) < 0.28 && Math.abs(x) < 1.83 ||
          Math.abs(Math.abs(x) - 1.32) < 0.14 && Math.abs(z - end) < 1.22) colour = rgb(ground.crease);
    }
    const noise = ((sx * 13 + sy * 37 + seed * 7) % 11) - 5;
    const i = (sy * 640 + sx) * 4;
    for (let c = 0; c < 3; c++) image.data[i + c] = colour[c] + noise;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ctx.fillStyle = ground.stumps.wood;
  for (const z of [0, PITCH_LENGTH]) {
    const base = projectStadium(0, 0, z, camera), top = projectStadium(0, 0.71, z, camera);
    ctx.fillRect(Math.round(base.x) - 1, Math.round(top.y), 3, Math.max(1, Math.round(base.y - top.y)));
  }
  return canvas;
}
