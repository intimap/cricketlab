import test from "node:test";
import assert from "node:assert/strict";
import { readSwing, BACK, FULL, DROP, FLICK } from "../src/scenes/bat-stick.js";
import { strokeFor } from "../src/sim/strokes.js";

/** Play a path of stick positions, 60 a second from t0: [x, y] each frame. Returns the shot, if one is played. */
function swing(path, { t0 = 0, armed = true, track = {} } = {}) {
  let shot = null;
  path.forEach(([x, y], i) => {
    shot = readSwing(track, { x, y, t: t0 + i / 60 }, armed) ?? shot;
  });
  return { shot, track };
}
/** A smooth move from one stick position to another over `frames` frames. */
const move = (from, to, frames) =>
  Array.from({ length: frames }, (_, i) => [
    from[0] + ((to[0] - from[0]) * (i + 1)) / frames,
    from[1] + ((to[1] - from[1]) * (i + 1)) / frames,
  ]);
const hold = (at, frames) => Array.from({ length: frames }, () => at);

test("the backswing picks the shot: none a block, part an attack, to the stop the loft, to the side a sweep", () => {
  const block = swing([...hold([0, 0], 5), ...move([0, 0], [0, -1], 8)]).shot;
  assert.equal(block.button, "defend");
  const part = swing([...move([0, 0], [0, 0.6], 8), ...hold([0, 0.6], 10), ...move([0, 0.6], [0, -1], 10)]).shot;
  assert.equal(part.button, "attack");
  const full = swing([...move([0, 0], [0, 1], 8), ...hold([0, 1], 10), ...move([0, 1], [0, -1], 10)]).shot;
  assert.equal(full.button, "loft");
  const sweep = swing([...move([0, 0], [-0.9, 0.2], 8), ...hold([-0.9, 0.2], 10), ...move([-0.9, 0.2], [0, -1], 10)]).shot;
  assert.equal(sweep.button, "improvise");
  assert.equal(sweep.side, -1);
  assert.ok(FULL > BACK);
});

test("the shot is timed from the moment the stick goes forward past the middle", () => {
  const path = [...move([0, 0], [0, 0.7], 6), ...hold([0, 0.7], 30), ...move([0, 0.7], [0, -1], 10)];
  const { shot } = swing(path, { t0: 2 });
  // The frame where y first goes to -0.3 or beyond.
  const frame = path.findIndex(([, y]) => y <= -0.3);
  assert.ok(Math.abs(shot.t - (2 + frame / 60)) < 1e-9);
});

test("a flick forward is power; a firm push isn't", () => {
  const flick = swing([...move([0, 0], [0, 1], 8), ...hold([0, 1], 10), [0, 0.2], [0, -1]]).shot;
  assert.equal(flick.power, true);
  const push = swing([...move([0, 0], [0, 1], 8), ...hold([0, 1], 10), ...move([0, 1], [0, -1], 14)]).shot;
  assert.equal(push.power, false);
  assert.ok(FLICK < 14 / 60);
});

test("pulled back and let go, the bat comes down and nothing is played", () => {
  const { shot, track } = swing([...move([0, 0], [0, 0.8], 6), ...hold([0, 0.8], 10), [0, 0], ...hold([0, 0], 20)]);
  assert.equal(shot, null);
  assert.equal(track.depth, 0, "the backswing is let go");
  assert.ok(20 / 60 > DROP);
  // Then a push forward from the middle is a block, not the attack he'd let go.
  assert.equal(swing(move([0, 0], [0, -1], 8), { t0: 1, track }).shot.button, "defend");
});

test("before the ball's let go a push forward plays nothing; a backswing held through it still counts", () => {
  const track = {};
  assert.equal(swing([...move([0, 0], [0, 0.6], 6), ...move([0, 0.6], [0, -1], 6)], { armed: false, track }).shot, null);
  const held = {};
  swing([...move([0, 0], [0, 1], 6), ...hold([0, 1], 30)], { armed: false, track: held });
  assert.equal(swing([...hold([0, 1], 4), ...move([0, 1], [0, -1], 10)], { t0: 1, track: held }).shot.button, "loft");
});

test("the stick's side says which way an improvised shot goes; without it the feet do", () => {
  const forward = { stride: "forward", across: 0 };
  assert.equal(strokeFor("improvise", forward, null, false, "off").type, "reverseSweep");
  assert.equal(strokeFor("improvise", forward, null, false, "leg").type, "sweep");
  assert.equal(strokeFor("improvise", { stride: "forward", across: 0.2 }).type, "reverseSweep");
  assert.equal(strokeFor("improvise", { stride: "back", across: 0 }, null, false, "off").type, "ramp");
});
