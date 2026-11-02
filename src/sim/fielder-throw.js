import { ENDS } from "./geometry.js";
import { coverSpot } from "./fielder-ai.js";
import { clamp } from "../math.js";
import { CROW_HOP_TIME, setState } from "./fielder-motion.js";

/**
 * Getting the ball back: how long a fielder takes to release it, which end they throw to, and how
 * the throw goes (a shy at the stumps, or wild). Dice come from the match's rng, passed in.
 */

/** Gathering the ball cleanly (s), and the extra to get up and gather after a dive. */
const GATHER = 0.35;
const GATHER_AFTER_DIVE = 0.35;
/** Then the release (s) for a full throw: quick from a set stance, a touch slower on the move. */
const RELEASE_SET = 0.25;
const RELEASE_MOVING = 0.3;
/** A short throw needs less wind-up: a flick at the stumps takes this share of a full release. */
const FLICK_SHARE = 0.4;
/** Throws longer than this (m) take a crow-hop first. */
export const CROW_HOP_FROM = 30;
/** Arc and gather time on top of the flight (s). */
const THROW_EXTRA = 0.18;
/** A batter within this (s) of being run out gets a throw at the stumps; otherwise the ball goes back to the bowler. */
const NO_CHANCE = -1;
/** A relay catcher gathers and turns to throw on in this (s). */
const RELAY_TURN = 0.3;

/** Seconds from reaching the ball to having it in hand, ready to throw. */
export function gatherDelay(dived) {
  return GATHER + (dived ? GATHER_AFTER_DIVE : 0);
}

const throwSpeed = (f) => 19 + 11 * f.player.field.arm;

/** Share of a full wind-up a throw of `dist` m needs: a flick close in, all of it from 30 m. */
export const windUp = (dist) => FLICK_SHARE + (1 - FLICK_SHARE) * clamp(dist / CROW_HOP_FROM);

/** Seconds from ball in hand to release for a throw of `dist` m, with a crow-hop beyond 30 m. */
function releaseTime(dist, wasSet) {
  return (wasSet ? RELEASE_SET : RELEASE_MOVING) * windUp(dist) + (dist > CROW_HOP_FROM ? CROW_HOP_TIME : 0);
}

/** Is someone covering `end`, backing up the throw? */
function covered(fielders, end, thrower) {
  const spot = coverSpot(end);
  return fielders.some(
    (x) => x.idx !== thrower && (x.job === "cover" || x.state === "set") && Math.hypot(x.pos.x - spot.x, x.pos.z - spot.z) < 4,
  );
}

/**
 * Plan fielder f's throw at time t (ctx: { t, running, runners, runnerTimeTo, fielders, wasSet,
 * offBalance, rng }). The end is the one where a batter is likeliest to be run out (the ball beats him by most),
 * else the keeper's. Returns the throw for ball-in-play.js to fly.
 */
export function planThrow(f, ctx) {
  const { t, rng } = ctx;
  const speed = throwSpeed(f);
  const dists = [0, 1].map((e) => Math.hypot(f.pos.x - ENDS[e].x, f.pos.z - ENDS[e].z));
  const releaseAt = (e) => t + releaseTime(dists[e], ctx.wasSet);
  const arrival = dists.map((d, e) => releaseAt(e) + d / speed + THROW_EXTRA);

  // The end where the ball beats a batter home by most (the smallest margin he has left).
  let end = 0;
  let margin = -Infinity;
  if (ctx.running) {
    for (const e of [0, 1]) {
      const safeIn = Math.min(...ctx.runners.map((r) => ctx.runnerTimeTo(r, e)));
      if (safeIn === 0 || safeIn === Infinity) continue;
      const beatenBy = safeIn - (arrival[e] - t);
      if (beatenBy > margin) {
        margin = beatenBy;
        end = e;
      }
    }
  }
  const chance = ctx.running && margin > NO_CHANCE;
  // No run-out on: back to the bowler's end. From the deep it goes through the nearest fielder first,
  // if he's closer than the stumps.
  if (!chance) {
    end = 1;
    const deep = f.role === "field" && !f.relayed && dists[1] > CROW_HOP_FROM;
    const relay = deep ? relayCatcher(f, ctx.fielders, dists[1]) : null;
    if (relay) {
      const dist = Math.hypot(f.pos.x - relay.pos.x, f.pos.z - relay.pos.z);
      const t0 = t + releaseTime(dist, ctx.wasSet);
      return { relayTo: relay.idx, end: null, t0, hop: dist > CROW_HOP_FROM, arriveAt: t0 + dist / speed + THROW_EXTRA, dist };
    }
  }
  // Keeper and bowler don't throw to their own end.
  if ((end === 0 && f.role === "keeper") || (end === 1 && f.role === "bowler")) end = end === 0 ? 1 : 0;

  const dist = dists[end];
  const t0 = releaseAt(end);
  const hop = dist > CROW_HOP_FROM;
  const wildOdds = Math.max(0, 0.2 - 0.18 * f.player.field.throwAcc) * (1 + dist / 50) * (ctx.offBalance ? 1.5 : 1);
  const wild = rng.chance(Math.min(0.9, wildOdds));
  let arriveAt = arrival[end] + (wild ? rng.range(0.3, 0.9) : 0);
  const shyOdds = (dist < 20 ? 0.7 : dist < 35 ? 0.45 : dist < 50 ? 0.2 : 0.05) * (margin > 2.5 ? 0.6 : 1);
  // A shy at the stumps: quicker, but may miss.
  const shy = chance && f.role === "field" && !wild && rng.chance(shyOdds);
  if (shy) arriveAt -= 0.06;
  return {
    end,
    t0,
    hop,
    arriveAt,
    shy,
    wild,
    dist,
    // A wild one runs on for overthrows only if nobody is backing up at that end.
    overthrow: wild && !covered(ctx.fielders, end, f.idx),
  };
}

const BUSY = new Set(["dive", "down", "getUp", "crowHop", "throw"]);

/** The nearest fielder on his feet who's closer to `f` than the bowler's stumps (`toStumps` m), or null. */
function relayCatcher(f, fielders, toStumps) {
  let best = null;
  let gap = toStumps;
  for (const x of fielders) {
    // On his feet, and not the one backing up at the stumps.
    if (x.idx === f.idx || x.role !== "field" || x.job === "cover" || BUSY.has(x.state)) continue;
    const d = Math.hypot(x.pos.x - f.pos.x, x.pos.z - f.pos.z);
    if (d < gap) {
      gap = d;
      best = x;
    }
  }
  return best;
}

/** No run-out on: a flat throw to the nearest fielder, who stops to take it and throws on to the bowler. */
export function relayThrow(live, f, th) {
  const r = live.fielders[th.relayTo];
  r.target = { x: r.pos.x, z: r.pos.z };
  setState(r, "hold", live.t);
  live.ball.throwing = {
    from: { x: f.pos.x, y: 1.6, z: f.pos.z },
    to: { x: r.pos.x, y: 1.3, z: r.pos.z },
    t0: th.t0,
    t1: th.arriveAt - 0.12,
    end: null,
    relayTo: r.idx,
    fielder: f.idx,
    dist: th.dist,
  };
  live.ball.held = -1;
  f.dived = false;
  setState(f, th.hop ? "crowHop" : "throw", live.t);
  live.emit("throw", { fielder: f.idx, end: null, text: "" });
}

// --- The throw arrives: a run-out, a gather at the stumps, or one that runs on (ball-in-play.js calls these) ---

/** A relay reaches the fielder it was thrown to: he gathers and turns to throw on (see planThrow). */
export function arriveAtFielder(live, receiver) {
  live.ball.throwing = null;
  live.ball.held = receiver.idx;
  live.ball.atEnd = null;
  live.ball.vel = { x: 0, y: 0, z: 0 };
  receiver.relayed = true;
  live.pickupAt = live.t + RELAY_TURN;
  live.emit("gather", { fielder: receiver.idx });
}

export function arriveAtEnd(live, end, thrower) {
  const th = live.ball.throwing;
  live.ball.throwing = null;
  const rng = live.setup.rng;
  const f = live.fielders[thrower];
  const atRisk = live.riskRunner(end);

  // Wild, and nobody backing up: it runs on past the stumps for overthrows.
  if (th.overthrow) {
    live.runOn(th, end, thrower, "overthrow");
    return;
  }

  if (th.shy && atRisk) {
    const hitChance = clamp(0.3 + 0.4 * f.player.field.throwAcc - th.dist / 90, 0.06, 0.6);
    if (rng.chance(hitChance)) {
      live.ball.atEnd = end;
      live.ball.held = -1;
      live.ball.vel = { x: 0, y: 0, z: 0 };
      live.runOut(atRisk, end, thrower, "direct hit");
      return;
    }
    // Missed: the ball runs on past the stumps.
    live.nearMiss = { shy: true };
    live.runOn(th, end, thrower, "missed the stumps");
    return;
  }

  live.ball.atEnd = end;
  live.ball.thrownIn = true;
  // Whoever is nearest the stumps takes the throw; if they aren't there yet they must run in.
  const spot = coverSpot(end);
  let receiver = null;
  let gap = Infinity;
  for (const x of live.fielders) {
    if (x.idx === thrower || x.state === "down" || x.state === "dive" || x.state === "getUp") continue;
    const d = Math.hypot(x.pos.x - spot.x, x.pos.z - spot.z);
    if (d < gap) {
      gap = d;
      receiver = x;
    }
  }
  // Seconds before the receiver can break the stumps.
  const getThere = receiver ? Math.max(0, gap - 1.2) / receiver.speed : 3;
  live.ball.held = receiver ? receiver.idx : -1;
  if (receiver) {
    receiver.target = spot;
    receiver.job = "cover";
    if (receiver.state !== "set") setState(receiver, "cover", live.t);
  }
  live.ball.vel = { x: 0, y: 0, z: 0 };
  live.emit("gather", { end });
  live.breakDelay = 0.28 + getThere;

  if (atRisk) {
    const hands = receiver ? (receiver.role === "keeper" ? receiver.player.field.keeping : receiver.player.field.catching) : 0.5;
    // Taking it on the run is harder than standing over the stumps.
    const onTheRun = 1 + Math.min(1, getThere);
    const fumbleChance = clamp((th.wild ? 0.35 : 0.12) * (1.4 - hands) * onTheRun, 0.03, 0.6);
    if (rng.chance(fumbleChance)) {
      live.breakDelay = getThere + rng.range(0.5, 1.2);
      live.emit("fumble", { fielder: receiver?.idx, end, text: "fumbled" });
    } else {
      live.breakDelay = getThere + rng.range(0.15, 0.45) + (th.wild ? rng.range(0.15, 0.45) : 0);
    }
    live.riskSince = live.t;
    live.idleSince = live.t;
    return;
  }

  live.idleSince = live.t;
  live.riskSince = null;
  // Nobody in danger here; if the other end is still open, relay the ball on.
  if (live.running && receiver) {
    const other = end === 0 ? 1 : 0;
    const safeIn = Math.min(...live.runners.map((r) => live.runnerTimeTo(r, other)));
    if (safeIn > 1.25 && safeIn !== Infinity) {
      live.ball.atEnd = null;
      live.pickupAt = live.t + 0.1 + getThere;
      setState(receiver, "hold", live.t);
      receiver.job = null;
    }
  }
}

/** A throw that got past the stumps (a missed shy, or wild with no one backing up) runs on. */
export function runOn(live, th, end, thrower, text) {
  const rng = live.setup.rng;
  const dx = th.to.x - th.from.x;
  const dz = th.to.z - th.from.z;
  const len = Math.hypot(dx, dz) || 1;
  const speed = rng.range(7, 15);
  live.ball.atEnd = null;
  live.ball.held = -1;
  live.ball.bounced = true;
  live.ball.pos = { x: ENDS[end].x + rng.normal(0, 0.4), y: 0.3, z: ENDS[end].z };
  live.ball.vel = { x: (dx / len) * speed + rng.normal(0, 1.5), y: 0, z: (dz / len) * speed };
  live.riskSince = null;
  live.emit("misfield", { fielder: thrower, end, text });
  live.replan();
}

export function runOut(live, runner, end, fielderIdx, text = "") {
  const f = live.fielders[fielderIdx];
  live.emit("runout", { end, who: runner.bat, fielder: fielderIdx, text });
  live.endWithWicket({
    how: "runout",
    batter: runner.bat,
    fielder: f ? (f.role === "field" ? f.spot : f.role === "keeper" ? "the keeper" : "the bowler") : "",
  });
}
