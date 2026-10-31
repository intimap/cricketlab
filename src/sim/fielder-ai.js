import { ENDS } from "./geometry.js";
import { runDistance, DOWN_TIME, GET_UP_TIME } from "./fielder-motion.js";

/**
 * Who goes for the ball, and who backs up: every fielder's best way to the ball is weighed and the
 * best one chases; a second cuts it off nearer the rope; the end most likely to see a run-out is covered.
 * Pure planning: no dice, no moving anyone.
 */

/** Seconds added per whole run spent heading away from the bat (a throw back is longer from there). */
const AWAY_PENALTY = 0.25;
/** A new chaser takes over only if this much (s) better than the one already going. */
const HYSTERESIS = 0.3;
/** Headed for the rope, a fielder chases flat out only if they'll be within this (s) of the ball. */
const BOUNDARY_CHASE = 0.4;
/** Otherwise they jog round to fetch it. */
const JOG_PACE = 0.6;
/** The second fielder backs up at this pace, and only from this close (m). */
const CUTOFF_PACE = 0.7;
const CUTOFF_RANGE = 40;
/** How far past the chaser (m) the cut-off fielder waits on the ball's line, if it runs on that far. */
const CUTOFF_BEHIND = 8;

/** Where the keeper (end 0) or bowler (end 1) stands to take a throw at the stumps. */
export const coverSpot = (end) => ({ x: ENDS[end].x + 0.4, z: ENDS[end].z + (end === 0 ? -0.6 : 0.6) });

/** A full-length dive's extra reach (m), from a fielder's reflexes (tuned from 0.6 to keep the wickets in balance). */
export const diveReach = (f) => 0.5 + 0.8 * (f.player.field.reflexes ?? 0.5);

/** When fielder f can start running (s), and how fast they're going already. */
function startOf(f, ctx) {
  let free = Math.max(ctx.t, f.busyUntil);
  if (f.state === "down") free = Math.max(free, f.stateAt + DOWN_TIME + GET_UP_TIME);
  if (f.state === "getUp") free = Math.max(free, f.stateAt + GET_UP_TIME);
  // Already chasing and past their first look: no second reaction.
  const reacting = f.job === "chase" && f.idx === ctx.chaser ? Math.max(0, f.jobAt + f.react - ctx.t) : f.react;
  return { startAt: free + reacting, v0: f.state === "down" || f.state === "getUp" ? 0 : f.curSpeed };
}

/** Share of the run (0..1) that heads away from the bat, towards the rope. */
function awayShare(from, to) {
  const rx = to.x - from.x;
  const rz = to.z - from.z;
  const run = Math.hypot(rx, rz);
  const out = Math.hypot(to.x, to.z);
  if (run < 0.5 || out < 0.5) return 0;
  return Math.max(0, (rx * to.x + rz * to.z) / (run * out));
}

/** Fielder f's best way to the ball along `path`: a catch, a stop or a dive, else fetching it. */
function optionFor(f, path, ctx, boundaryAt) {
  const { res, origin } = ctx;
  const { startAt, v0 } = startOf(f, ctx);
  const reachBonus = f.role === "keeper" ? 1.5 : 1;
  let dive = null;
  for (const p of path) {
    if (boundaryAt !== null && p.t >= boundaryAt) break;
    const travelled = Math.hypot(p.x - origin.x, p.z - origin.z);
    const catchable = res.touchedBat && !p.bounced && p.y > 0.12 && p.y < 2.7 && travelled > 2.2;
    // The keeper leaps for anything he can; others take it up to about head height.
    const fieldable = p.y < (f.role === "keeper" ? 3.3 : 2.1);
    if (!catchable && !fieldable) continue;
    const dist = Math.hypot(f.pos.x - p.x, f.pos.z - p.z);
    const covered = runDistance(Math.max(0, p.t - startAt), f.speed, v0);
    const reach = catchable ? (f.role === "keeper" ? 1.2 : 0.95) : reachBonus;
    const kind = catchable ? "catch" : res.touchedBat || res.padHit ? "stop" : f.role === "keeper" ? "collect" : "stop";
    const option = { fielder: f.idx, t: p.t, point: { x: p.x, y: p.y, z: p.z }, kind, dive: false, ballSpeed: p.v, late: 0 };
    if (dist <= reach + covered) return option;
    if (!dive && p.t > startAt && dist <= reach + covered + diveReach(f)) dive = { ...option, dive: true };
  }
  if (dive) return dive;
  // Can't cut it off: go to where it stops, or the rope.
  const end = boundaryAt !== null ? path.find((p) => p.t >= boundaryAt) : path[path.length - 1];
  if (!end || (f.role === "keeper" && boundaryAt !== null)) return null;
  // Timed at full pace, as the game always has: the batters' calls for a run are judged on this.
  const there = startAt + Math.hypot(f.pos.x - end.x, f.pos.z - end.z) / f.speed;
  return {
    fielder: f.idx,
    t: Math.max(there, end.t),
    point: { x: end.x, y: 0, z: end.z },
    kind: "pickup",
    dive: false,
    ballSpeed: 0,
    late: Math.max(0, there - end.t),
  };
}

const score = (o, f) => o.t + AWAY_PENALTY * awayShare(f.pos, o.point) + o.late;

/**
 * Plan the fielding for the ball's forecast `path`. ctx: { t, origin, res, chaser (index of whoever
 * is chasing now, or null) }. Returns { plan, predictedBoundary, jobs: [{ idx, job, target, pace }] }.
 */
export function assignFieldingRoles(fielders, path, ctx) {
  const boundaryAt = path.find((p) => p.out)?.t ?? null;
  // Everyone is weighed, not just the first who can get there.
  let best = null;
  let current = null;
  for (const f of fielders) {
    if (f.state === "dive" || f.state === "hold" || f.state === "celebrate") continue;
    const o = optionFor(f, path, ctx, boundaryAt);
    if (!o) continue;
    o.score = score(o, f);
    if (f.idx === ctx.chaser) current = o;
    if (!best || o.score < best.score) best = o;
  }
  // Don't swap chasers over a whisker.
  if (current && best !== current && best.score > current.score - HYSTERESIS) best = current;

  const jobs = [];
  const predictedBoundary = !!best && best.kind === "pickup" && boundaryAt !== null;
  if (best) {
    const pace = predictedBoundary && best.late > BOUNDARY_CHASE ? JOG_PACE : 1;
    jobs.push({ idx: best.fielder, job: "chase", target: { x: best.point.x, z: best.point.z }, pace });
  }

  // The cut-off: a second fielder on the ball's line, between the chaser and the rope.
  if (best) {
    const after = path.filter((p) => p.t > best.t && (boundaryAt === null || p.t < boundaryAt));
    const last = after[after.length - 1];
    let spot = { x: best.point.x, z: best.point.z };
    if (last) {
      const run = Math.hypot(last.x - best.point.x, last.z - best.point.z);
      const k = Math.min(1, CUTOFF_BEHIND / Math.max(run, 0.01));
      spot = { x: best.point.x + (last.x - best.point.x) * k, z: best.point.z + (last.z - best.point.z) * k };
    }
    let cutoff = null;
    let near = CUTOFF_RANGE;
    for (const f of fielders) {
      if (f.idx === best.fielder || f.role !== "field" || f.state === "down" || f.state === "dive") continue;
      const d = Math.hypot(f.pos.x - spot.x, f.pos.z - spot.z);
      if (d < near) {
        near = d;
        cutoff = f;
      }
    }
    if (cutoff) jobs.push({ idx: cutoff.idx, job: "cutoff", target: spot, pace: CUTOFF_PACE });
  }

  // Keeper and bowler get back to their stumps to take a throw. If the one at the end a throw is
  // likeliest to go to (the end nearer the ball) is busy, the nearest free fielder covers it.
  const busy = new Set(jobs.map((j) => j.idx));
  const point = best?.point ?? { x: 0, z: 0 };
  const likely =
    Math.hypot(point.x - ENDS[1].x, point.z - ENDS[1].z) < Math.hypot(point.x - ENDS[0].x, point.z - ENDS[0].z) ? 1 : 0;
  for (const end of [0, 1]) {
    const own = fielders.find((f) => f.role === (end === 0 ? "keeper" : "bowler"));
    const spot = coverSpot(end);
    if (own && !busy.has(own.idx) && own.state !== "down" && own.state !== "dive") {
      jobs.push({ idx: own.idx, job: "cover", target: spot, pace: 1, end });
      busy.add(own.idx);
    } else if (end === likely && best) {
      let stand = null;
      let near = Infinity;
      for (const f of fielders) {
        if (busy.has(f.idx) || f.role !== "field" || f.state === "down" || f.state === "dive") continue;
        const d = Math.hypot(f.pos.x - spot.x, f.pos.z - spot.z);
        if (d < near) {
          near = d;
          stand = f;
        }
      }
      if (stand) {
        jobs.push({ idx: stand.idx, job: "cover", target: spot, pace: 1, end });
        busy.add(stand.idx);
      }
    }
  }
  return { plan: best, predictedBoundary, jobs };
}
