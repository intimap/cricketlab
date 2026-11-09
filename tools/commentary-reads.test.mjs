import test from "node:test";
import assert from "node:assert/strict";
import { matchSituations, overStartSituations } from "../src/sim/match-situations.js";
import { runupRead } from "../src/sim/runup-reads.js";
import { voiceLines, formatOf } from "../src/sim/lines.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { boothCall } from "../src/sim/commentators.js";
import { fitsBox } from "../src/render/booth.js";
import { fitsHud } from "../src/render/call-line.js";

const chase = (need, left, extra = {}) => ({
  isOver: false,
  target: 150,
  runsNeeded: need,
  ballsLeft: left,
  wkts: 3,
  partnership: { runs: 10 },
  oversLimit: 20,
  ...extra,
});
const topics = (opts) => opts.map((o) => `${o.topic}${o.case ? `:${o.case}` : ""}`);

test("the end of a chase is called by what's needed off what's left", () => {
  const rec = { total: 1 };
  assert.ok(topics(matchSituations(rec, chase(4, 1), null, "t20")).includes("chaseLastBall:4"));
  assert.ok(topics(matchSituations(rec, chase(9, 1), null, "t20")).includes("chaseLastBall:more"));
  assert.ok(topics(matchSituations(rec, chase(1, 3), null, "t20")).includes("scoresLevel"));
  assert.ok(topics(matchSituations(rec, chase(14, 5), null, "t20")).includes("chaseLastOver:steep"));
  assert.ok(topics(matchSituations(rec, chase(6, 11), null, "t20")).includes("chaseLastTwo:easy"));
  assert.ok(topics(matchSituations(rec, chase(40, 12), null, "t20")).includes("closingOut"));
  // Nothing of the kind in a Test's last innings (the Test has its own), or before the last two overs.
  assert.deepEqual(matchSituations(rec, chase(4, 1), null, "test"), []);
  assert.deepEqual(
    topics(matchSituations(rec, chase(30, 40), null, "t20")).filter((t) => t.startsWith("chase")),
    [],
  );
});

test("the powerplay is marked at its start and its end, by format", () => {
  const inn = (overNo) => ({ bowler: {}, bat: [{}], striker: 0, overNo, oversLimit: 20 });
  assert.deepEqual(topics(overStartSituations(inn(0), null, "t20")), ["powerplay:start"]);
  assert.deepEqual(topics(overStartSituations(inn(6), null, "t20")), ["powerplay:end"]);
  assert.deepEqual(topics(overStartSituations(inn(6), null, "odi")), []);
  assert.deepEqual(topics(overStartSituations(inn(10), null, "odi")), ["powerplay:end"]);
});

test("the run-up read is of the balls already bowled: bouncers, the same variation, a length hammered", () => {
  const ball = (type, length = "good length", line = "stumps") => ({ type, length, line });
  assert.equal(runupRead([ball("bouncer", "short"), ball("seam"), ball("bouncer", "short")])?.case, "bouncers");
  const same = runupRead([ball("outswing"), ball("outswing"), ball("outswing")]);
  assert.equal(same.case, "same");
  assert.equal(same.facts.types, "OUTSWINGERS");
  assert.equal(runupRead([ball("seam", "full"), ball("seam", "yorker"), ball("seam", "full")])?.case, "full");
  assert.equal(runupRead([ball("seam", "short", "off"), ball("seam"), ball("seam")]), null);
  assert.equal(runupRead([]), null);
});

test("lines tagged for a format are only said in it", () => {
  const all = (format) => voiceLines("goodLeave", "close", { format }).flat();
  assert.ok(all("test").includes("THAT'S TEST MATCH BATTING! KNOW YOUR OFF STUMP!"));
  assert.ok(!all("t20").includes("THAT'S TEST MATCH BATTING! KNOW YOUR OFF STUMP!"));
  assert.ok(all("t20").includes("A LEAVE IN A T20 IS A DOT FOR THE BOWLER. HE'LL TAKE IT."));
  assert.equal(formatOf({ test: true }), "test");
  assert.equal(formatOf({ oversLimit: 20 }), "t20");
  assert.equal(formatOf({ oversLimit: 50 }), "odi");
});

test("the box talks on most balls, never opened by the over's caller", () => {
  const m = new Match(australia(), england(), "green", 20, new Rng(3), "bat", { innings: 2 });
  const dice = new Rng(11);
  const rng = { random: () => dice.next(), chance: (p) => dice.next() < p };
  let balls = 0;
  let spoken = 0;
  while (!m.inn.isOver) {
    const inn = m.inn;
    const { rec, applied } = m.simBall();
    const names = { batter: inn.bat[rec.striker].p.short, bowler: inn.bowl[rec.bowler].p.short };
    const { calls } = boothCall(rec, rec.call, names, rng, m.comm, fitsBox, {
      inn,
      match: m,
      applied,
      fitsCall: fitsHud,
      commentary: m.comm,
      narrative: m.comm.narrative,
    });
    balls++;
    const box = calls.filter((c) => c.topic !== "ballCall" && c.topic !== "overSummary");
    if (box.length) spoken++;
    // The first remark of the ball (an exchange's opener included) is never the caller's.
    if (box.length) assert.notEqual(box[0].who, rec.over % 3, `${rec.over}.${rec.ball}: ${box[0].text}`);
    assert.ok(calls.filter((c) => c.topic === "ballCall").every((c) => c.who === rec.over % 3));
  }
  assert.ok(spoken / balls > 0.5 && spoken / balls < 0.85, `the box spoke on ${spoken} of ${balls} balls`);
});
