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

test("while the ball's in play, the whole wicket stays in shot with the ball or the fielder with it", () => {
  setWideCamera(camera);
  const stumps = [
    { x: 0, z: 0 },
    { x: 0, z: 20.12 },
  ];
  const inShot = (p) => {
    const q = projectWide(p.x, 0, p.z);
    return q.x > 0 && q.x < 640 && q.y > 0 && q.y < 360;
  };
  // The ball out at deep square leg, a fielder there with it in his hands.
  const held = scene({ phase: "flight", cur: inPlay({ x: -55, y: 0, z: 8 }, { x: -55, z: 8 }) });
  held.cur.play.live.ball.held = 0;
  run(held, 2);
  for (const p of [...stumps, { x: -55, z: 8 }]) assert.ok(inShot(p), `(${p.x}, ${p.z}) in shot`);
  // Thrown in from long-on: the thrower and the wicket.
  const thrown = scene({ phase: "flight", cur: inPlay({ x: 20, y: 2, z: 40 }, { x: 30, z: 62 }) });
  thrown.cur.play.live.ball.throwing = { fielder: 0, end: 1 };
  run(thrown, 2);
  for (const p of [...stumps, { x: 30, z: 62 }, { x: 20, z: 40 }]) assert.ok(inShot(p), `(${p.x}, ${p.z}) in shot`);
  setWideCamera();
});

test("the run bar: up from the moment it's played until just after it's dead, the batters along the pitch", async () => {
  const { runBarOf } = await import("../src/scenes/run-bar.js");
  const live = {
    t: 2,
    ball: { throwing: { end: 1 } },
    runners: [
      { bat: 0, progress: 0.4, target: 1, startAt: 1 },
      { bat: 1, progress: 0.6, target: 0, startAt: 1 },
    ],
  };
  const s = { phase: "flight", phaseT: 0, kitBat: { shirt: "#fff", cap: "#123" }, inn: { bat: [{ p: {} }, { p: {} }] } };
  assert.equal(runBarOf({ ...s, cur: { contactDone: false, play: { live } } }), null);
  const bar = runBarOf({ ...s, cur: { contactDone: true, play: { live } } });
  assert.deepEqual(
    bar.runners.map((r) => [r.progress, r.dir]),
    [
      [0.4, 1],
      [0.6, -1],
    ],
  );
  assert.equal(bar.throwTo, 1);
  assert.ok(runBarOf({ ...s, phase: "after", phaseT: 0.5, cur: { contactDone: true, play: { live } } }));
  assert.equal(runBarOf({ ...s, phase: "after", phaseT: 3, cur: { contactDone: true, play: { live } } }), null);
});

test("each new ball starts afresh: the last one's 'dead' doesn't hold the camera out", () => {
  setWideCamera(camera);
  const s = scene({ phase: "flight", cur: inPlay({ x: 5, y: 0.5, z: 12 }, { x: 8, z: 14 }) });
  run(s, 0.5);
  s.cur.play.live.dead = true;
  assert.ok(run(s, 3).zoom < 1.05);
  // The close view in between, then the next ball's played.
  s.view = "close";
  run(s, 1);
  s.cur = inPlay({ x: 5, y: 0.5, z: 12 }, { x: 8, z: 14 });
  s.view = "wide";
  assert.ok(run(s, 1 / 60).zoom > 2);
  setWideCamera();
});
