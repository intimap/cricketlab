import test from "node:test";
import assert from "node:assert/strict";
import { BoothCaller, BOOTH_BALL_LINES, ballCallCategory } from "../src/sim/booth-caller.js";
import { fitsBox } from "../src/render/booth.js";
import { boothWords, repeatsHpd } from "../src/sim/booth-policy.js";

const names = { batter: "LA BONSHANE", bowler: "GREENWICH" };
const rng = { random: () => 0.4 };
const ball = extra => ({ over: 0, striker: 0, wicket: null, extra: { type: null, runs: 0 },
  total: 0, runsBat: 0, contact: "middle", dropped: null, padVerdict: "", shot: "drive",
  shotName: "cover drive", quality: 0.8, exit: { x: 10, z: 20 }, ...extra });
const cases = [
  ["leave", { contact: "none", shot: "leave" }], ["defend", { shot: "defend" }],
  ["beaten", { contact: "none", beatBat: true }], ["miss", { contact: "none" }],
  ["pad", { contact: "none", padVerdict: "missing" }], ["edgeDot", { contact: "thinEdge" }],
  ["edgeRuns", { contact: "insideEdge", total: 2 }], ["offCentreDot", { impact: { region: "toe" } }],
  ["offCentreRuns", { impact: { region: "splice" }, total: 1 }], ["stopped", {}], ["miscue", { quality: 0.1 }],
  ["single", { total: 1 }], ["two", { total: 2 }], ["three", { total: 3 }], ["runs", { total: 5 }],
  ["four", { boundary: 4, runsBat: 4, total: 4 }], ["six", { boundary: 6, runsBat: 6, total: 6 }],
  ["edgeBoundary", { contact: "topEdge", boundary: 4, runsBat: 4, total: 4 }],
  ["drop", { dropped: "SLIP" }], ["glove", { contact: "gloved" }],
  ["byes", { total: 4, contact: "none", boundary: 4, extra: { type: "b", runs: 4 } }],
  ["legByes", { total: 1, contact: "none", extra: { type: "lb", runs: 1 } }],
  ["wide", { total: 1, extra: { type: "wd", runs: 1 } }],
  ["noBall", { total: 2, extra: { type: "nb", runs: 1 } }],
  ["noBallBoundary", { total: 7, runsBat: 6, boundary: 6, extra: { type: "nb", runs: 1 } }],
  ["winningExtra", { total: 1, moment: { kind: "winningRuns" }, extra: { type: "wd", runs: 1 } }],
  ...["bowled", "lbw", "caught", "runout", "stumped"].map(how => [how, { wicket: { how } }]),
];

test("every outcome gets a factual primary call in all three voices", () => {
  assert.equal(new Set(cases.map(c => c[0])).size, 31);
  for (const [category, facts] of cases) for (let over = 0; over < 3; over++) {
    const rec = ball({ ...facts, over });
    assert.equal(ballCallCategory(rec), category);
    const call = new BoothCaller().call(rec, "THE HPD STAYS UNCHANGED.", names, rng, fitsBox);
    assert.ok(call, `${category}: no call`);
    assert.equal(call.who, over);
    assert.equal(call.topic, "ballCall");
    assert.equal(call.category, category);
    assert.ok(fitsBox(call.text));
    assert.ok(!/\{[^}]*\}|undefined|NaN/i.test(call.text));
  }
});

test("long strings of identical dot balls stay called, with fresh wording before reuse", () => {
  const caller = new BoothCaller();
  const calls = [];
  for (let i = 0; i < 90; i++) {
    const rec = ball({ over: Math.floor(i / 6), shot: "leave", contact: "none", shotName: "" });
    const call = caller.call(rec, "GOOD LENGTH OUTSIDE OFF. LEFT ALONE: NO RUN.", names, rng, fitsBox);
    assert.ok(call);
    assert.ok(!repeatsHpd(call.text, "GOOD LENGTH OUTSIDE OFF. LEFT ALONE: NO RUN."));
    const key = boothWords(call.text);
    assert.notEqual(key, calls.at(-1), "Immediate repeat");
    calls.push(key);
  }
  assert.ok(new Set(calls).size >= 24, `Only ${new Set(calls).size} different calls`);
});

test("a candidate matching HPD is replaced rather than silencing the ball", () => {
  const rec = ball({ shot: "defend" });
  const first = new BoothCaller().call(rec, "", names, { random: () => 0 }, fitsBox);
  const next = new BoothCaller().call(rec, first.text, names, { random: () => 0 }, fitsBox);
  assert.ok(next);
  assert.ok(!repeatsHpd(next.text, first.text));
});

test("wides, no-balls, byes, gloves and invalid catching chances cannot become clean bat hits", () => {
  assert.equal(ballCallCategory(ball({ contact: "gloved" })), "glove");
  assert.equal(ballCallCategory(ball({ boundary: 4, total: 4, contact: "none", extra: { type: "b" } })), "byes");
  assert.notEqual(ballCallCategory(ball({ dropped: "SLIP", freeHit: true })), "drop");
  assert.equal(ballCallCategory(ball({ dropped: "SLIP", extra: { type: "nb" } })), "noBall");
  const call = new BoothCaller().call(ball({ moment: { kind: "winningRuns" }, extra: { type: "nb" },
    boundary: 6, runsBat: 6, total: 7 }), "", names, rng, fitsBox);
  assert.equal(call.category, "winningExtra");
  assert.match(call.text, /CHASE|TARGET/);
  assert.doesNotMatch(call.text, /ANOTHER BALL|OWES|REQUIRED/);
});

test("toe and splice contacts cannot inherit a legacy middled-shot call", () => {
  for (const region of ["toe", "splice"]) {
    const rec = ball({ impact: { region }, total: 1, runsBat: 1 });
    const call = new BoothCaller().call(rec, "", names, { random: () => 0.9999 }, fitsBox);
    assert.match(call.text, new RegExp(region, "i"));
    assert.doesNotMatch(call.text, /MIDDLED|SWEET SPOT/);
  }
});

test("the expanded bank has 318 authored calls with valid three-voice structure", () => {
  let count = 0;
  for (const [category, voices] of Object.entries(BOOTH_BALL_LINES)) {
    assert.equal(voices.length, 3, category);
    for (const lines of voices) {
      assert.ok(lines.length >= 3);
      const rendered = lines.map(text => text.replace(/\{(?:b|w)\}/g, "LA BONSHANE")
        .replace(/\{extra\}/g, "").replace(/\{[^}]+\}/g, "TWO"));
      assert.ok(rendered.some(fitsBox), `${category} never fits`);
      count += lines.length;
    }
  }
  assert.equal(count, 318);
});
