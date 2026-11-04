import test from "node:test";
import assert from "node:assert/strict";
import { ballRing } from "../src/scenes/ball-ring.js";

const delivery = (o) => ({
  release: { z: 18.7 },
  speed: 36,
  paceKept: 0.87,
  pitchedAt: { x: 0.2, z: 6 },
  swingAcc: 4,
  seamKick: 0,
  spinKick: 0,
  expectedSwingAcc: 4,
  expectedSpinKick: 0,
  ...o,
});
const scene = (o) => ({
  human: "bat",
  screenTurn: 1,
  inn: { bowler: { p: { bowl: { style: "fast" } } }, striker: 0, bat: [{ eye: 0, p: { bat: { vsPace: 0.6, vsSpin: 0.6 } } }] },
  ...o,
});

test("the ring's colour is the length and its side the movement", () => {
  const ring = ballRing(scene({}), delivery({}));
  assert.equal(ring.length, "gold");
  assert.equal(ring.side, 1);
  assert.equal(ballRing(scene({}), delivery({ pitchedAt: { x: 0, z: 2 } })).length, "purple");
  assert.equal(ballRing(scene({}), delivery({ pitchedAt: { x: 0, z: 10 } })).length, "red");
  assert.equal(ballRing(scene({}), delivery({ swingAcc: 0, expectedSwingAcc: 0 })).side, 0);
  // From the bowler's end (or for a left-hander) the screen is turned round.
  assert.equal(ballRing(scene({ screenTurn: -1 }), delivery({})).side, -1);
});

test("batting, it shows the read: a googly he hasn't picked shows the decoy's turn", () => {
  const googly = delivery({ swingAcc: 0, expectedSwingAcc: 0, spinKick: -1.2, expectedSpinKick: 1.2 });
  assert.equal(ballRing(scene({}), googly).side, 1, "batting: what he reads");
  assert.equal(ballRing(scene({ human: "bowl" }), googly).side, -1, "bowling: what it really does");
});

test("batting, he reads it sooner with his eye in; EASY shows the truth from release, HARD nothing", () => {
  const cold = ballRing(scene({}), delivery({}));
  const set = ballRing(scene({ inn: { ...scene({}).inn, bat: [{ eye: 1, p: { bat: { vsPace: 0.6 } } }] } }), delivery({}));
  assert.ok(set.showAt < cold.showAt);
  assert.equal(ballRing(scene({ assist: "hard" }), delivery({})), null);
  assert.ok(ballRing(scene({ assist: "easy" }), delivery({})).showAt < cold.showAt);
});
