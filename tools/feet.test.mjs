import test from "node:test";
import assert from "node:assert/strict";
import { STRIDES, batRange, batDescent, computerFeet, contactFor, feetOf, padDepth, weightInto } from "../src/sim/feet.js";
import { crossingAtZ } from "../src/sim/delivery.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";

/** Deliveries from the computer's opening bowler at one length (m from the striker's stumps), at the stumps. */
function deliveries(length, count = 60, seed = 11) {
  const m = new Match(australia(), england(), "green", 50, new Rng(seed), "bat");
  m.startOver();
  const out = [];
  for (let i = 0; out.length < count && i < count * 20; i++) {
    const { intent } = m.aiPlan();
    const d = m.deliver({ ...intent, type: "seam", line: 0.05, length }, 0);
    const at = crossingAtZ(d.samples, 1.4);
    if (at && Math.abs(at.x) < 0.25) out.push({ m, d });
  }
  return out;
}

test("the feet set where the bat meets the ball: forward further down, back deeper, the crease between", () => {
  const [{ d }] = deliveries(5.5, 1);
  const at = (stride) => contactFor(d, { stride, across: 0, from: null });
  assert.equal(at("forward").z, STRIDES.forward.z);
  assert.equal(at("back").z, STRIDES.back.z);
  assert.ok(at("forward").at.t < at("crease").at.t && at("crease").at.t < at("back").at.t);
  assert.ok(at("down").at.t < at("forward").at.t);
});

test("a stride started late is caught part of the way, nearer the crease", () => {
  const [{ d }] = deliveries(5.5, 1);
  const inTime = contactFor(d, { stride: "forward", across: 0, from: null });
  const late = contactFor(d, { stride: "forward", across: 0, from: inTime.at.t - 0.1 }, 0.5);
  assert.ok(late.made > 0.3 && late.made < 1, `${late.made}`);
  assert.ok(late.z > STRIDES.crease.z && late.z < STRIDES.forward.z);
  // And going back: still short of the full depth.
  const back = contactFor(d, { stride: "back", across: 0, from: inTime.at.t - 0.05 }, 0.5);
  assert.ok(back.made < 1 && back.z > STRIDES.back.z && back.z < STRIDES.crease.z);
  // Older shots that only say front or back play it in good time.
  assert.deepEqual(feetOf({ type: "cutpull" }, 6), { stride: "back", across: 0, from: null });
});

test("forward the bat can't get over a short one, back it can't get down to one at the toes", () => {
  const [fLo, fHi] = batRange({ stride: "forward" }, 1, "drive", false);
  const [bLo, bHi] = batRange({ stride: "back" }, 1, "drive", false);
  assert.ok(fHi < bHi && fLo < bLo);
  const [cLo, cHi] = batRange({ stride: "crease" }, 1, "drive", false);
  assert.ok(cLo > fLo && cLo < bLo && cHi > fHi && cHi < bHi);
  // Half a stride gets half way.
  const [hLo] = batRange({ stride: "forward" }, 0.5, "drive", false);
  assert.ok(Math.abs(hLo - (cLo + fLo) / 2) < 1e-9);
  // A sweep is down on one knee whatever the feet.
  assert.ok(batRange({ stride: "back" }, 1, "sweep", true)[0] < 0.1);
});

test("the weight goes into a drive off the front foot and a pull off the back", () => {
  assert.ok(weightInto("drive", { stride: "forward" }, 1) > weightInto("drive", { stride: "back" }, 1));
  assert.ok(weightInto("cutpull", { stride: "back" }, 1) > weightInto("cutpull", { stride: "forward" }, 1));
  assert.ok(weightInto("drive", { stride: "crease" }, 1) < weightInto("drive", { stride: "forward" }, 1));
  assert.ok(batDescent({ stride: "back" }, 1, false) > batDescent({ stride: "forward" }, 1, false));
  assert.equal(batDescent({ stride: "back" }, 1, true), 0);
  assert.ok(Math.abs(padDepth(STRIDES.forward.z) - 1.55) < 1e-9);
  assert.equal(padDepth(STRIDES.back.z), 0.7);
});

test("blocking forward to a short ball finds the gloves and splice far more than going back", () => {
  const glovedOrSplice = (stride) => {
    let bad = 0;
    for (const { m, d } of deliveries(10.5, 80)) {
      const shot = { type: "defend", charge: 0, timingError: 0, feet: { stride, across: 0, from: null } };
      const c = m.resolve(m.aiPlan().intent, d, shot, false).res.contact;
      if (c.kind === "gloved" || c.impact?.region === "splice" || c.impact?.region === "handle") bad++;
    }
    return bad;
  };
  const forward = glovedOrSplice("forward");
  const back = glovedOrSplice("back");
  assert.ok(forward > back + 10, `forward ${forward}, back ${back}`);
});

test("the computer's feet follow his read of the length", () => {
  const rng = new Rng(3);
  const feet = (type, pitchZ, extra = {}) =>
    computerFeet({ type, pitchZ, line: 0, spinner: false, footwork: 1, settled: 1, aggression: 0, slog: false, rng, ...extra });
  assert.equal(feet("drive", 4).stride, "forward");
  assert.equal(feet("defend", 8).stride, "back");
  assert.equal(feet("cutpull", 9).stride, "back");
  assert.equal(feet("sweep", 4).stride, "forward");
  // Only a drive or loft at a pitched-up ball charges; a nimble, aggressive batter does it to spin.
  let charges = 0;
  for (let i = 0; i < 200; i++) if (feet("loft", 4.5, { spinner: true, aggression: 1 }).stride === "down") charges++;
  assert.ok(charges > 40 && charges < 110, `${charges}`);
  assert.notEqual(feet("defend", 4.5, { spinner: true, aggression: 1 }).stride, "down");
});
