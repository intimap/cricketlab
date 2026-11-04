import { MID_PITCH } from "../../sim/geometry.js";
import { PITCH_HALF, POPPING, POPPING_HALF, RETURN_X, STUMP_HEIGHT, pitchColours, rgb } from "../ground-paint.js";
import { noise } from "./venue-materials.js";
import { FLAG, LAYER } from "./venue-raster.js";
import { box } from "./venue-geometry.js";
import { hash } from "./venue-materials.js";
import { bearingOf, withinBearings } from "./venue-map.js";

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

/** Smooth noise 0..1 over the ground (bilinear between hashed corners), for patches that don't look gridded. */
function smooth(x, z) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(i, j, 3) + (hash(i + 1, j, 3) - hash(i, j, 3)) * sx;
  const b = hash(i, j + 1, 3) + (hash(i + 1, j + 1, 3) - hash(i, j + 1, 3)) * sx;
  return a + (b - a) * sz;
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
  const mown = beyond.map((v, i) => v + [6, 10, 2][i]);
  const rough = beyond.map((v, i) => v - [10, 8, 6][i]);
  const tarmac = [92, 94, 96];
  const line = [214, 214, 200];
  const concrete = [176, 172, 160];
  const colours = outfield(map);
  // The ground's own markings past the fence: paths, the car park, the nets' strips (venue-parts.js).
  const decals = map.parts.filter((p) => p.kind === "path" || p.kind === "carpark" || p.kind === "nets");
  const onDecal = (x, z, r, out, px, py) => {
    const b = bearingOf(x, z);
    for (const d of decals) {
      if (d.kind === "path" && d.bearing !== undefined) {
        // A path straight out from the ground: within its width of the line along its bearing.
        const a = (d.bearing * Math.PI) / 180;
        const along = x * Math.sin(a) + z * Math.cos(a);
        const across = x * Math.cos(a) - z * Math.sin(a);
        if (along > d.r0 && along < d.r1 && Math.abs(across) < d.width / 2) return (grain(out, path, px, py, 8), true);
        continue;
      }
      if (r < d.r0 || r > d.r1 || !withinBearings(b, d.from, d.to)) continue;
      if (d.kind === "path") return (grain(out, path, px, py, 8), true);
      if (d.kind === "nets") return (grain(out, concrete, px, py, 6), true);
      // The car park: tarmac, white lines between the bays.
      const bay = ((b - d.from + 360) % 360) * ((Math.PI * r) / 180);
      const painted = bay % 2.6 < 0.12 && (r - d.r0) % 6 > 1 && (r - d.r0) % 6 < 5.2;
      return (grain(out, painted ? line : tarmac, px, py, 6), true);
    }
    return false;
  };
  const fieldFlags = FLAG.shadowed | FLAG.field;
  return (x, z, footX, footZ, px, py, out) => {
    const r = Math.sqrt(x * x + z * z);
    if (r > map.fence.radius) {
      out[3] = FLAG.shadowed;
      out[4] = LAYER.ground;
      if (r < map.fence.radius + 3.2) return (grain(out, r < map.fence.radius + 0.4 ? verge : path, px, py, 8), true);
      if (onDecal(x, z, r, out, px, py)) return true;
      // Mown and rough patches of grass (the trees' own shadows fall on it from the sun: venue-light.js).
      const patch = smooth(x / 11, z / 11);
      grain(out, patch < 0.32 ? mown : patch > 0.7 ? rough : beyond, px, py, 8);
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
