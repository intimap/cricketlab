// The wide view's TV camera directing itself (scenes/wide-director.js): where it frames for each moment,
// that it eases rather than jumps, keeps the spot under the pointer still while placing the field, and
// never shows past the edge of the whole-ground picture.
import test from "node:test";
import assert from "node:assert/strict";
import { directWide, MAX_ZOOM } from "../src/scenes/wide-director.js";
import { setWideCamera, wideViewNow, unprojectWide, projectWide } from "../src/render/camera.js";
import { mouse } from "../src/engine/input.js";
import { tvWideCamera } from "../src/render/venue/venue-cameras.js";
import { MID_PITCH } from "../src/sim/geometry.js";

const camera = tvWideCamera();

function scene(over = {}) {
  return {
    ground: { wide: { camera } },
    view: "wide",
    phase: "ready",
    cam: "auto",
    now: 0,
    dragIdx: -1,
    inn: { placements: [{ pos: { x: 6, z: -4 } }, { pos: { x: -40, z: 60 } }] },
    ...over,
  };
}

/** A ball in play: the ball where given, the batters running, a fielder going for it. */
function inPlay(ball, fielder) {
  const runners = [{ pos: { x: 0, z: 3 } }, { pos: { x: 0, z: 17 } }];
  return {
    contactDone: true,
    play: {
      live: {
        ball: { pos: ball },
        runners,
        runnerPos: (r) => r.pos,
        fielders: [{ pos: fielder }],
        plan: { fielder: 0 },
        dead: false,
      },
    },
  };
}

/** Run the director for `seconds` at 60 frames a second. */
function run(s, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    s.now += 1 / 60;
    directWide(s, 1 / 60);
  }
  return wideViewNow();
}

const insideFrame = (v) =>
  v.cx - 320 / v.zoom >= -1e-6 &&
  v.cx + 320 / v.zoom <= 640 + 1e-6 &&
  v.cy - 180 / v.zoom >= -1e-6 &&
  v.cy + 180 / v.zoom <= 360 + 1e-6;

test("placing the field: the whole ground, in on the square while a close fielder is held", () => {
  setWideCamera(camera);
  const s = scene({ phase: "fieldEdit" });
  let v = run(s, 0.5);
  assert.equal(v.zoom, 1);
  // Pick up the close fielder with the pointer over him: the camera eases in, and he stays under the pointer.
  const at = projectWide(6, 0, -4);
  mouse.x = at.x;
  mouse.y = at.y;
  s.dragIdx = 0;
  const before = unprojectWide(mouse.x, mouse.y);
  directWide(s, 1 / 60);
  assert.ok(wideViewNow().zoom > 1 && wideViewNow().zoom < 1.2, "eases in rather than jumping");
  v = run(s, 2);
  assert.ok(v.zoom > 2 && v.zoom <= 2.31, `zoom ${v.zoom}`);
  const after = unprojectWide(mouse.x, mouse.y);
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.6, "the spot under the pointer stays put");
  // A deep fielder held: back out.
  s.dragIdx = 1;
  v = run(s, 3);
  assert.ok(v.zoom < 1.05);
  setWideCamera();
});

test("a ball in play: framed close near the square, easing out as it goes to the rope, all of it in shot", () => {
  setWideCamera(camera);
  const near = scene({ phase: "flight", view: "close", cur: inPlay({ x: 5, y: 0.5, z: 12 }, { x: 8, z: 14 }) });
  run(near, 0.1);
  // Cutting to the wide view: straight to the framing, no ease from the whole ground.
  near.view = "wide";
  let v = run(near, 1 / 60);
  assert.ok(v.zoom > 2, `opens close in (${v.zoom.toFixed(2)})`);
  assert.ok(insideFrame(v));
  const close = v.zoom;
  const far = scene({ phase: "flight", cur: inPlay({ x: 50, y: 0.2, z: 60 }, { x: 45, z: 55 }) });
  v = run(far, 2);
  assert.ok(v.zoom < close - 0.25, `out at the rope (${v.zoom.toFixed(2)})`);
  assert.ok(insideFrame(v));
  // The ball, the fielder going for it and both batters all on screen.
  for (const p of [
    { x: 50, z: 60 },
    { x: 45, z: 55 },
    { x: 0, z: 3 },
    { x: 0, z: 17 },
  ]) {
    const q = projectWide(p.x, 0, p.z);
    assert.ok(q.x > 0 && q.x < 640 && q.y > 0 && q.y < 360, `(${p.x}, ${p.z}) in shot at ${q.x.toFixed(0)}, ${q.y.toFixed(0)}`);
  }
  // The ball dead: it holds a moment, then pulls back to the whole ground.
  far.cur.play.live.dead = true;
  const held = run(far, 0.5).zoom;
  assert.ok(Math.abs(held - v.zoom) < 0.15);
  assert.ok(run(far, 3).zoom < 1.02);
  setWideCamera();
});

test("locked to WIDE, the delivery is watched close in on the square", () => {
  setWideCamera(camera);
  const s = scene({ cam: "wide", phase: "runup" });
  const v = run(s, 3);
  assert.ok(Math.abs(v.zoom - MAX_ZOOM) < 0.01);
  const middle = camera.project(0, 0, MID_PITCH);
  assert.ok(Math.abs(v.cx - middle.x) < 1 && Math.abs(v.cy - middle.y) < 1);
  setWideCamera();
});

test("grounds without a TV camera keep their fixed wide view", () => {
  setWideCamera(null);
  const s = scene({ ground: { wide: {} }, phase: "flight", cur: inPlay({ x: 5, y: 0, z: 12 }, { x: 8, z: 14 }) });
  assert.equal(run(s, 1).zoom, 1);
});
