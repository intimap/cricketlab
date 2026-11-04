import { fingerprint } from "./venue-map.js";
import { CLOSE_CAMERA } from "../camera.js";
import { TV, HI_REGION } from "./venue-cameras.js";
import { LAYER } from "./venue-raster.js";

/**
 * Layers painted over the drawn ones. The template tool (tools/ground-templates.mjs) exports each view's
 * layers as the code draws them, with guides; a painted one goes in assets/ (listed in src/assets.js) and
 * in its map's `painted`:
 *     painted: { "close-0-buildings": { asset: "venues/parklands/close-0-buildings", fingerprint: "1a2b3c4d" } }
 * Its colours then replace the drawn ones before the picture is relit, so it's painted in midday light and
 * gets the evening and night like the rest. It carries the fingerprint of the map and camera it was
 * painted over: if the map has moved since, it no longer fits and is left out (with a warning), and the
 * checks (tools/venue.test.mjs) fail until it's repainted.
 */

/** The layers that can be painted (the field is the game's own), and the views. */
export const PAINTABLE = ["sky", "trees", "ground", "buildings", "crowd", "fence"];
export const VIEWS = ["close", "wide", "near"];

/** A painted layer's key: "close-0-buildings" is the close view looking at end 0, its buildings. */
export const layerKey = (view, end, layer) => `${view}-${end}-${layer}`;

/** The fingerprint a view's templates carry: the map's layout and that view's camera. */
export function viewFingerprint(map, view) {
  return fingerprint(map, view === "close" ? { close: CLOSE_CAMERA } : { tv: TV, region: view === "near" ? HI_REGION : null });
}

/** The painted layers that no longer fit their map: [{ key, painted, now }]. */
export function staleLayers(map) {
  return Object.entries(map.painted ?? {})
    .map(([key, entry]) => ({ key, painted: entry.fingerprint, now: viewFingerprint(map, key.split("-")[0]) }))
    .filter((s) => s.painted !== s.now);
}

const warned = new Set();
const warn = (text) => {
  if (warned.has(text)) return;
  warned.add(text);
  console.warn(text);
};

/** An image's pixels (RGBA), read through a canvas in the browser. */
function browserPixels(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext("2d");
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.width, img.height).data;
}

/**
 * Lay a view and end's painted layers over a drawn picture's daylight colours. Where something's painted
 * over the sky it becomes part of that layer, facing the camera. `pixels(img)` reads an image (the
 * browser's canvas by default).
 */
export function applyPainted(pic, map, images, view, end, pixels = browserPixels) {
  const now = viewFingerprint(map, view);
  for (const [key, entry] of Object.entries(map.painted ?? {})) {
    const [v, e, layer] = key.split("-");
    if (v !== view || Number(e) !== end) continue;
    const img = images?.[entry.asset];
    if (!img) {
      warn(`${map.name}: painted layer ${key} (${entry.asset}) isn't loaded`);
      continue;
    }
    if (entry.fingerprint !== now) {
      warn(`${map.name}: painted layer ${key} was painted for an older map (${entry.fingerprint}, now ${now}): left out`);
      continue;
    }
    if (img.width !== pic.w || img.height !== pic.h) {
      warn(`${map.name}: painted layer ${key} is ${img.width}x${img.height}, the view is ${pic.w}x${pic.h}: left out`);
      continue;
    }
    const data = pixels(img);
    const index = LAYER[layer];
    const f = pic.cam.forward;
    for (let i = 0; i < pic.w * pic.h; i++) {
      const j = i * 4;
      if (data[j + 3] < 128) continue;
      pic.rgba[j] = data[j];
      pic.rgba[j + 1] = data[j + 1];
      pic.rgba[j + 2] = data[j + 2];
      if (pic.rgba[j + 3] === 0) {
        pic.rgba[j + 3] = 255;
        pic.layer[i] = index;
        pic.depth[i] = 1e6;
        pic.normal[i * 3] = -f.x * 127;
        pic.normal[i * 3 + 1] = -f.y * 127;
        pic.normal[i * 3 + 2] = -f.z * 127;
      }
    }
  }
}
