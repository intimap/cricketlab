// Grounds built from a map (render/venue/): the cameras agree with the game's, things land where the map
// puts them in every view, the views turn with the bowling, and it's quick enough to draw.
import test from "node:test";
import assert from "node:assert/strict";
import { projectFromStriker, closeRowDepth, CLOSE_CAMERA } from "../src/render/camera.js";
import { MID_PITCH, BOUNDARY } from "../src/sim/geometry.js";
import { closeCamera, tvCamera, tvWideCamera } from "../src/render/venue/venue-cameras.js";
import { mapToWorld, worldToMap, bowlingEndOf, polar, fingerprint } from "../src/render/venue/venue-map.js";
import { PARKLANDS_MAP } from "../src/render/venue/parklands-map.js";
import { venuePicture, clearVenueCache } from "../src/render/venue/venue-build.js";
import { LAYER } from "../src/render/venue/venue-raster.js";
import { turnLight, sunOf } from "../src/render/venue/venue-light.js";
import { PART_KINDS } from "../src/render/venue/venue-parts.js";
import { PAL } from "../src/render/venue/venue-materials.js";
import { GROUNDS } from "../src/render/grounds.js";
import { LIGHTS } from "../src/render/light.js";

const ground = GROUNDS.parklandsNew;
const pitch = { type: { id: "green" }, wear: 0, roughPatches: [] };
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const pixel = (pic, x, y) => Array.from(pic.rgba.slice((y * pic.w + x) * 4, (y * pic.w + x) * 4 + 3));

test("the close camera draws scenery where the game's close camera puts it", () => {
  for (const far of [0, 1]) {
    const cam = closeCamera(far);
    // Scenery starts past the rope; the game widens the stumps by 9 cm either side, under a pixel out there.
    for (const [x, y, depth] of [
      [5, 0, 82],
      [-20, 3, 80],
      [30, 8, 120],
      [-12, 1, 76],
    ]) {
      // A point `depth` m from the camera's stumps, x to its right: the game's projection, in its own rows.
      const game = projectFromStriker(x, y, depth);
      const map = far === 0 ? { x, y, z: depth - MID_PITCH } : { x: -x, y, z: MID_PITCH - depth };
      const p = cam.project(map);
      assert.ok(Math.abs(p.x - game.x) < 1.2, `far ${far}: x ${p.x} vs ${game.x}`);
      assert.ok(Math.abs(p.y - 24 - game.y) < 0.01, `far ${far}: y ${p.y - 24} vs ${game.y}`);
    }
  }
});

test("the rope is at true distance in the close view: about row 72 on screen", () => {
  const ropeRow = CLOSE_CAMERA.horizonY + CLOSE_CAMERA.depthGain / (MID_PITCH + BOUNDARY + CLOSE_CAMERA.cameraZ) - 24;
  assert.ok(Math.abs(ropeRow - 71.8) < 0.5);
  clearVenueCache();
  for (const far of [0, 1]) {
    const pic = venuePicture(PARKLANDS_MAP, ground, pitch, "close", far);
    // Down a column clear of the sightscreen: the rope's colour, at the row the camera gives.
    let found = -1;
    for (let y = 80; y < 110; y++) if (same(pixel(pic, 160, y), [244, 240, 214])) found = y;
    const expect =
      CLOSE_CAMERA.horizonY +
      CLOSE_CAMERA.depthGain / (Math.sqrt(66 ** 2 - (((160.5 - 320) / 836) * 84) ** 2) + MID_PITCH + CLOSE_CAMERA.cameraZ);
    assert.ok(found > 0 && Math.abs(found - expect) <= 1.5, `far ${far}: rope at row ${found}, camera says ${expect.toFixed(1)}`);
    // The fence's foot just above it: field below the fence, scenery above.
    const fenceRow = Math.round(CLOSE_CAMERA.horizonY + CLOSE_CAMERA.depthGain / (72 + MID_PITCH + CLOSE_CAMERA.cameraZ));
    assert.equal(pic.layer[(fenceRow + 2) * pic.w + 160], LAYER.field);
    assert.notEqual(pic.layer[(fenceRow - 3) * pic.w + 160], LAYER.field);
    assert.ok(closeRowDepth(fenceRow + 2 - 24) < 72 + MID_PITCH);
  }
});

test("the sightscreen stands straight behind the bowler's stumps at both ends", () => {
  for (const far of [0, 1]) {
    const pic = venuePicture(PARKLANDS_MAP, ground, pitch, "close", far, "white");
    const row = 88;
    const cols = [];
    for (let x = 0; x < pic.w; x++) if (same(pixel(pic, x, row), PAL.screenBlack)) cols.push(x);
    const middle = (cols[0] + cols[cols.length - 1]) / 2;
    assert.ok(cols.length > 80, `far ${far}: ${cols.length} px of screen`);
    assert.ok(Math.abs(middle - 320) < 3, `far ${far}: screen centred at ${middle}`);
  }
  // White for the red ball.
  const red = venuePicture(PARKLANDS_MAP, ground, pitch, "close", 0, "red");
  assert.ok(same(pixel(red, 320, 88), PAL.screenWhite) || same(pixel(red, 321, 88), PAL.screenWhite));
});

test("each end shows its own end of the ground", () => {
  const count = (pic, colour) => {
    let n = 0;
    for (let i = 0; i < pic.w * pic.h; i++) if (same(pic.rgba.slice(i * 4, i * 4 + 3), colour)) n++;
    return n;
  };
  const pavilion = venuePicture(PARKLANDS_MAP, ground, pitch, "close", 0);
  const scoreboard = venuePicture(PARKLANDS_MAP, ground, pitch, "close", 1);
  // The pavilion's clock face, the scoreboard's board.
  assert.ok(count(pavilion, PAL.clockFace) > 10 && count(scoreboard, PAL.clockFace) === 0);
  assert.ok(count(scoreboard, PAL.board) > 400 && count(pavilion, PAL.board) === 0);
});

test("the map turns with the bowling end each over", () => {
  assert.deepEqual([0, 1, 2, 3].map(bowlingEndOf), [0, 1, 0, 1]);
  for (const end of [0, 1]) {
    const w = mapToWorld(12, 30, end);
    assert.deepEqual(worldToMap(w.x, w.z, end), { x: 12, z: 30 });
  }
  // The pavilion is behind the bowler's stumps (world z beyond 20.12) when he bowls from end 0.
  assert.ok(mapToWorld(0, 100, 0).z > 20.12 && mapToWorld(0, 100, 1).z < 0);
  // The players' shadows turn with the world; the sun stays fixed to the ground.
  const cast = LIGHTS.evening.hd.casts[0];
  assert.deepEqual(turnLight(LIGHTS.evening, 1).hd.casts[0], { ...cast, x: -cast.x, z: -cast.z });
  assert.equal(turnLight(LIGHTS.evening, 0), LIGHTS.evening);
  assert.ok(sunOf(LIGHTS.evening).dir.z > 0, "the evening sun is over the pavilion end");
});

test("the wide TV camera: true perspective, the whole ground in shot, field placing round-trips", () => {
  const cam = tvWideCamera();
  const near = cam.project(0, 0, MID_PITCH - BOUNDARY);
  const far = cam.project(0, 0, MID_PITCH + BOUNDARY);
  const middle = cam.project(0, 0, MID_PITCH);
  const ratio = (middle.y - far.y) / (near.y - middle.y);
  assert.ok(ratio > 0.85 && ratio < 0.95, `far rope ${ratio.toFixed(2)} the size of the near`);
  assert.ok(near.y < 300, "the near rope clears the score bar");
  for (let deg = 0; deg < 360; deg += 5) {
    const p = polar(deg, BOUNDARY);
    const s = cam.project(p.x, 0, p.z + MID_PITCH);
    assert.ok(s.x > 40 && s.x < 600 && s.y > 100 && s.y < 300, `rope at ${deg} in shot`);
    const q = cam.unproject(s.x, s.y);
    assert.ok(Math.hypot(q.x - p.x, q.z - (p.z + MID_PITCH)) < 0.01);
  }
  // The stands round the sides are in shot at the whole-ground frame.
  for (const part of PARKLANDS_MAP.parts.filter((p) => p.kind === "stand" || p.kind === "bank")) {
    const b = part.bearing ?? part.from + ((part.to - part.from + 360) % 360) / 2;
    const front = polar(b, part.radius ?? part.r0);
    const w = mapToWorld(front.x, front.z, 0);
    const s = cam.project(w.x, 0, w.z);
    assert.ok(s.x > 0 && s.x < 640, `${part.kind} at ${b} in shot (${s.x.toFixed(0)})`);
  }
  // The map's camera is the game's: the same point lands in the same place (2x picture, halved).
  const pic = tvCamera(0, 2);
  const g = cam.project(20, 4, MID_PITCH + 30);
  const m = pic.project({ x: 20, y: 4, z: 30 });
  assert.ok(Math.abs(m.x / 2 - g.x) < 1e-6 && Math.abs(m.y / 2 - g.y) < 1e-6);
});

test("the map: every part is a kind the kit draws; the fingerprint changes with the layout", () => {
  for (const p of PARKLANDS_MAP.parts) assert.ok(PART_KINDS.includes(p.kind), p.kind);
  const a = fingerprint(PARKLANDS_MAP, { close: CLOSE_CAMERA });
  const moved = { ...PARKLANDS_MAP, parts: PARKLANDS_MAP.parts.map((p, i) => (i === 0 ? { ...p, radius: p.radius + 1 } : p)) };
  assert.notEqual(fingerprint(moved, { close: CLOSE_CAMERA }), a);
  assert.equal(fingerprint({ ...PARKLANDS_MAP, name: "ELSEWHERE" }, { close: CLOSE_CAMERA }), a);
});

test("drawing a close view is quick (a guard against it getting slow)", () => {
  clearVenueCache();
  venuePicture(PARKLANDS_MAP, ground, pitch, "close", 0);
  clearVenueCache();
  const t0 = performance.now();
  venuePicture(PARKLANDS_MAP, ground, pitch, "close", 1);
  const ms = performance.now() - t0;
  assert.ok(ms < 400, `${ms.toFixed(0)} ms`);
});

test("painting over: a painted layer replaces the drawn colours; one painted for an older map is left out", async () => {
  const { applyPainted, viewFingerprint, staleLayers } = await import("../src/render/venue/venue-paint-over.js");
  const { makePicture, putPixel, LAYER: L } = await import("../src/render/venue/venue-raster.js");
  const pic = makePicture({ ...closeCamera(0), w: 4, h: 1 });
  putPixel(pic, 0, 0, 100, [10, 20, 30], { x: 0, y: 1, z: 0 }, L.buildings);
  // The painted layer: red over the building and over the sky next to it, nothing over the rest.
  const painted = new Uint8ClampedArray([200, 0, 0, 255, 200, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
  const img = { width: 4, height: 1 };
  const map = {
    ...PARKLANDS_MAP,
    painted: { "close-0-buildings": { asset: "x", fingerprint: viewFingerprint(PARKLANDS_MAP, "close") } },
  };
  applyPainted(pic, map, { x: img }, "close", 0, () => painted);
  assert.deepEqual(Array.from(pic.rgba.slice(0, 8)), [200, 0, 0, 255, 200, 0, 0, 255]);
  assert.equal(pic.layer[1], L.buildings, "paint over the sky joins the layer");
  assert.equal(pic.rgba[11], 0, "unpainted pixels stay clear");
  // The map moved since: left out, and the checks say so.
  const moved = { ...map, parts: map.parts.map((p, i) => (i === 0 ? { ...p, radius: p.radius + 2 } : p)) };
  const fresh = makePicture({ ...closeCamera(0), w: 4, h: 1 });
  const warn = console.warn;
  console.warn = () => {};
  applyPainted(fresh, moved, { x: img }, "close", 0, () => painted);
  console.warn = warn;
  assert.equal(fresh.rgba[3], 0);
  assert.equal(staleLayers(moved).length, 1);
  assert.notEqual(viewFingerprint(PARKLANDS_MAP, "close"), viewFingerprint(PARKLANDS_MAP, "wide"));
});

test("the grounds' painted layers exist, fit their maps, and stay under 500 KB a ground", async () => {
  const fs = await import("node:fs");
  const { ASSET_URLS } = await import("../src/assets.js");
  const { staleLayers } = await import("../src/render/venue/venue-paint-over.js");
  for (const [id, g] of Object.entries(GROUNDS)) {
    if (!g.venue) continue;
    assert.deepEqual(staleLayers(g.venue), [], `${id} has stale paint`);
    let bytes = 0;
    for (const [key, entry] of Object.entries(g.venue.painted ?? {})) {
      const url = ASSET_URLS[entry.asset];
      assert.ok(url, `${id} ${key}: ${entry.asset} is listed in src/assets.js`);
      bytes += fs.statSync(url).size;
    }
    assert.ok(bytes <= 500 * 1024, `${id}: ${Math.round(bytes / 1024)} KB of painted layers`);
  }
});

test("signing off: Parklands (new) takes over the old Parklands' id and name, and leaves the menu once", async () => {
  const { signOffParklands } = await import("../src/render/grounds.js");
  const grounds = { ...GROUNDS };
  signOffParklands(grounds);
  assert.equal(grounds.parklands.venue, PARKLANDS_MAP);
  assert.equal(grounds.parklands.name, GROUNDS.parklands.name);
  assert.ok(grounds.parklandsNew.hidden);
  assert.ok(!grounds.parklands.hidden);
  // Until then both are on the menu, and the old one is still the paintings.
  assert.ok(!GROUNDS.parklands.venue && !GROUNDS.parklandsNew.hidden);
});
