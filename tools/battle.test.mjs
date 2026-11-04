import test from "node:test";
import assert from "node:assert/strict";
import { readWord } from "../src/sim/plans.js";
import { overReview } from "../src/sim/over-review.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { PITCH_MAP_BALLS } from "../src/sim/innings.js";

test("the read word: not picked first, then a surprise, a known weakness, a ball he's lined up", () => {
  assert.equal(readWord({ notPicked: true, battle: { surprise: 1 } }, false), "DIDN'T PICK IT");
  assert.equal(readWord({ battle: { surprise: 1, familiar: 3 } }, false), "SURPRISE!");
  assert.equal(readWord({ battle: { weak: 0.8 } }, false), null, "a hidden weakness isn't given away");
  assert.equal(readWord({ battle: { weak: 0.8 } }, true), "ON HIS WEAKNESS");
  assert.equal(readWord({ battle: { familiar: 2 } }, false), "HE'S LINED IT UP");
});

test("the over's review picks the line that fits it", () => {
  const dot = (o) => ({ runs: 0, z: 6, wicket: false, beaten: false, extra: false, familiar: 0, surprise: false, ...o });
  assert.match(overReview([dot({}), dot({}), dot({ runs: 1 })]).line, /TIGHT/);
  assert.match(overReview([dot({ wicket: true, surprise: true })]).line, /CHANGE-UP/);
  assert.match(overReview([dot({ runs: 4, familiar: 2 }), dot({ runs: 4, familiar: 3 })]).line, /LINED UP/);
  assert.equal(overReview([dot({ runs: 4 }), dot({ runs: 2 })]).runs, 6);
});

test("every ball's pitch is noted for the batter's map and the over's", () => {
  const m = new Match(australia(), england(), "green", 10, new Rng(3), "bowl");
  for (let i = 0; i < 40 && !m.inn.isOver; i++) m.simBall();
  const inn = m.inn;
  assert.ok(inn.bat.some((b) => b.pitches?.length));
  assert.ok(inn.bat.every((b) => (b.pitches?.length ?? 0) <= PITCH_MAP_BALLS));
  assert.ok(inn.lastOverPitches.length >= 6);
});
