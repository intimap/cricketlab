import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatchMemory,
  update,
  MOMENT,
  MOMENT_RULES,
  TURN_SWING,
  STAND_SWING,
  STAND_MIN_RUNS,
} from "../src/sim/match-memory.js";
import { BEATEN_TIMES, DOMINANCE_RUNS, SQUEEZE_DOTS, LETOFF_STEPS } from "../src/sim/memory-duels.js";
import {
  RRR_THRESHOLDS,
  BOUNDARY_RATE,
  CHECKPOINTS,
  POWERPLAY_OVERS,
  REVERSE_FROM,
  TURN_FROM,
} from "../src/sim/memory-phases.js";
import { winProbability } from "../src/sim/win-probability.js";

/** A match state and a ball, plain records as sim/memory-input.js makes them, with what a test changes. */
const state = (s = {}) => ({
  innings: 1,
  format: "odi",
  batTeam: "AUS",
  batName: "AUSTRALIA",
  bowlTeam: "ENG",
  runs: 0,
  wkts: 0,
  legal: 0,
  oversLimit: 50,
  target: null,
  partnership: { runs: 0, balls: 0 },
  test: null,
  ballNumber: 1,
  ballOvers: 0,
  reverse: 0,
  turnRatio: 1,
  light: null,
  ...s,
});
const ball = (b = {}) => ({
  batter: "Ann Bat",
  bowler: "Bob Bowl",
  batterShort: "Bat",
  bowlerShort: "Bowl",
  batterScore: 0,
  runs: 0,
  batRuns: 0,
  legal: true,
  faced: true,
  boundary: 0,
  beaten: false,
  wicket: null,
  letoff: null,
  ...b,
});

/** Feed [ball, state] steps; for each, the moments of `type` that fired. */
function feed(steps, type) {
  let memory = createMatchMemory();
  return steps.map(([b, s]) => {
    const r = update(memory, ball(b), state(s));
    memory = r.memory;
    return r.fired.filter((m) => m.type === type);
  });
}
/** Which steps (indexes) fired the moment. */
const firedAt = (results) => results.flatMap((r, i) => (r.length ? [i] : []));

test("TURNING_POINT: a ball that swings the chance of winning by TURN_SWING or more, and not one that swings less", () => {
  // Chasing 10 off the last 6 with the last pair: a wicket ends it; a single barely moves it.
  const tight = { target: 250, runs: 240, legal: 294, wkts: 9, format: "odi" };
  const swingOf = (b, s) =>
    Math.abs(
      winProbability(state(s)) -
        winProbability(state({ ...s, runs: s.runs - (b.runs ?? 0), wkts: s.wkts - (b.wicket ? 1 : 0), legal: s.legal - 1 })),
    );
  const wicket = [{ wicket: { batter: "Ann Bat", byBowler: true } }, { ...tight, wkts: 10, legal: 295 }];
  const single = [
    { runs: 1, batRuns: 1 },
    { ...tight, runs: 241, legal: 295 },
  ];
  assert.ok(swingOf(...wicket) >= TURN_SWING && swingOf(...single) < TURN_SWING);
  assert.deepEqual(firedAt(feed([single, wicket], MOMENT.TURNING_POINT)), [1]);
  // The same ball twice is the same situation: said once.
  assert.deepEqual(firedAt(feed([wicket, wicket], MOMENT.TURNING_POINT)), [0]);
});

test("PARTNERSHIP_SWING: once the stand has moved the chance by STAND_SWING with STAND_MIN_RUNS on it, once a stand", () => {
  // A chase of 250: the stand starts at 100/5 in the 25th over and adds two runs a ball.
  const steps = [];
  for (let k = 0; k <= 40; k++)
    steps.push([
      { runs: 2, batRuns: 2 },
      { target: 250, runs: 100 + 2 * k, wkts: 5, legal: 150 + k, partnership: { runs: 2 * k, balls: k } },
    ]);
  const from = winProbability(state(steps[0][1]));
  const first = steps.findIndex(
    ([, s]) => s.partnership.runs >= STAND_MIN_RUNS && Math.abs(winProbability(state(s)) - from) >= STAND_SWING,
  );
  assert.ok(first > 0);
  assert.deepEqual(firedAt(feed(steps, MOMENT.PARTNERSHIP_SWING)), [first]);
});

test("DUEL_BEATEN: at the third time the same bowler beats him, not the second, not the fourth", () => {
  const steps = Array.from({ length: BEATEN_TIMES + 1 }, () => [{ beaten: true }, {}]);
  assert.deepEqual(firedAt(feed(steps, MOMENT.DUEL_BEATEN)), [BEATEN_TIMES - 1]);
  // Another bowler beating him doesn't count towards it.
  const mixed = [
    [{ beaten: true }, {}],
    [{ beaten: true, bowler: "Cy Other" }, {}],
    [{ beaten: true }, {}],
  ];
  assert.deepEqual(firedAt(feed(mixed, MOMENT.DUEL_BEATEN)), []);
});

test("DUEL_DOMINANCE: when his runs off one bowler reach 25 (from 10 balls or more, at 150 or more), once", () => {
  // Nine twos (18), a six (24), then singles: 25 comes on the 11th ball, 11 balls, well over 150.
  const runs = [2, 2, 2, 2, 2, 2, 2, 2, 2, 6, 1, 1, 1];
  let score = 0;
  const steps = runs.map((r) => [{ runs: r, batRuns: r, batterScore: (score += r) }, {}]);
  assert.equal(
    runs.slice(0, 11).reduce((a, b) => a + b, 0),
    DOMINANCE_RUNS,
  );
  assert.deepEqual(firedAt(feed(steps, MOMENT.DUEL_DOMINANCE)), [10]);
});

test("DUEL_REPEAT_DISMISSAL: the second time the same bowler gets him (across innings), not the first", () => {
  const out = { wicket: { batter: "Ann Bat", byBowler: true } };
  const steps = [
    [out, { innings: 1, wkts: 1 }],
    [{}, { innings: 3 }],
    [out, { innings: 3, wkts: 1 }],
  ];
  assert.deepEqual(firedAt(feed(steps, MOMENT.DUEL_REPEAT_DISMISSAL)), [2]);
  // A run-out isn't the bowler's.
  const runout = { wicket: { batter: "Ann Bat", byBowler: false } };
  assert.deepEqual(
    firedAt(
      feed(
        [
          [out, {}],
          [runout, {}],
        ],
        MOMENT.DUEL_REPEAT_DISMISSAL,
      ),
    ),
    [],
  );
});

test("DUEL_DOT_SQUEEZE: at the eighth dot in a row from one bowler, not the seventh, not the ninth", () => {
  const steps = Array.from({ length: SQUEEZE_DOTS + 1 }, () => [{}, {}]);
  assert.deepEqual(firedAt(feed(steps, MOMENT.DUEL_DOT_SQUEEZE)), [SQUEEZE_DOTS - 1]);
  // A run breaks the streak.
  const broken = [...steps.slice(0, SQUEEZE_DOTS - 1), [{ runs: 1, batRuns: 1 }, {}], [{}, {}]];
  assert.deepEqual(firedAt(feed(broken, MOMENT.DUEL_DOT_SQUEEZE)), []);
});

/** `n` balls where nothing happens (the cooldowns run on). */
const quiet = (n, s = {}) => Array.from({ length: n }, () => [{ batter: "Zed Other", bowler: "Cy Other" }, s]);

test("LETOFF_COST: at 20 runs since the let-off (and at 50), not at 19, and with the numbers to say", () => {
  const steps = [[{ letoff: "drop", batterScore: 10 }, {}]];
  for (const score of [29, 30, 31]) steps.push([{ runs: 1, batRuns: 1, batterScore: score }, {}]);
  // The type's cooldown runs out before the next step.
  steps.push(...quiet(MOMENT_RULES[MOMENT.LETOFF_COST].cooldown));
  for (const score of [59, 60]) steps.push([{ runs: 1, batRuns: 1, batterScore: score }, {}]);
  const results = feed(steps, MOMENT.LETOFF_COST);
  assert.deepEqual(firedAt(results), [2, steps.length - 1]);
  assert.deepEqual(LETOFF_STEPS, [20, 50]);
  const said = results[2][0].payload;
  assert.equal(said.droppedOn, 10);
  assert.equal(said.nowOn, 30);
  assert.equal(said.cost, 20);
  assert.equal(said.letoff, "THE DROP");
  // Out, and it's spent: no more told.
  const outThen = [
    steps[0],
    [{ wicket: { batter: "Ann Bat", byBowler: true } }, {}],
    [{ runs: 1, batRuns: 1, batterScore: 40 }, {}],
  ];
  assert.deepEqual(firedAt(feed(outThen, MOMENT.LETOFF_COST)), []);
});

/** A chase of 200 in 20 overs with 10 overs left, needing `need`. */
const chase = (need) => ({ format: "t20", oversLimit: 20, target: 200, legal: 60, runs: 200 - need });

test("CHASE_RRR_THRESHOLD: as the asking rate reaches 8 an over, not at 7.9; again only after falling back below 7", () => {
  assert.equal(RRR_THRESHOLDS[0], 8);
  const steps = [79, 80, 81, 69].map((need) => [{}, chase(need)]);
  // Back below 7 for longer than the type's cooldown, then past 8 again: a new situation.
  steps.push(...quiet(MOMENT_RULES[MOMENT.CHASE_RRR_THRESHOLD].cooldown, chase(69)), [{}, chase(80)]);
  const results = feed(steps, MOMENT.CHASE_RRR_THRESHOLD);
  assert.deepEqual(firedAt(results), [1, steps.length - 1]);
  assert.equal(results[1][0].payload.threshold, 8);
});

test("a moment held back by its type's cooldown is said once the cooldown is over, if it's still true", () => {
  // Beaten three times by one bowler (said), then three times by another within the cooldown: held, then said.
  const other = { beaten: true, bowler: "Cy Other", bowlerShort: "Other" };
  const steps = [...Array.from({ length: 3 }, () => [{ beaten: true }, {}]), ...Array.from({ length: 3 }, () => [other, {}])];
  steps.push(...quiet(MOMENT_RULES[MOMENT.DUEL_BEATEN].cooldown), [other, {}]);
  assert.deepEqual(firedAt(feed(steps, MOMENT.DUEL_BEATEN)), [2, steps.length - 1]);
});

test("CHASE_BOUNDARY_PER_OVER: as the rate reaches 10 an over, not at 9.9", () => {
  assert.equal(BOUNDARY_RATE, 10);
  const steps = [99, 100, 101].map((need) => [{}, chase(need)]);
  assert.deepEqual(firedAt(feed(steps, MOMENT.CHASE_BOUNDARY_PER_OVER)), [1]);
});

test("CHASE_CHECKPOINT: on the ball that completes a checkpoint over, ahead or behind a par, once", () => {
  const over = CHECKPOINTS.odi[0];
  const at = (legal, runs) => [{}, { format: "odi", target: 250, legal, runs }];
  const results = feed([at(over * 6 - 1, 40), at(over * 6, 40), at(over * 6 + 1, 41)], MOMENT.CHASE_CHECKPOINT);
  assert.deepEqual(firedAt(results), [1]);
  assert.equal(results[1][0].payload.ahead, "behind");
  assert.equal(results[1][0].payload.par, 50);
});

test("PHASE_NEW_BALL: when the ball's number goes up, once", () => {
  const steps = [1, 1, 2, 2].map((n) => [{}, { ballNumber: n, ballOvers: n === 1 ? 80 : 0 }]);
  const results = feed(steps, MOMENT.PHASE_NEW_BALL);
  assert.deepEqual(firedAt(results), [2]);
  assert.equal(results[2][0].payload.overs, 80);
});

test("PHASE_REVERSE: as the ball starts to reverse (0.3), not at 0.29, once a ball", () => {
  const steps = [0.29, REVERSE_FROM, 0.4].map((reverse) => [{}, { reverse }]);
  assert.deepEqual(firedAt(feed(steps, MOMENT.PHASE_REVERSE)), [1]);
});

test("PHASE_TURN: as the pitch turns 1.35 times what it did, not at 1.34, once a match", () => {
  const steps = [1.34, TURN_FROM, 1.5].map((turnRatio) => [{}, { turnRatio }]);
  assert.deepEqual(firedAt(feed(steps, MOMENT.PHASE_TURN)), [1]);
});

test("PHASE_POWERPLAY_END: on the powerplay's last ball, not the one before", () => {
  const pp = POWERPLAY_OVERS.odi * 6;
  const steps = [pp - 1, pp, pp + 1].map((legal) => [{}, { legal }]);
  assert.deepEqual(firedAt(feed(steps, MOMENT.PHASE_POWERPLAY_END)), [1]);
});

test("PHASE_LIGHT: when the light changes, not when it stays, and not on first sight", () => {
  const steps = ["afternoon", "afternoon", "evening", "evening"].map((light) => [{}, { light }]);
  const results = feed(steps, MOMENT.PHASE_LIGHT);
  assert.deepEqual(firedAt(results), [2]);
  assert.equal(results[2][0].payload.light, "THE EVENING");
});

test("PHASE_LAST_OVER_BEFORE_BREAK: in a Test, the over before lunch (and only that over), once", () => {
  const day = (today) => [
    {},
    { format: "test", test: { quota: 90, today, day: 1, lunch: false, tea: false, oversLeft: 400, lead: 0 } },
  ];
  const results = feed([day(28), day(29), day(29), day(30)], MOMENT.PHASE_LAST_OVER_BEFORE_BREAK);
  assert.deepEqual(firedAt(results), [1]);
  assert.equal(results[1][0].payload.brk, "LUNCH");
});

test("one moment is announced a ball; the next best waits its turn, if it may", () => {
  // A new ball and reverse swing on the same ball: the new ball (higher) now, the reverse next ball.
  let memory = createMatchMemory();
  memory = update(memory, ball(), state({ ballNumber: 1 })).memory;
  const first = update(memory, ball(), state({ ballNumber: 2, reverse: 0.5 }));
  assert.equal(first.fired.length, 2);
  assert.deepEqual(
    first.moments.map((m) => m.type),
    [MOMENT.PHASE_NEW_BALL],
  );
  const second = update(first.memory, ball(), state({ ballNumber: 2, reverse: 0.5 }));
  assert.deepEqual(
    second.moments.map((m) => m.type),
    [MOMENT.PHASE_REVERSE],
  );
  assert.ok(MOMENT_RULES[MOMENT.PHASE_NEW_BALL].priority > MOMENT_RULES[MOMENT.PHASE_REVERSE].priority);
});

test("the memory is plain data, and update leaves the one it's given alone", () => {
  const memory = createMatchMemory();
  const before = JSON.stringify(memory);
  const { memory: after } = update(memory, ball({ beaten: true }), state());
  assert.equal(JSON.stringify(memory), before);
  assert.deepEqual(JSON.parse(JSON.stringify(after)), after);
  for (const type of Object.values(MOMENT)) assert.ok(MOMENT_RULES[type], type);
});

test("LETOFF_COST: a let-off that has cost 20 or more is told once more when he's out, above a wicket's remark", () => {
  const steps = [[{ letoff: "drop", batterScore: 10, fielder: "Stokesy" }, {}]];
  steps.push([{ runs: 4, batRuns: 4, batterScore: 34 }, {}]);
  steps.push(...quiet(MOMENT_RULES[MOMENT.LETOFF_COST].cooldown));
  steps.push([{ wicket: { batter: "Ann Bat", byBowler: true }, batterScore: 34 }, { wkts: 1 }]);
  const results = feed(steps, MOMENT.LETOFF_COST);
  assert.deepEqual(firedAt(results), [1, steps.length - 1]);
  const last = results.at(-1)[0];
  assert.equal(last.payload.ended, "yes");
  assert.equal(last.payload.fielder, "Stokesy");
  assert.equal(last.payload.nowOn, 34);
  assert.ok(last.priority > 80, "above the wicket's own remark");
  assert.equal(results[1][0].payload.ended, "no");
});
