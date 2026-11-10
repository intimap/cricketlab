import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../src/sim/formats.js";
import { Rng } from "../src/sim/rng.js";
import { crossingAtZ } from "../src/sim/delivery.js";
import { TEAMS } from "../src/sim/team-list.js";
import { stepPractice, bowlersOf, deliveriesOf, fixPractice, setPractice } from "../src/sim/practice.js";

// The West Indies: 0 Braithwhite (RH), 3 Poorun (LH); 5 Chace (offspin), 7 Motey (left-arm spin), 8 Josephs (fast).
const ALL_RANDOM = { side: "random", delivery: "random", length: "random", line: "random" };
const practice = (settings, mode = "bat", pitch = "green", seed = 3) =>
  createMatch({ format: "nets", mode, team: "WI", pitch, practice: { ...ALL_RANDOM, ...settings } }, new Rng(seed));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/** Where the next `n` balls pitch (m from his stumps) and reach his stumps (m, + his off side), and what they are. */
function bowl(m, n = 60) {
  const out = { z: [], x: [], types: new Set() };
  for (let i = 0; i < n; i++) {
    const { intent, releaseError } = m.aiPlan();
    const d = m.deliver(intent, releaseError);
    const at = crossingAtZ(d.samples, 0);
    out.types.add(intent.type);
    if (!at) continue;
    out.z.push(d.pitchedAt.z);
    out.x.push(at.x);
  }
  return { z: mean(out.z), x: mean(out.x), types: out.types };
}

test("practice: the same batter faces the same bowler, with no overs, no wickets, and nothing wearing", () => {
  const m = practice({ batter: 3, bowler: 8 });
  const inn = m.inn;
  const ballOvers = inn.ball.overs;
  const wear = inn.pitch.wear;
  let overs = 0;
  for (let i = 0; i < 40; i++) {
    const { rec, applied } = m.simBall();
    if (applied.overEnded) overs++;
    assert.equal(inn.bat[rec.striker].p.name, "Nicholas Poorun");
    assert.equal(inn.bowl[rec.bowler].p.name, "Alzarri Josephs");
  }
  assert.equal(overs, 0, "no over is ever called");
  assert.equal(inn.wkts, 0, "nobody walks off");
  assert.equal(inn.bowler.stamina, 1, "the bowler never tires");
  assert.equal(inn.ball.overs, ballOvers);
  assert.equal(inn.pitch.wear, wear);
  assert.equal(inn.pressure, 0);
  assert.equal(m.inn.batTeam.name, m.inn.bowlTeam.name, "one squad at both ends");
});

test("practice: the ball asked for, at the length and line asked for, whoever bats and bowls", () => {
  const cases = [
    [{ batter: 0, bowler: 8, length: "good", line: "off", side: "over" }, 6.3, 0.3],
    [{ batter: 0, bowler: 8, length: "short", line: "off", side: "around" }, 9.2, 0.3],
    [{ batter: 3, bowler: 8, length: "full", line: "stumps" }, 3.4, 0.03],
    [{ batter: 3, bowler: 5, length: "good", line: "stumps" }, 5.2, 0.03],
    [{ batter: 3, bowler: 7, length: "good", line: "off" }, 5.2, 0.3],
    [{ batter: 0, bowler: 8, delivery: "inswing", length: "good", line: "stumps" }, 6.3, 0.03],
    [{ batter: 0, bowler: 8, delivery: "bouncer" }, 11, -0.05],
  ];
  for (const [settings, length, line] of cases) {
    const got = bowl(practice(settings, "bat", "dust"));
    const what = JSON.stringify(settings);
    assert.ok(Math.abs(got.z - length) < 0.4, `${what}: pitched ${got.z.toFixed(2)}`);
    assert.ok(Math.abs(got.x - line) < 0.12, `${what}: reached ${got.x.toFixed(2)}`);
    if (settings.delivery) assert.deepEqual([...got.types], [settings.delivery]);
  }
});

test("practice: RANDOM is his own mix, but never a bouncer or yorker when a length is asked for", () => {
  assert.ok(bowl(practice({ bowler: 8 }), 200).types.size > 1);
  const full = bowl(practice({ bowler: 8, length: "full" }), 200).types;
  assert.ok(!full.has("bouncer") && !full.has("yorker"), [...full].join(" "));
});

test("practice choices: a batter, a bowler who bowls and isn't him, and only the bowler's deliveries", () => {
  const team = TEAMS.WI();
  const bowlers = bowlersOf(team);
  let s = fixPractice({ batter: 0, bowler: 8 }, team);
  for (let i = 0; i < 25; i++) {
    s = stepPractice(s, "bowler", 1, team);
    assert.ok(bowlers.includes(s.bowler) && s.bowler !== s.batter);
  }
  s = fixPractice({ batter: 5, bowler: 8 }, team);
  for (let i = 0; i < 25; i++) {
    s = stepPractice(s, "batter", -1, team);
    assert.notEqual(s.batter, s.bowler);
  }
  // A seamer's bouncer, then a spinner: the delivery goes back to RANDOM.
  s = { ...fixPractice({ batter: 0, bowler: 8 }, team), delivery: "bouncer" };
  assert.ok(deliveriesOf(team.players[8]).includes("bouncer"));
  assert.equal(fixPractice({ ...s, bowler: 5 }, team).delivery, "random");
  assert.equal(stepPractice(s, "side", 1, team).side, "over");
});

test("practice: the pitch can be changed in the session", () => {
  const m = practice({ batter: 0, bowler: 5 }, "bowl", "green");
  assert.equal(m.pitch.type.id, "green");
  setPractice(m, { ...m.practice, batter: 3 }, "dust");
  assert.equal(m.pitch.type.id, "dust");
  assert.equal(m.inn.pitch, m.pitch);
  assert.equal(m.inn.bat[m.inn.striker].p.name, "Nicholas Poorun");
  assert.equal(m.needOver, false, "bowling, no choosing a bowler: he's chosen");
});
