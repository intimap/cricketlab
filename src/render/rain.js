import { WIDTH, HEIGHT, fillRect, fillPolygon } from "../engine/screen.js";

/**
 * Rain on screen: drops falling at a slant across the picture, and the covers over the pitch while play is
 * stopped. Positions come from the time and a fixed hash (no dice: this is only the picture).
 */

const DROPS = 150;
const DROP = "rgba(196,212,228,0.55)";
const COVER = "#dde2e5";
const COVER_SEAM = "#aab3b9";

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Drops falling across the whole frame at `now` (seconds). */
export function drawRain(now) {
  for (let i = 0; i < DROPS; i++) {
    const speed = 260 + hash(i + 7) * 160;
    const y = ((hash(i + 99) * (HEIGHT + 40) + now * speed) % (HEIGHT + 40)) - 20;
    // Blown a little to the left as they fall.
    const x = (((hash(i) * (WIDTH + 60) - (now * speed) / 4) % (WIDTH + 60)) + WIDTH + 60) % (WIDTH + 60);
    for (let k = 0; k < 4; k++) fillRect(x - k, y + k * 2, 1, 2, DROP);
  }
}

/** The covers on the pitch, through `project` (x, y, z metres to the screen): a pale sheet with its seams. */
export function drawCovers(project) {
  const corner = (x, z) => project(x, 0.03, z);
  const strip = (z0, z1, colour) => fillPolygon([corner(-1.8, z0), corner(1.8, z0), corner(1.8, z1), corner(-1.8, z1)], colour);
  strip(-0.4, 21.4, COVER);
  for (let z = 2.5; z < 21; z += 3.2) strip(z, z + 0.18, COVER_SEAM);
}
