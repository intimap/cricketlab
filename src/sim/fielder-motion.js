import { clamp } from "../math.js";

/**
 * How a fielder moves, step by step: accelerating, turning, easing up as they arrive and settling
 * into a ready stance. No dice here; ball-in-play.js decides who goes where (fielder-ai.js).
 */

/** Fielder acceleration (m/s^2). */
export const FIELDER_ACCEL = 5.5;
/** How fast a fielder can turn at top speed (rad/s); slower runners turn quicker. */
const TURN_RATE = 6;
/** Turning sharply costs speed: the share lost per second per radian still to turn. */
const TURN_BLEED = 0.5;
/** Braking (m/s^2) to arrive rather than stop dead; starts about 2.5 m out from top speed. */
const DECEL = 7;
/** Within this distance (m) of the spot, and slow, a fielder is there and settles. */
const SET_RADIUS = 0.3;
/** Share of top speed while still reacting: a first step or two towards the ball. */
const REACT_CREEP = 0.3;
/** Seconds a fielder takes to see a chase is tight; with less to spare than this, they run through. */
const SPARE_TO_EASE = 0.2;

export const DIVE_TIME = 0.5;
export const DOWN_TIME = 0.5;
export const GET_UP_TIME = 0.4;
export const CROW_HOP_TIME = 0.2;

/** Fielders this close to the striker (m) walk in with the bowler; close catchers, inside CLOSE, stay put. */
const RING = 30;
const CLOSE = 15;
const WALK_IN_MIN = 1;
const WALK_IN_MAX = 2;

/** States in which a fielder doesn't move under their own steam. */
const STILL = new Set(["hold", "dive", "down", "getUp", "celebrate", "crowHop", "throw"]);

/** Distance covered in time t, starting at speed v0 and accelerating to topSpeed. */
export function runDistance(t, topSpeed, v0 = 0) {
  const start = Math.min(v0, topSpeed);
  const tTop = (topSpeed - start) / FIELDER_ACCEL;
  if (t < tTop) return start * t + 0.5 * FIELDER_ACCEL * t * t;
  return start * tTop + 0.5 * FIELDER_ACCEL * tTop * tTop + topSpeed * (t - tTop);
}

/** Seconds to cover dist from speed v0 (the inverse of runDistance). */
export function runTime(dist, topSpeed, v0 = 0) {
  const start = Math.min(v0, topSpeed);
  const tTop = (topSpeed - start) / FIELDER_ACCEL;
  const dTop = start * tTop + 0.5 * FIELDER_ACCEL * tTop * tTop;
  if (dist > dTop) return tTop + (dist - dTop) / topSpeed;
  return (-start + Math.sqrt(start * start + 2 * FIELDER_ACCEL * dist)) / FIELDER_ACCEL;
}

/**
 * Where a ring fielder has walked in to by the delivery (k = 0..1 of the run-up): 1-2 m towards the
 * striker, the closer ones less. Close catchers and the outfield stay put.
 */
export function walkInSpot(pos, k = 1) {
  const d = Math.hypot(pos.x, pos.z);
  if (d > RING || d < CLOSE) return { x: pos.x, z: pos.z };
  const walk = clamp(WALK_IN_MIN + (d - CLOSE) / (RING - CLOSE), WALK_IN_MIN, WALK_IN_MAX) * clamp(k);
  return { x: pos.x - (pos.x / d) * walk, z: pos.z - (pos.z / d) * walk };
}

export function setState(f, state, t) {
  f.state = state;
  f.stateAt = t;
}

/** Timed states run on by themselves: a dive goes down, gets up, and is back on their feet. */
function advanceStates(f, t) {
  const since = t - f.stateAt;
  if (f.state === "dive" && since > DIVE_TIME) setState(f, "down", t);
  else if (f.state === "down" && since > DOWN_TIME) setState(f, "getUp", t);
  else if (f.state === "getUp" && since > GET_UP_TIME) setState(f, f.job ?? "idle", t);
  else if (f.state === "crowHop" && since > CROW_HOP_TIME) setState(f, "throw", t);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Move fielder f on by dt towards f.target (its job's spot: an intercept on the ball's forecast path,
 * a cut-off point or the stumps). Fielders turn at a limited rate, and lose speed turning sharply;
 * with time in hand they ease up over the last few metres and settle ("set"); in a tight chase they
 * run straight through. While still reacting they edge towards it at a fraction of their pace.
 */
export function stepFielder(f, dt, t) {
  advanceStates(f, t);
  if (STILL.has(f.state) || !f.target || t < f.busyUntil) {
    if (STILL.has(f.state)) f.curSpeed = 0;
    return;
  }
  const dx = f.target.x - f.pos.x;
  const dz = f.target.z - f.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6 || (dist < SET_RADIUS && f.curSpeed < 1.5)) {
    f.curSpeed = 0;
    if (f.job && f.state !== "set") {
      setState(f, "set", t);
      f.setAt = t;
    }
    return;
  }
  if (f.state === "set" && dist > SET_RADIUS * 2) setState(f, f.job ?? "idle", t);

  let top = f.speed * (f.pace ?? 1);
  if (f.job && t < f.jobAt + f.react) top *= REACT_CREEP;
  // Ease up only with time to spare: a chaser who's only just going to make it runs through.
  const spare = f.job === "chase" && f.arriveBy != null ? f.arriveBy - t - dist / Math.max(f.curSpeed, top * 0.6) : Infinity;
  const cap = spare > SPARE_TO_EASE ? Math.min(top, Math.sqrt(2 * DECEL * Math.max(0, dist - SET_RADIUS * 0.5))) : top;

  // Turn towards the spot; from a standstill they can face any way at once.
  const want = Math.atan2(dx, dz);
  if (f.heading == null || f.curSpeed < 1) f.heading = want;
  else {
    const diff = wrap(want - f.heading);
    const rate = (TURN_RATE * f.speed) / Math.max(f.curSpeed, 1);
    f.heading = wrap(f.heading + clamp(diff, -rate * dt, rate * dt));
    f.curSpeed *= 1 - Math.min(0.5, TURN_BLEED * Math.abs(diff) * dt);
  }

  if (f.curSpeed > cap) f.curSpeed = Math.max(cap, f.curSpeed - DECEL * dt);
  else f.curSpeed = Math.min(cap, f.curSpeed + FIELDER_ACCEL * dt);
  const step = Math.min(dist, f.curSpeed * dt);
  // Close in, straight at the spot so nobody circles it.
  const hx = dist < 1 ? dx / dist : Math.sin(f.heading);
  const hz = dist < 1 ? dz / dist : Math.cos(f.heading);
  f.pos.x += hx * step;
  f.pos.z += hz * step;
}
