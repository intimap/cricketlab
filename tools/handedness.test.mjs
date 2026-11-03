import test from "node:test";
import assert from "node:assert/strict";
import { facingOf, mirrorDelivery } from "../src/sim/handedness.js";
import { bowlingGeometry } from "../src/sim/bowling-side.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";

test("mirroring a delivery twice gives it back", () => {
  const d = {
    release: { x: 0.9, y: 2, z: 18.7, vx: -1 },
    swingAcc: 1.2,
    expectedSwingAcc: 0.8,
    seamKick: -0.3,
    spinKick: 0,
    expectedSpinKick: 0,
    decoySpinKick: 0,
    samples: [{ t: 0, x: 0.9, y: 2, z: 18.7, vx: -1 }],
    pitchedAt: { x: 0.2, z: 6 },
    atCrease: { x: 0.25, y: 0.8, z: 1.22 },
  };
  assert.deepEqual(mirrorDelivery(mirrorDelivery(d)), d);
  assert.equal(mirrorDelivery(d).atCrease.x, -0.25);
});

test("a left-hander faces the same bowler from the world, and sees the ball in his own frame", () => {
  assert.equal(facingOf({ hand: "left" }), -1);
  assert.equal(facingOf({}), 1);
  // Australia open with a left-hander (Kawaga).
  const m = new Match(australia(), england(), "green", 10, new Rng(3), "bowl");
  m.startOver();
  assert.equal(m.facing, -1);
  const intent = { type: m.inn.bowler.p.bowl.repertoire[0], line: 0.3, length: 6.4, effort: "med", wicketSide: "over" };
  const d = m.deliver(intent, 0);
  // Released where the bowler stands in the world; aimed outside the striker's off stump.
  assert.ok(Math.abs(d.release.x * d.facing - bowlingGeometry(m.spinner, "over").releaseX) < 1e-9);
  assert.ok(d.pitchedAt.x > 0.1, `pitched at ${d.pitchedAt.x}`);
});
