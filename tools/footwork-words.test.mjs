import test from "node:test";
import assert from "node:assert/strict";
import { footworkWord, wantedStride, FOOTWORK_WORDS } from "../src/sim/footwork-words.js";
import { battingFeedback } from "../src/sim/coach.js";
import { easyFeet } from "../src/scenes/bat-controls.js";
import { ASSIST } from "../src/scenes/assists.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";

/** A resolved ball's feet as sim/batting.js gives them. */
const res = (feet, contact = { kind: "middle" }) => ({
  feet: { stride: "forward", across: 0, made: 1, z: 1.95, line: 0, ...feet },
  contact,
});
const word = (feet, type = "drive", pitchZ = 4, contact) => footworkWord(res(feet, contact), type, pitchZ)?.key ?? null;

test("the length wants the front foot when it's pitched up, the back when it's short, either between", () => {
  assert.equal(wantedStride(3), "forward");
  assert.equal(wantedStride(7), "either");
  assert.equal(wantedStride(9), "back");
});

test("each footwork word for what the feet did", () => {
  assert.equal(word({}), "goodStride");
  assert.equal(word({ stride: "down", z: 3.4 }), "goodStride");
  assert.equal(word({ stride: "back" }, "drive", 4), "wrongFoot");
  assert.equal(word({ stride: "forward" }, "cutpull", 9.5), "wrongFoot");
  assert.equal(word({ stride: "crease" }, "defend", 6), "crease");
  assert.equal(word({ made: 0.5 }, "drive", 5), "crease");
  assert.equal(word({ across: 0.25, line: -0.3 }, "defend", 6), "acrossLine");
  assert.equal(word({}, "drive", 4, { kind: "none", outOfReach: true }), "outOfReach");
  assert.equal(word({ stride: "back", across: -0.2, line: 0.3 }, "cutpull", 9), "room");
  // Good, and in the colours' sense.
  assert.equal(footworkWord(res({}), "drive", 4).text, FOOTWORK_WORDS.goodStride);
  assert.equal(footworkWord(res({}), "drive", 4).good, true);
  assert.equal(footworkWord(res({ stride: "crease" }), "drive", 4).good, false);
});

test("no word for a leave, and sweeps and ramps aren't called the wrong foot", () => {
  assert.equal(word({}, "leave"), null);
  assert.equal(word({ stride: "forward" }, "sweep", 9), "goodStride");
  assert.equal(word({ stride: "back" }, "ramp", 4), "goodStride");
});

test("a resolved ball says where the feet met it", () => {
  const m = new Match(australia(), england(), "green", 50, new Rng(5), "bat");
  m.startOver();
  const { intent, releaseError } = m.aiPlan();
  const d = m.deliver(intent, releaseError);
  const late = { stride: "forward", across: 0, from: 0.4 };
  const r = m.resolve(intent, d, { type: "defend", foot: "front", charge: 0, timingError: 0, feet: late }, false).res;
  assert.equal(r.feet.stride, "forward");
  assert.ok(r.feet.made < 1 && r.feet.z < 1.95, JSON.stringify(r.feet));
  assert.ok(Number.isFinite(r.feet.line));
});

test("the nets coach rates the feet, and the wrong feet aren't a good ball", () => {
  const m = new Match(australia(), england(), "green", 50, new Rng(5), "bat");
  m.startOver();
  const { intent, releaseError } = m.aiPlan();
  const d = m.deliver(intent, releaseError);
  const shot = { type: "drive", charge: 0.35, timingError: 0, feet: { stride: "back", across: 0, from: null } };
  const fakeRes = res({ stride: "back" });
  const rec = { contact: "middle", quality: 0.9, total: 1, runsBat: 1, extra: {}, shot: "drive" };
  const feedback = battingFeedback({ delivery: { ...d, pitchedAt: { x: 0, z: 4 } }, shot, rec, spinner: false, res: fakeRes });
  assert.ok(feedback.lines.includes("FEET: WRONG FOOT"), feedback.lines.join(" | "));
  assert.ok(feedback.lines.some((l) => l.startsWith("COACH: WRONG FOOT")));
  assert.notEqual(feedback.grade, "good");
});

test("EASY takes his feet to the length in good time and gives the widest window; HARD the narrowest", () => {
  assert.deepEqual(easyFeet({ pitchedAt: { z: 4 } }, 0.1), { stride: "forward", across: 0.1, from: null });
  assert.equal(easyFeet({ pitchedAt: { z: 9 } }, 0).stride, "back");
  assert.ok(ASSIST.easy.window > ASSIST.normal.window && ASSIST.normal.window > ASSIST.hard.window);
  assert.equal(ASSIST.easy.feet, "auto");
  assert.equal(ASSIST.normal.feet, "own");
  assert.ok(ASSIST.easy.landing && !ASSIST.normal.landing && !ASSIST.hard.landing);
});
