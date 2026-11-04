import { MID_PITCH } from "../../sim/geometry.js";
import { PITCH_HALF, POPPING, POPPING_HALF, RETURN_X, STUMP_HEIGHT, pitchColours, rgb } from "../ground-paint.js";
import { noise } from "./venue-materials.js";
import { FLAG, LAYER } from "./venue-raster.js";
import { box } from "./venue-geometry.js";

/**
 * The ground itself in a map's frame: the outfield's mowing stripes across the pitch, the rope, the
 * fielding circle, the pitch, its worn surround and creases at true size, and beyond the fence a gravel
 * path and rougher grass. The wide view draws all of it through its camera; the close view only what's
 * beyond the fence (its own field is drawn where the game's close camera widens the stumps: ground.js).
 * Lines are held to at least about a pixel wide, from the ground each pixel covers (venue-raster.js).
 */

export const CIRCLE = 30;
const SURROUND = 0.26;
const PITCH_END = MID_PITCH + 1.3;
const ROPE = [244, 240, 214];
const ROPE_SHADE = [204, 204, 176];
const CIRCLE_LINE = [236, 236, 214];

/** Grass with a little grain and the odd lighter blade, into out. */
function grain(out, c, px, py, seed) {
  const h = noise(px, py, seed);
  const j = h < 0.03 ? 15 : h < 0.07 ? -11 : (noise(px + 29, py + 13, seed) - 0.5) * 6;
  out[0] = c[0] + j;
  out[1] = c[1] + j * (h < 0.03 ? 1.1 : 1);
  out[2] = c[2] + j * 0.7;
}

/** How wide a line `half` m either side looks at least: about half the pixel's footprint across it. */
const held = (half, nx, nz, footX, footZ) => Math.max(half, 0.5 * (Math.abs(nx) * footX + Math.abs(nz) * footZ));

/** The outfield's colours for a map, worked out once. */
function outfield(map) {
  const g = map.grass;
  return { light: rgb(g.light), dark: rgb(g.dark), stripe: g.stripe };
}

/**
 * The outfield at map point (x, z) into out: stripes, the rope and the circle. False past the fence.
 * `colours` from outfield(map).
 */
function outfieldInto(out, map, colours, x, z, footX, footZ, px, py) {
  const r = Math.sqrt(x * x + z * z);
  if (r > map.fence.radius) return false;
  const band = Math.floor((z + colours.stripe / 2) / colours.stripe);
  grain(out, band % 2 === 0 ? colours.light : colours.dark, px, py, 1);
  const nx = x / (r || 1);
  const nz = z / (r || 1);
  const rope = held(0.1, nx, nz, footX, footZ);
  const off = Math.abs(r - map.boundary);
  if (off < rope) {
    const c = off < rope * 0.6 || rope > 0.3 ? ROPE : ROPE_SHADE;
    out[0] = c[0];
    out[1] = c[1];
    out[2] = c[2];
  } else if (Math.abs(r - CIRCLE) < held(0.06, nx, nz, footX, footZ)) {
    for (let k = 0; k < 3; k++) out[k] += (CIRCLE_LINE[k] - out[k]) * 0.4;
  }
  return true;
}

/** The close view's grass at map point (x, z), for its own field (ground.js): [r, g, b] or null past the fence. */
export function closeOutfield(map) {
  const colours = outfield(map);
  const out = [0, 0, 0];
  return (x, z, footX, footZ, px, py) => (outfieldInto(out, map, colours, x, z, footX, footZ, px, py) ? out : null);
}

/**
 * The shade for the ground pass (venue-raster.js drawGround) through a camera: `field` false leaves
 * everything inside the fence to the close view's own field.
 */
export function groundShade(map, pitch, { field = true } = {}) {
  const { base: pitchBase, speck } = field ? pitchColours(pitch) : {};
  const surround = rgb("#8aa630");
  const fleck = rgb("#a1a839");
  const edge = rgb("#5a7224");
  const crease = rgb("#efeedd");
  const path = rgb(map.grass.path);
  const beyond = rgb(map.grass.beyond);
  const verge = path.map((v, i) => (v + beyond[i]) / 2);
  const colours = outfield(map);
  const fieldFlags = FLAG.shadowed | FLAG.field;
  return (x, z, footX, footZ, px, py, out) => {
    const r = Math.sqrt(x * x + z * z);
    if (r > map.fence.radius) {
      grain(out, r < map.fence.radius + 0.4 ? verge : r < map.fence.radius + 3.2 ? path : beyond, px, py, 8);
      out[3] = FLAG.shadowed;
      out[4] = LAYER.ground;
      return true;
    }
    if (!field) return false;
    out[3] = fieldFlags;
    out[4] = LAYER.field;
    const ax = Math.abs(x);
    const az = Math.abs(z);
    // Creases at both ends: bowling and popping across, return along.
    if (az <= MID_PITCH + POPPING + footZ && ax <= POPPING_HALF + footX) {
      const across = held(0.025, 0, 1, footX, footZ);
      const along = held(0.025, 1, 0, footX, footZ);
      const pop = MID_PITCH - POPPING;
      if (
        (Math.abs(az - MID_PITCH) < across && ax <= RETURN_X) ||
        (Math.abs(az - pop) < across && ax <= POPPING_HALF) ||
        (Math.abs(ax - RETURN_X) < along && az >= pop && az <= MID_PITCH + POPPING)
      ) {
        out[0] = crease[0];
        out[1] = crease[1];
        out[2] = crease[2];
        return true;
      }
    }
    if (ax < PITCH_HALF && az < PITCH_END) {
      grain(out, noise(px + 5, py + 41, 3) < 0.06 ? speck : pitchBase, px, py, 3);
      return true;
    }
    if (ax < PITCH_HALF + SURROUND && az < PITCH_END + SURROUND * 2) {
      const outer = ax > PITCH_HALF + SURROUND * 0.6 || az > PITCH_END + SURROUND * 1.2;
      grain(out, outer ? edge : noise(px + 17, py + 3, 4) < 0.05 ? fleck : surround, px, py, 4);
      return true;
    }
    return outfieldInto(out, map, colours, x, z, footX, footZ, px, py);
  };
}

/** The two sets of stumps, standing at the ends of the pitch (the wide view; the close view draws its own). */
export function drawStumps(pic) {
  const wood = (u, v) => (v > STUMP_HEIGHT - 0.05 ? [200, 150, 90] : u > 0.15 ? [94, 61, 23] : [154, 106, 44]);
  for (const z of [MID_PITCH, -MID_PITCH]) {
    box(
      pic,
      { x: 0, z },
      z > 0 ? 180 : 0,
      0.23,
      0.04,
      0,
      STUMP_HEIGHT,
      { front: wood, back: wood, sides: wood, top: wood },
      LAYER.field,
    );
  }
}
