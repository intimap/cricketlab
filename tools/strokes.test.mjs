import test from "node:test";
import assert from "node:assert/strict";
import { strokeFor, strokeName, turnedBy, leaveStyle, PULL_HEIGHT } from "../src/sim/strokes.js";
import { backFootShot } from "../src/sim/shot-choice.js";
import { faceTilt } from "../src/sim/bat-ball.js";
import { shotBearing } from "../src/sim/shot-direction.js";

const fwd = { stride: "forward", across: 0 };
const back = { stride: "back", across: 0 };

test("the button, the feet and the ball make the stroke", () => {
  assert.deepEqual(strokeFor("attack", fwd, { y: 0.5 }), { type: "drive" });
  assert.deepEqual(strokeFor("attack", fwd, { y: PULL_HEIGHT + 0.1 }), { type: "cutpull" });
  assert.deepEqual(strokeFor("attack", back, { y: 0.4 }), { type: "cutpull" });
  assert.deepEqual(strokeFor("loft", fwd), { type: "loft" });
  assert.deepEqual(strokeFor("loft", back), { type: "cutpull", variant: "aerial" });
  assert.deepEqual(strokeFor("improvise", fwd), { type: "sweep" });
  assert.deepEqual(strokeFor("improvise", fwd, null, true), { type: "sweep", variant: "slog" });
  assert.deepEqual(strokeFor("improvise", { stride: "crease", across: 0.2 }, null, true), {
    type: "reverseSweep",
    variant: "slog",
  });
  assert.deepEqual(strokeFor("improvise", back), { type: "ramp" });
  assert.deepEqual(strokeFor("defend", back), { type: "defend", foot: "back" });
});

test("short, wide and up above the shoulder is upper-cut over the slips, lifted", () => {
  assert.equal(backFootShot(0.4, 1.0), "cut");
  assert.equal(backFootShot(0.4, 1.45), "upperCut");
  assert.ok(faceTilt("cutpull", "upperCut", 1.45, 0.35, 0) > faceTilt("cutpull", "cut", 1.45, 0.35, 0) + 10);
  assert.ok(shotBearing("cutpull", 0.4, 1.45, "upperCut") > 120);
  // Slogged sweeps go up and squarer; a back-foot shot hit in the air goes up.
  assert.ok(faceTilt("sweep", null, 0.5, 0.35, 0, "slog") > faceTilt("sweep", null, 0.5, 0.35, 0) + 10);
  assert.ok(shotBearing("reverseSweep", 0, 0.5, null, "slog") < shotBearing("reverseSweep", 0, 0.5, null));
  assert.ok(faceTilt("cutpull", "pull", 1.1, 0.35, 0, "aerial") > faceTilt("cutpull", "pull", 1.1, 0.35, 0) + 10);
});

test("a shuffle keeps his angles; right across the crease turns them", () => {
  assert.equal(turnedBy(0.08), 0);
  assert.equal(Math.abs(turnedBy(-0.1)), 0);
  assert.ok(Math.abs(turnedBy(0.3) - 0.2) < 1e-9);
  assert.ok(Math.abs(turnedBy(-0.25) + 0.15) < 1e-9);
});

test("each stroke has its name", () => {
  const name = (o) => strokeName({ type: "drive", bearing: 0, height: 0.5, back: null, feet: fwd, pitchZ: 5, line: 0, ...o });
  assert.equal(name({}), "straight drive");
  assert.equal(name({ bearing: 50, feet: { stride: "forward", across: -0.25 } }), "inside-out cover drive");
  assert.equal(name({ bearing: -60, feet: { stride: "forward", across: 0.25 } }), "whip through midwicket");
  assert.equal(name({ feet: { stride: "down", across: 0 } }), "charging straight drive");
  assert.equal(name({ type: "loft", bearing: 20, feet: { stride: "down", across: 0 } }), "charging lofted off drive");
  assert.equal(name({ type: "cutpull", back: "pull", height: 1.1 }), "front-foot pull");
  assert.equal(name({ type: "cutpull", back: "upperCut", height: 1.4, feet: back }), "upper cut");
  assert.equal(
    name({ type: "cutpull", back: "pull", height: 1.1, feet: { stride: "back", across: 0.25 } }),
    "pull from inside the line",
  );
  assert.equal(name({ type: "cutpull", back: "pull", height: 1.1, feet: back, variant: "aerial" }), "lofted pull");
  assert.equal(name({ type: "cutpull", back: "punch", feet: fwd, bearing: 30 }), "off drive");
  assert.equal(name({ type: "sweep", variant: "slog", bearing: -78 }), "slog-sweep");
  assert.equal(name({ type: "reverseSweep", variant: "slog", bearing: 68 }), "switch hit");
  assert.equal(name({ type: "defend", feet: fwd, spinner: true, pitchZ: 4 }), "smother");
  assert.equal(name({ type: "defend", feet: { stride: "crease", across: 0 }, pitchZ: 5 }), "jab");
  assert.equal(name({ type: "defend", feet: { stride: "crease", across: 0 }, pitchZ: 2 }), "dig out");
  assert.equal(name({ type: "defend", feet: back, height: 1.3 }), "fend");
  assert.equal(name({ type: "defend", feet: back }), "back-foot defence");
  assert.equal(name({ type: "defend", feet: fwd }), "forward defence");
});

test("a ball up at him is swayed going back, ducked otherwise; anything lower just let go", () => {
  assert.equal(leaveStyle(back, 0.6), "leave");
  assert.equal(leaveStyle(back, 1.3), "sway");
  assert.equal(leaveStyle(fwd, 1.3), "duck");
  assert.equal(leaveStyle(back, 1.7), "duck");
});
