import test from "node:test";
import assert from "node:assert/strict";
import {
  requestRun,
  queueRun,
  recall,
  dive,
  atRisk,
  canDive,
  moveRunners,
  runnerTimeTo,
  DIVE_RANGE,
  DIVE_GAIN,
  DIVE_DOWN,
} from "../src/sim/running.js";
import { RUN_LENGTH, ENDS } from "../src/sim/geometry.js";
import { runnerSpot } from "../src/scenes/match-positions.js";

/** Just enough of a ball in play for the running: two batters, a clock and its events. */
function fakeLive() {
  const live = {
    t: 0,
    dead: false,
    wicket: null,
    boundary: 0,
    runs: 0,
    runsAttempted: 0,
    runStartFrom: null,
    events: [],
    runners: [
      { bat: 0, progress: 0, target: null, from: 0, startAt: 0, speed: 7 },
      { bat: 1, progress: 1, target: null, from: 1, startAt: 0, speed: 7 },
    ],
    emit(type) {
      this.events.push(type);
    },
    get running() {
      return this.runners.some((r) => r.target !== null);
    },
  };
  return live;
}

/** Run the clock on by `seconds` in small steps. */
function advance(live, seconds, onStep = () => {}) {
  for (let i = 0; i < Math.round(seconds / 0.01); i++) {
    live.t += 0.01;
    moveRunners(live, 0.01);
    onStep();
  }
}

/** Ball time when the striker is first home at the far end. */
function homeAt(live, diveWhenClose) {
  requestRun(live);
  let at = null;
  advance(live, 5, () => {
    if (diveWhenClose && live.runners[0].target !== null) dive(live, [live.runners[0]]);
    if (at === null && live.runners[0].target === null) at = live.t;
  });
  return at;
}

test("a batter can dive only on his way and within range of the crease he's making for", () => {
  const live = fakeLive();
  const r = live.runners[0];
  assert.equal(canDive(live, r), false);
  requestRun(live);
  advance(live, 0.4);
  assert.equal(canDive(live, r), false, "too far out");
  r.progress = 1 - (DIVE_RANGE - 0.2) / RUN_LENGTH;
  assert.equal(canDive(live, r), true);
  assert.ok(dive(live, [r]));
  assert.equal(canDive(live, r), false, "already diving");
  assert.ok(live.events.includes("dive"));
});

test("a dive gets him home sooner, then he's down before he can run again", () => {
  const walked = homeAt(fakeLive(), false);
  const live = fakeLive();
  const dived = homeAt(live, true);
  const gain = DIVE_GAIN / 7;
  assert.ok(Math.abs(walked - dived - gain) < 0.03, `${walked} - ${dived} vs ${gain}`);
  assert.ok(live.events.includes("diveHome"));
  assert.ok(Math.abs(live.runners[0].downUntil - (dived + DIVE_DOWN)) < 0.02);
  // Called for another the moment he's home: he can't go till he's up; his partner goes off the turn.
  const quick = fakeLive();
  requestRun(quick);
  while (quick.runners[0].target !== null || quick.runners[1].target !== null) {
    quick.t += 0.01;
    moveRunners(quick, 0.01);
    if (quick.runners[0].target !== null) dive(quick, [quick.runners[0]]);
  }
  const up = quick.runners[0].downUntil;
  requestRun(quick);
  assert.ok(quick.runners[0].startAt >= up - 1e-9);
  assert.ok(quick.runners[1].startAt < up);
  // The time home counts the dive while he's diving.
  const again = fakeLive();
  requestRun(again);
  advance(again, 0.5);
  const r = again.runners[0];
  r.progress = 0.9;
  const before = runnerTimeTo(again, r, 1);
  dive(again, [r]);
  assert.ok(Math.abs(before - runnerTimeTo(again, r, 1) - gain) < 1e-9);
});

test("keep running: the next run starts as they make this one, and turning back cancels it", () => {
  const live = fakeLive();
  requestRun(live);
  assert.ok(queueRun(live));
  assert.ok(queueRun(live));
  advance(live, 12);
  assert.equal(live.runs, 3);
  assert.equal(live.queuedRuns, 0);
  // Asked for another, then sent back: just the one they were on, abandoned.
  const back = fakeLive();
  requestRun(back);
  queueRun(back);
  advance(back, 0.6);
  assert.ok(recall(back));
  assert.equal(back.queuedRuns, 0);
  advance(back, 5);
  assert.equal(back.runs, 0);
  // Nothing to keep running from when they're not running.
  assert.equal(queueRun(fakeLive()), false);
});

test("the player's dive: only the batter in danger dives, not both", () => {
  /** Both batters close to home on a single (the striker 1.8 m out, his partner, off first, nearer), the ball where `ball` says. */
  const nearlyIn = (ball) => {
    const live = fakeLive();
    requestRun(live);
    advance(live, 0.3 + (RUN_LENGTH - 1.8) / 7);
    live.ball = { held: -1, ...ball };
    assert.ok(
      live.runners.every((r) => canDive(live, r)),
      "both could dive",
    );
    return live;
  };
  // Thrown to the bowler's end: the one making for it dives.
  let live = nearlyIn({ throwing: { end: 1, t1: 0.2 } });
  live.ball.throwing.t1 += live.t;
  assert.deepEqual(atRisk(live), [live.runners[0]]);
  assert.ok(dive(live, atRisk(live)));
  assert.ok(live.runners[0].diving && !live.runners[1].diving);
  // Thrown to the keeper's end: the other one.
  live = nearlyIn({ throwing: { end: 0, t1: 0.2 } });
  live.ball.throwing.t1 += live.t;
  assert.deepEqual(atRisk(live), [live.runners[1]]);
  // Loose near the keeper's end: the one making for it.
  live = nearlyIn({ pos: { x: ENDS[0].x + 3, z: ENDS[0].z + 2 } });
  assert.deepEqual(atRisk(live), [live.runners[1]]);
});

test("on the wide view the non-striker angles into his lane and stays in it once home", () => {
  const scene = { cur: { delivery: {} }, phase: "flight" };
  const live = fakeLive();
  live.setup = { strikerIdx: 0, nonStrikerIdx: 1 };
  live.runnerPos = (r) => ({ x: r.bat === 0 ? -1.1 : 1.1, z: 1.22 + r.progress * RUN_LENGTH });
  const standX = -1.05;
  const non = live.runners[1];
  assert.equal(runnerSpot(scene, live, non, standX).x, standX, "standing out of the bowler's way");
  non.progress = 0.95;
  const setting = runnerSpot(scene, live, non, standX).x;
  assert.ok(setting > standX && setting < 1.1, "angling across as he sets off");
  non.progress = 0.5;
  assert.equal(runnerSpot(scene, live, non, standX).x, 1.1);
  // Sent back, and home again: still in his lane, no jump across.
  non.progress = 1;
  assert.equal(runnerSpot(scene, live, non, standX).x, 1.1);
});
