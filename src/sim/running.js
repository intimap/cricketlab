import { ENDS, RUN_LENGTH, CREASE } from "./geometry.js";

/**
 * The batters' running for a ball in play (ball-in-play.js): starting and calling off runs, moving
 * them along the pitch, how long until each is home, who is at risk at each end, and the computer's
 * calls. Each takes the ball in play, whose methods of the same names call these.
 */

/** How badly computer batters misjudge a run (seconds, standard deviation, for an average runner). */
const RUN_MISJUDGE = 0.36;

export function grounded(live, runner, end) {
  return runner.target === null && runner.from === end;
}

/** Start a run (both batters). Returns false if a run can't be started now. */
export function requestRun(live) {
  if (live.dead || live.wicket || live.running || live.boundary) return false;
  const first = live.runsAttempted === 0;
  live.runStartFrom = live.runners.map((r) => r.from);
  for (const [i, r] of live.runners.entries()) {
    r.target = r.from === 0 ? 1 : 0;
    r.startAt = live.t + (first ? (i === 0 ? 0.3 : 0.06) : 0.32);
  }
  live.runsAttempted++;
  live.emit("runStart");
  return true;
}

/** Send both batters back to where they started this run. */
export function recall(live) {
  if (!live.running || !live.runStartFrom || live.dead) return false;
  for (const [i, r] of live.runners.entries()) {
    r.target = live.runStartFrom[i];
    r.from = live.runStartFrom[i] === 0 ? 1 : 0;
    r.startAt = live.t + 0.22;
  }
  live.runStartFrom = null;
  live.emit("recall");
  return true;
}

/** Seconds until `runner` is safely in at `end` (Infinity if not heading there). */
export function runnerTimeTo(live, runner, end) {
  if (runner.target === null) return runner.from === end ? 0 : Infinity;
  if (runner.target !== end) return Infinity;
  const dist = Math.abs((end === 1 ? 1 : 0) - runner.progress) * RUN_LENGTH;
  return Math.max(0, runner.startAt - live.t) + dist / runner.speed;
}

/** The batter who would be run out at `end` if the stumps were broken now. */
export function riskRunner(live, end) {
  if (live.runners.some((r) => live.grounded(r, end))) return null;
  const moving = live.runners.filter((r) => r.target !== null);
  if (!moving.length) return null;
  moving.sort((a, b) => Math.abs(a.progress - end) - Math.abs(b.progress - end));
  return moving[0];
}

export function moveRunners(live, dt) {
  let wasRunning = false;
  for (const r of live.runners) {
    if (r.target === null || live.t < r.startAt) {
      if (r.target !== null) wasRunning = true;
      continue;
    }
    wasRunning = true;
    const dir = r.target === 1 ? 1 : -1;
    r.progress += (dir * r.speed * dt) / RUN_LENGTH;
    if ((dir > 0 && r.progress >= 1) || (dir < 0 && r.progress <= 0)) {
      r.progress = r.target;
      r.from = r.target;
      r.target = null;
    }
  }
  if (wasRunning && !live.running) {
    // Both made their ground: the run counts if they actually swapped ends.
    if (
      live.runStartFrom &&
      live.runners.every((r, i) => r.from !== live.runStartFrom[i]) &&
      (!live.dead || live.wicket === null)
    ) {
      live.runs++;
      live.emit("runDone");
    }
    live.runStartFrom = null;
    live.idleSince = live.t;
    live.misjudge = null;
  }
}

/** Seconds until a thrown ball could be at `end`: a relay adds the catcher's turn and his throw on. */
function throwBack(live, end) {
  const th = live.ball.throwing;
  if (th.relayTo === undefined) return th.end === end ? th.t1 - live.t : Infinity;
  const r = live.fielders[th.relayTo].pos;
  return th.t1 - live.t + RELAY_BACK + Math.hypot(r.x - ENDS[end].x, r.z - ENDS[end].z) / AI_THROW_SPEED;
}
/** What the batters reckon a throw takes: flight speed (m/s), and a relay catcher's gather and turn (s). */
const AI_THROW_SPEED = 24;
const RELAY_BACK = 0.7;

/** Computer-controlled running: go if the run beats the ball, turn back if it won't. */
export function aiRun(live) {
  if (live.dead || live.wicket || live.boundary) return;
  const b = live.ball;
  const aggression = live.setup.aiAggression;
  if (live.running) {
    const r = live.runners[0];
    const done = r.target === 1 ? r.progress : 1 - r.progress;
    if (done < 0.4 && b.throwing) {
      // A relay could go on to either end: turn back if either is lost.
      const ends = b.throwing.relayTo !== undefined ? [0, 1] : [b.throwing.end];
      for (const end of ends) {
        if (Math.min(...live.runners.map((x) => live.runnerTimeTo(x, end))) > throwBack(live, end) + 0.5) {
          live.recall();
          break;
        }
      }
    }
    return;
  }
  if (live.plan?.kind === "catch" || live.predictedBoundary || b.atEnd !== null) return;

  // Estimated time until the ball could be back at either set of stumps.
  let ballBack = Infinity;
  const throwSpeed = 24;
  const returnTime = (pos, delay) =>
    Math.min(...[0, 1].map((e) => delay + 0.22 + Math.hypot(pos.x - ENDS[e].x, pos.z - ENDS[e].z) / throwSpeed + 0.18));
  if (b.throwing) ballBack = Math.min(throwBack(live, 0), throwBack(live, 1));
  else if (b.held >= 0) ballBack = returnTime(live.fielders[b.held].pos, Math.max(0, live.pickupAt - live.t));
  else if (live.plan) ballBack = returnTime({ x: live.plan.point.x, z: live.plan.point.z }, live.plan.t - live.t + 0.35);

  const slowest = Math.min(...live.runners.map((r) => r.speed));
  const runTime = RUN_LENGTH / slowest + (live.runsAttempted === 0 ? 0.32 : 0.36);
  const safety = 0.85 - 0.6 * aggression;
  if (live.misjudge === null) {
    const running = (live.setup.striker.bat.running + live.setup.nonStriker.bat.running) / 2;
    // Pressure makes them hurry their calls.
    live.misjudge = live.setup.rng.normal(0, RUN_MISJUDGE * (1.3 - running) * (1 + 0.5 * (live.setup.pressure ?? 0)));
  }
  if (runTime + safety < ballBack + live.misjudge) live.requestRun();
}

/** World position of a runner (striker runs on the leg side, non-striker on the off). */
export function runnerPos(live, runner) {
  return { x: runner.bat === live.setup.strikerIdx ? -1.1 : 1.1, z: CREASE + runner.progress * RUN_LENGTH };
}
