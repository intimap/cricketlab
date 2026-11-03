import { beginShadows, takeSilhouette, castSilhouette, endShadows } from "../engine/silhouette.js";
import { projectClose, closePixelsPerMetre, closeDepth } from "../render/camera.js";
import { shadowSlope } from "../render/lighting.js";
import { NEAR_PIXELS_PER_METRE } from "./match-positions.js";
import { CREASE } from "../sim/geometry.js";
import { strikerFeet } from "./match-striker.js";

/**
 * The close view's cast shadows: before anyone is drawn, each figure's silhouette laid on the ground the way
 * the look's sun (or floodlights) throws it, so every shadow sits under every figure. A sprite casts when it
 * carries `cast`: { x, z, height } (metres, feet on the ground), or { striker: true }.
 */
export function castShadows(scene, sprites) {
  const casts = scene.light.casts;
  if (!casts?.length) return;
  beginShadows();
  for (const [slot, s] of sprites.entries()) {
    const feet = s.cast && feetOf(scene, s.cast);
    if (!feet) continue;
    const h = feet.heightPx;
    // Room for a bat held out either side; kept tight, as every pixel of it is copied per shadow.
    const box = takeSilhouette(s.draw, { x: feet.x - h * 0.8, y: feet.y - h * 1.12, w: h * 1.6, h: h * 1.2 }, slot);
    for (const cast of casts) {
      const { gx, gy } = shadowSlope(projectClose, feet.worldX, feet.worldZ, feet.heightM, h, cast);
      castSilhouette(box, feet.x, feet.y, gx, gy);
    }
  }
  // One strength for all of a look's shadows: where they overlap they merge, as real shadows do.
  endShadows(Math.max(...casts.map((c) => c.alpha)));
}

/** Feet on screen, height on screen and in life, and where they stand: from a sprite's `cast`. */
function feetOf(scene, cast) {
  if (cast.striker) return { ...strikerFeet(scene), worldZ: CREASE };
  if (cast.screen) return { ...cast.screen, heightM: cast.height, worldX: cast.x, worldZ: cast.z };
  if (closeDepth(cast.z) < -1) return null;
  const p = projectClose(cast.x, 0, cast.z);
  const ppm = Math.min(closePixelsPerMetre(cast.z), NEAR_PIXELS_PER_METRE);
  return { x: p.x, y: p.y, heightPx: cast.height * ppm, heightM: cast.height, worldX: cast.x, worldZ: cast.z };
}
