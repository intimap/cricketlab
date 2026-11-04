import test from "node:test";
import assert from "node:assert/strict";
import { gradeTap, rhythmOf, rhythmEffect, GOOD_RHYTHM, BEAT_WINDOW } from "../src/sim/rhythm.js";
import { rhythmBeats, actionTimes } from "../src/render/bowler/bowler-action.js";
import { bowlDelivery } from "../src/sim/delivery.js";
import { Rng } from "../src/sim/rng.js";
import { australia } from "../src/sim/teams.js";
import { Pitch, PITCH_TYPES, Ball } from "../src/sim/conditions.js";

test("a tap on the beat is perfect, one outside its window is off it, a missed beat counts for nothing", () => {
  assert.equal(gradeTap(0, "med"), 1);
  assert.equal(gradeTap(BEAT_WINDOW.med * 0.3, "med"), 1);
  assert.equal(gradeTap(BEAT_WINDOW.med * 1.1, "med"), 0);
  assert.equal(gradeTap(null, "med"), 0);
  assert.ok(gradeTap(0.04, "high") < gradeTap(0.04, "med"), "high effort's beats are tighter");
  assert.equal(rhythmOf([0, null], "med"), 0.5);
});

test("a good rhythm bowls the ball as before; better is quicker and tighter, worse slower and wilder", () => {
  const good = rhythmEffect(GOOD_RHYTHM, "med");
  assert.ok(Math.abs(good.speed - 1) < 1e-9 && Math.abs(good.spray - 1) < 1e-9);
  const perfect = rhythmEffect(1, "med");
  const off = rhythmEffect(0, "med");
  assert.ok(perfect.speed > 1 && perfect.spray < 1);
  assert.ok(off.speed < 1 && off.spray > 1);
  // High effort rewards a good rhythm more and punishes a poor one more.
  assert.ok(rhythmEffect(1, "high").spray < perfect.spray);
  assert.ok(rhythmEffect(0, "high").speed < off.speed);
});

test("aftertouch is earned only with the rhythm", () => {
  assert.equal(rhythmEffect(0.3, "med").touch, 0);
  assert.equal(rhythmEffect(1, "med").touch, 1);
});

test("the computer's deliveries have no rhythm and are unchanged by it", () => {
  const skills = australia().players.find((p) => p.bowl?.style === "fast").bowl;
  const make = (intent) => {
    const rng = new Rng(9);
    return bowlDelivery(intent, skills, 1, new Ball(), new Pitch(PITCH_TYPES.green), 0, rng);
  };
  const base = { type: "seam", line: 0.2, length: 6.5, effort: "med" };
  const a = make(base);
  const b = make({ ...base, rhythm: GOOD_RHYTHM });
  assert.equal(a.speed.toFixed(9), b.speed.toFixed(9));
});

test("the beats are his last two footfalls before the leap: quick for the quicks, slower for spinners", () => {
  const gaps = (id, dur) => {
    const [b1, b2] = rhythmBeats(id, dur + actionTimes(id).takeoff);
    return [b2 - b1, -b2];
  };
  const fast = gaps("fast", 2.5);
  const spin = gaps("offspin", 1.5);
  for (const [first, second] of [fast, spin]) assert.ok(first > 0.2 && second > first, `${first} ${second}`);
  assert.ok(spin[0] > fast[0], "spinners tap on a slower beat");
});
