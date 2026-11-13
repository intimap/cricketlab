import test from "node:test";
import assert from "node:assert/strict";
import { batSound, powerOf, FULL_POWER_SPEED } from "../src/scenes/bat-sound.js";

/** Steady dice, so two sounds can be compared layer for layer. */
const steady = () => 0.5;
const layers = (s) => s.tones.length + s.bursts.length + s.clicks.length;
/** Every layer's volume: tones [freq, dur, vol], bursts [dur, freq, q, vol], clicks [dur, cutoff, vol]. */
const volumes = (s) => [...s.tones.map((l) => l[2]), ...s.bursts.map((l) => l[3]), ...s.clicks.map((l) => l[2])];
const loudness = (s) => volumes(s).reduce((a, b) => a + b, 0);
const lowest = (s) => Math.min(...s.tones.map((l) => l[0]));

test("bat on ball: a sweet full-blooded hit has it all; a block is the same wood, softly", () => {
  const sweet = batSound({ quality: 1, power: 1 }, steady);
  const block = batSound({ quality: 0.8, power: 0.1 }, steady);
  assert.ok(lowest(sweet) < 120, "the thump under a big hit");
  assert.ok(sweet.bursts.some((l) => l[4] > 0.1) && sweet.tones.some((l) => l[4] > 0.1), "and the slap back off the stands");
  assert.ok(lowest(block) > 300 && block.tones.every((l) => l[4] === 0), "a block has neither");
  assert.ok(loudness(sweet) > 2.5 * loudness(block));
  assert.ok(layers(sweet) > layers(block));
});

test("bat on ball: mistimed is duller, with a clunk under it; clean rings higher", () => {
  const clean = batSound({ quality: 0.9, power: 0.4 }, steady);
  const mistimed = batSound({ quality: 0.2, power: 0.4 }, steady);
  const ring = (s) => s.tones.filter((l) => l[3] === "sine").map((l) => l[0]);
  assert.ok(Math.min(...ring(clean)) > Math.min(...ring(mistimed)), "the blade rings higher off the middle");
  assert.ok(
    mistimed.tones.some((l) => l[3] === "triangle"),
    "the clunk",
  );
  assert.ok(!clean.tones.some((l) => l[3] === "triangle"));
  assert.ok(clean.clicks[0][2] > mistimed.clicks[0][2], "a sharper click off the middle");
});

test("bat on ball: edges, the toe and the splice have their own sounds, and no two hits are quite alike", () => {
  const thin = batSound({ kind: "thinEdge", thickness: 0.1 }, steady);
  const thick = batSound({ kind: "thickEdge", thickness: 0.9 }, steady);
  assert.ok(thin.clicks[0][1] > thick.clicks[0][1], "a thin edge is the brighter tick");
  assert.ok(layers(thick) > layers(thin), "a thick edge has more wood in it");
  assert.ok(lowest(thin) > 900, "no body to a thin edge");
  const toe = batSound({ region: "toe" }, steady);
  const splice = batSound({ region: "splice" }, steady);
  assert.ok(
    toe.tones.some((l) => l[3] === "square"),
    "the toe jars",
  );
  assert.equal(splice.clicks.length, 2, "the handle rattles");
  const a = batSound({ quality: 1, power: 1 });
  const b = batSound({ quality: 1, power: 1 });
  assert.notDeepEqual(a.tones, b.tones);
  for (const s of [thin, thick, toe, splice, a, b]) for (const v of volumes(s)) assert.ok(v > 0 && v <= 1, `volume ${v}`);
});

test("bat on ball: power is how fast it left the bat", () => {
  assert.equal(powerOf(null), 0);
  assert.equal(powerOf({ x: 0, y: 0, z: FULL_POWER_SPEED * 2 }), 1);
  assert.ok(Math.abs(powerOf({ x: 0, y: 0, z: FULL_POWER_SPEED / 2 }) - 0.5) < 1e-9);
});
