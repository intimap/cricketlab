import { ENDS } from "./geometry.js";
import { coverSpot } from "./fielder-ai.js";
import { CROW_HOP_TIME } from "./fielder-motion.js";

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
