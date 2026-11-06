import test from "node:test";
import assert from "node:assert/strict";
import { battingStyle, deathOvers, deathBall, noteFeet, lengthAgainstFeet } from "../src/sim/styles.js";
import { Rng } from "../src/sim/rng.js";

test("short games are batted in a hurry and Tests patiently", () => {
  const t20 = battingStyle({ tempo: 0.73 });
  const odi = battingStyle({ tempo: 0.18 });
  const testMatch = battingStyle({ tempo: 0, test: true });
  assert.ok(t20.leave < odi.leave && odi.leave < testMatch.leave);
  assert.ok(t20.loft > odi.loft && t20.power > odi.power && t20.charge > odi.charge);
  assert.equal(testMatch.loft, 0);
});

test("the death is the last fifth of a short game, never a Test or a long one", () => {
  const inn = (legal, tempo = 0.73, test = false) => ({ legal, tempo, test, oversLimit: 20 });
  assert.equal(deathOvers(inn(90)), false);
  assert.equal(deathOvers(inn(96)), true);
  assert.equal(deathOvers(inn(110, 0.18)), false);
  assert.equal(deathOvers(inn(110, 0.73, true)), false);
  // Death balls: mostly full, some slower, the odd bouncer.
  const rng = new Rng(4);
  const kinds = {};
  for (let i = 0; i < 400; i++) {
    const b = deathBall(() => true, rng);
    kinds[b?.type ?? "own"] = (kinds[b?.type ?? "own"] ?? 0) + 1;
  }
  assert.ok(kinds.yorker > 160 && kinds.slower > 40 && kinds.bouncer > 20, JSON.stringify(kinds));
});

test("bowlers read the wrong feet, not the right ones", () => {
  const right = { balls: 0 };
  const forwardPresser = { balls: 0 };
  for (let i = 0; i < 30; i++) {
    const pitchZ = i % 3 === 0 ? 9 : 5;
    right.balls++;
    forwardPresser.balls++;
    noteFeet(right, { type: "drive", feet: { stride: pitchZ > 7 ? "back" : "forward" } }, pitchZ);
    noteFeet(forwardPresser, { type: "drive", feet: { stride: "forward" } }, pitchZ);
  }
  assert.ok((right.forwardToShort ?? 0) < 0.1 && (right.backToFull ?? 0) < 0.1);
  assert.ok(forwardPresser.forwardToShort > 0.55);
  // Once read, the forward presser gets it short more often; the right feet only get the odd test early on.
  const rng = new Rng(8);
  let short = 0;
  for (let i = 0; i < 200; i++) if ((lengthAgainstFeet(forwardPresser, false, rng) ?? 0) > 8) short++;
  assert.ok(short > 100, `${short}`);
  assert.equal(lengthAgainstFeet({ ...right, balls: 60 }, false, rng), null);
});

test("leaves aren't feet he's shown", () => {
  const b = { balls: 5 };
  noteFeet(b, { type: "leave", feet: { stride: "forward" } }, 9);
  assert.equal(b.forwardToShort, undefined);
});
