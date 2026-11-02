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
/** Then the release (s): quick from a set stance, a touch slower on the move. */
const RELEASE_SET = 0.25;
const RELEASE_MOVING = 0.3;
/** Throws longer than this (m) take a crow-hop first. */
export const CROW_HOP_FROM = 30;
/** Arc and gather time on top of the flight (s). */
const THROW_EXTRA = 0.18;
/** With no run on, or no chance of one, a throw's margin (s) worse than this goes to the safe end. */
const NO_CHANCE = -0.25;

/** Seconds from reaching the ball to having it in hand, ready to throw. */
export function gatherDelay(dived) {
  return GATHER + (dived ? GATHER_AFTER_DIVE : 0);
}

const throwSpeed = (f) => 19 + 11 * f.player.field.arm;

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
  const releaseAt = (e) => t + (ctx.wasSet ? RELEASE_SET : RELEASE_MOVING) + (dists[e] > CROW_HOP_FROM ? CROW_HOP_TIME : 0);
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
  if (!chance) end = 0;
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

// --- The throw arrives: a run-out, a gather at the stumps, or one that runs on (ball-in-play.js calls these) ---

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
