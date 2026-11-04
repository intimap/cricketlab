import { makePicture, drawGround, putPixel, FLAG, LAYER } from "./venue-raster.js";
import { closeCamera, tvCamera, TV } from "./venue-cameras.js";
import { partsWork } from "./venue-parts.js";
import { groundShade, closeOutfield, drawStumps } from "./venue-field.js";
import { relight, castersOf, shadowTest, sunOf, lightingFor } from "./venue-light.js";
import { polar } from "./venue-map.js";
import { frame } from "./venue-geometry.js";
import { paintCloseField } from "../ground.js";
import { CLOSE_CAMERA, closeRowDepth } from "../camera.js";
import { paintedLayer } from "./venue-paint-over.js";
import { skyPixels, paintLampGlow } from "./venue-sky.js";

/**
 * A ground built from its map (venue-map.js): the pictures each view needs, drawn through the cameras,
 * relit for the light and cached, so changing ends or the time of day doesn't draw anything twice.
 *
 *   close   the close camera looking at one end (0 or 1), in the background's own rows (drawn 24 px up)
 *   wide    the TV camera's whole-ground frame at 2x the detail, for the bowling end
 *   near    the middle of that frame at 3x, for zooming in on the square (HI_REGION)
 *
 * Drawing is in two steps: the scenery (parts and the ground past the fence) once per view and end, then
 * the field (which wears) painted in; and each light relights a copy. All of it can be done a slice at a
 * time (work(), a few milliseconds a frame), and while a view is redrawn for a new light or a worn pitch
 * the last one stays up, so nothing stalls the game.
 */

/** The part of the whole-ground frame drawn at 3x for close zooms (px of the 640 x 360 frame). */
export const HI_REGION = Object.freeze({ x: 130, y: 104, w: 380, h: 192 });

const pictures = new Map();
const lit = new Map();
const latest = new Map();
const jobs = new Map();
const lightIds = new Map();
const warmed = new WeakSet();
/** Pixels drawn or relit between pauses: rows of the picture, fewer for the bigger ones. */
const SLICE = 24000;
const rowsOf = (w) => Math.max(8, Math.floor(SLICE / w));

const cameraFor = (view, end) =>
  view === "close" ? closeCamera(end) : view === "wide" ? tvCamera(end, 2) : tvCamera(end, 3, HI_REGION);

/** The scenery for a view and end, drawn once (and kept): { pic, done, work }. */
function scenery(map, view, end, ballKind) {
  const key = `${map.name}:${view}:${end}:${ballKind}`;
  if (!pictures.has(key)) {
    const pic = makePicture(cameraFor(view, end));
    pic.pitchKey = null;
    const entry = { pic, done: false };
    entry.work = (function* () {
      yield* partsWork(pic, map, { ballKind });
      if (view !== "close") drawStumps(pic);
      const shade = groundShade(map, null, { field: false });
      const rows = rowsOf(pic.w);
      for (let y = 0; y < pic.h; y += rows) {
        drawGround(pic, shade, 0, { x0: 0, x1: pic.w - 1, y0: y, y1: Math.min(pic.h - 1, y + rows - 1) });
        yield;
      }
      entry.done = true;
    })();
    pictures.set(key, entry);
  }
  return pictures.get(key);
}

/** The field painted into a picture for the pitch as it is, a slice at a time (only when it's worn since). */
function* fieldWork(pic, map, ground, pitch, view, end) {
  const key = `${pitch.type.id}:${pitch.wear.toFixed(3)}`;
  if (pic.pitchKey === key) return;
  // Clear the old field.
  for (let i = 0; i < pic.w * pic.h; i++) {
    if (!(pic.flags[i] & FLAG.field)) continue;
    pic.depth[i] = Infinity;
    pic.rgba[i * 4 + 3] = 0;
    pic.flags[i] = 0;
  }
  yield "clear field";
  if (view === "close") yield* paintCloseFieldInto(pic, map, ground, pitch, end);
  else {
    const shade = groundShade(map, pitch);
    const rows = rowsOf(pic.w);
    for (let y = 0; y < pic.h; y += rows) {
      drawGround(pic, shade, 0, { x0: 0, x1: pic.w - 1, y0: y, y1: Math.min(pic.h - 1, y + rows - 1) });
      yield "field";
    }
  }
  pic.pitchKey = key;
}

/** The close view's own field (ground.js, through its widened camera) into the picture where it's clear. */
function* paintCloseFieldInto(pic, map, ground, pitch, far) {
  const c = CLOSE_CAMERA;
  const up = { x: 0, y: 1, z: 0 };
  const flags = FLAG.field | FLAG.shadowed;
  const put = (x, y, colour) => {
    if (x < 0 || y < 0 || x >= pic.w || y >= pic.h) return;
    const i = y * pic.w + x;
    if (pic.depth[i] < Infinity && !(pic.flags[i] & FLAG.field)) return;
    // Its depth along the camera (the ground this row sees), so the shadows find the right spot.
    const depth = closeRowDepth(y + 0.5 - 24) + c.cameraZ;
    pic.depth[i] = Infinity;
    putPixel(pic, x, y, depth, colour, up, LAYER.field, flags);
  };
  const px = {
    put: (x, y, colour) => put(Math.round(x), Math.round(y), colour),
    blend: (x, y, colour, t) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= pic.w || y >= pic.h) return;
      const j = (y * pic.w + x) * 4;
      if (pic.rgba[j + 3] === 0) return;
      put(
        x,
        y,
        [0, 1, 2].map((k) => pic.rgba[j + k] + (colour[k] - pic.rgba[j + k]) * t),
      );
    },
  };
  const outfield = closeOutfield(map);
  const s = far === 0 ? 1 : -1;
  const fx = c.lateralGain * 0.95;
  const grass = (y, z) => {
    const d = z + c.cameraZ;
    const footZ = (d * d) / c.depthGain;
    // The ground under each pixel, in the map (the stumps' widening doesn't reach this far out).
    return (x) => outfield(((x + 0.5 - 320) / fx) * d * s, (z - 10.06) * s, d / fx, footZ, x, y);
  };
  const from = Math.floor(c.horizonY + c.depthGain / (map.fence.radius + 10.06 + c.cameraZ)) - 1;
  const rows = rowsOf(pic.w);
  for (let y = from; y < pic.h; y += rows) {
    paintCloseField(px, ground, pitch, 1, { groundFrom: y, to: Math.min(pic.h - 1, y + rows - 1), grass, marks: false });
    yield "close field";
  }
  paintCloseField(px, ground, pitch, 1, { groundFrom: pic.h, grass, marks: true });
}

/** A stable id for a light object (weatherLight makes each once). */
function lightId(look) {
  if (!lightIds.has(look)) lightIds.set(look, lightIds.size + 1);
  return lightIds.get(look);
}

/**
 * Each view and end's two canvases and their pixels, made once (making a big canvas is slow): one is on
 * screen while the other is drawn for the next light or pitch, then they swap.
 */
const slots = new Map();
function slot(slotKey, w, h) {
  if (!slots.has(slotKey)) slots.set(slotKey, { buffers: [], showing: null });
  const s = slots.get(slotKey);
  return { s, make: () => s.buffers.length < 2 && s.buffers.push(newBuffer(w, h)) };
}
function newBuffer(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  return { canvas, g, image: g.createImageData(w, h) };
}
/** The buffer not on screen, its old picture forgotten. */
function takeBuffer(slotKey, w, h) {
  const { s, make } = slot(slotKey, w, h);
  while (s.buffers.length < 2) make();
  const b = s.buffers.find((x) => x.canvas !== s.showing);
  for (const [key, canvas] of lit) if (canvas === b.canvas) lit.delete(key);
  return b;
}

/** The picture relit for `look` as a canvas, a slice at a time: the scenery, the field, the light. */
function* litWork(map, ground, images, pitch, look, view, end, ballKind, key) {
  const entry = scenery(map, view, end, ballKind);
  while (!entry.done) {
    entry.work.next();
    yield "scenery";
  }
  const pic = entry.pic;
  yield* fieldWork(pic, map, ground, pitch, view, end);
  const slotKey = `${map.name}:${view}:${end}:${ballKind}`;
  const { canvas, g, image } = takeBuffer(slotKey, pic.w, pic.h);
  yield "canvas";
  const horizon = view === "close" ? Math.round(CLOSE_CAMERA.horizonY) : Math.round(pic.h * 0.1);
  const sky = skyPixels(pic.w, horizon, look, images, view === "close" ? { count: 5, top: 25, bottom: 60 } : null);
  const shadows = shadowTest(castersOf(map), sunOf(look));
  // Far things fade a little towards the sky: past the fence for the close view, the far side for the wide.
  const haze = { from: view === "close" ? 95 : TV.distance, per: 1 / (view === "close" ? 420 : 700), most: 0.32 };
  yield "sky";
  const rows = rowsOf(pic.w);
  for (let y = 0; y < pic.h; y += rows) {
    relight(pic, image, look, shadows, haze, y, Math.min(pic.h - 1, y + rows - 1), sky);
    yield "relight";
  }
  // Onto the canvas a strip at a time.
  for (let y = 0; y < pic.h; y += rows * 4) {
    g.putImageData(image, 0, 0, 0, y, pic.w, Math.min(rows * 4, pic.h - y));
    yield "put";
  }
  for (const painted of paintedLayer(map, images, view, end)) g.drawImage(painted, 0, 0);
  if (lightingFor(look).night) paintLampGlow(g, pic, map);
  lit.set(key, canvas);
  latest.set(slotKey, canvas);
  slots.get(slotKey).showing = canvas;
  return canvas;
}

/** Set to an array to have each slice's label (what it yielded) and time pushed onto it (the tools). */
export const VENUE_TIMES = { log: null };

/** Run a job until it's done or `until` (performance.now()) passes; its canvas, or null if not done yet. */
function step(key, start, until) {
  const job = jobs.get(key) ?? start();
  jobs.set(key, job);
  for (;;) {
    const t0 = VENUE_TIMES.log ? performance.now() : 0;
    const r = job.next();
    if (VENUE_TIMES.log) VENUE_TIMES.log.push([r.value ?? "?", performance.now() - t0]);
    if (r.done) {
      jobs.delete(key);
      return r.value ?? lit.get(key);
    }
    if (performance.now() >= until) return null;
  }
}

/**
 * The scoreboard's face in a view and end: { x, y, w, h } in the picture's whole-frame px (the close
 * view's screen rows; the wide view's 640 x 360 frame), or null when it faces away or is out of shot.
 */
function boardRect(map, view, end) {
  const part = map.parts.find((p) => p.kind === "scoreboard");
  if (!part) return null;
  const cam = view === "close" ? closeCamera(end) : tvCamera(end, 1);
  const c = polar(part.bearing, part.radius);
  const f = frame(c, (part.bearing + 180) % 360);
  const toEye = { x: cam.eye.x - c.x, z: cam.eye.z - c.z };
  if (toEye.x * f.front.x + toEye.z * f.front.z <= 0) return null;
  const pts = [];
  for (const across of [-part.width / 2 + 1, part.width / 2 - 1])
    for (const up of [1.6, 6.2]) {
      const q = f.point(across, -0.02);
      const p = cam.project({ x: q.x, y: part.base + up, z: q.z });
      if (!p) return null;
      pts.push(p);
    }
  const x0 = Math.min(...pts.map((p) => p.x));
  const x1 = Math.max(...pts.map((p) => p.x));
  const y0 = Math.min(...pts.map((p) => p.y)) - (view === "close" ? 24 : 0);
  const y1 = Math.max(...pts.map((p) => p.y)) - (view === "close" ? 24 : 0);
  if (x1 < 0 || x0 > 640 || y1 < 0 || y0 > 360) return null;
  return { x: Math.round(x0) + 1, y: Math.round(y0) + 1, w: Math.round(x1 - x0) - 1, h: Math.round(y1 - y0) - 1 };
}

/**
 * A venue ground's art for the match scene, drawn as each view and end is first needed:
 *   closeFor(far)        the close view's canvas looking at end `far` (drawn 24 px up, like the paintings)
 *   wideFor(end)         the TV camera's whole-ground frame at 2x, for the bowling end
 *   nearFor(end)         the middle of it at 3x (HI_REGION), or null until it's been drawn
 *   work(ms, wants)      draw a slice of the views in `wants` ([view, end] pairs, most wanted first)
 *   board(view, end)     the scoreboard's face for the live score, or null
 * A view asked for before it's drawn for this light and pitch shows the last one drawn, or (the very first
 * time) is drawn there and then.
 */
export function venueGround(ground, images, pitch, look, { ballKind = "white" } = {}) {
  const map = ground.venue;
  const keyOf = (view, end) =>
    `${map.name}:${view}:${end}:${ballKind}:${pitch.type.id}:${pitch.wear.toFixed(3)}:${lightId(look)}`;
  const start = (view, end, key) => () => litWork(map, ground, images, pitch, look, view, end, ballKind, key);
  const get = (view, end, wait = true) => {
    const key = keyOf(view, end);
    if (lit.has(key)) return lit.get(key);
    const stale = latest.get(`${map.name}:${view}:${end}:${ballKind}`);
    if (stale) return stale;
    return wait ? step(key, start(view, end, key), Infinity) : null;
  };
  return {
    venue: true,
    closeFor: (far) => get("close", far),
    wideFor: (end) => get("wide", end),
    nearFor: (end) => get("near", end, false),
    work(ms, wants) {
      const until = performance.now() + ms;
      for (const [view, end] of wants) {
        const key = keyOf(view, end);
        if (lit.has(key)) continue;
        if (!step(key, start(view, end, key), until)) return;
      }
    },
    ready: (view, end) => lit.has(keyOf(view, end)),
    board: (view, end) => boardRect(map, view, end),
  };
}

/**
 * Draw a venue's scenery ahead, `ms` of it at a time (the menu does it while the teams are picked), so a
 * match starting there only has to paint the field and light it. The ball decides the sightscreens.
 */
export function prepareVenue(ground, ballKind, ms) {
  if (!ground?.venue) return true;
  const until = performance.now() + ms;
  for (const view of ["close", "wide", "near"])
    for (const end of [0, 1]) {
      const entry = scenery(ground.venue, view, end, ballKind);
      while (!entry.done) {
        entry.work.next();
        if (performance.now() >= until) return false;
      }
      // Its canvases too, one at a time.
      const { s, make } = slot(`${ground.venue.name}:${view}:${end}:${ballKind}`, entry.pic.w, entry.pic.h);
      while (s.buffers.length < 2) {
        make();
        if (performance.now() >= until) return false;
      }
    }
  if (!warmed.has(ground.venue)) {
    // A few rows of the field and the light, so their code is warmed up for the match's first picture.
    warmed.add(ground.venue);
    const pic = scenery(ground.venue, "close", 0, ballKind).pic;
    const sink = { data: new Uint8ClampedArray(pic.w * pic.h * 4) };
    relight(pic, sink, { hd: {} }, () => false, null, 100, 140, null);
    const grass = () => () => [0, 0, 0];
    paintCloseField({ put() {}, blend() {} }, ground, { type: { id: "green" }, wear: 0 }, 1, {
      groundFrom: 200,
      to: 240,
      grass,
      marks: false,
    });
  }
  return true;
}

/** The drawn (not yet relit) pictures, for the tools: the ground sheet and the paint-over templates. */
export function venuePicture(map, ground, pitch, view, end, ballKind = "white") {
  const entry = scenery(map, view, end, ballKind);
  while (!entry.done) entry.work.next();
  for (const _ of fieldWork(entry.pic, map, ground, pitch, view, end));
  return entry.pic;
}

/** Forget every drawn picture (the tools, after changing a map). */
export function clearVenueCache() {
  pictures.clear();
  lit.clear();
  latest.clear();
  jobs.clear();
  slots.clear();
}
