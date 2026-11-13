import { clamp } from "../math.js";

/**
 * A simple, deterministic estimate of the batting side's chance of winning (0..1), for the match memory's
 * turning points (sim/match-memory.js). Not a forecast to bet on: a steady yardstick, so a ball that moves it
 * a lot is a ball that mattered. One function, so a better model can replace it without touching the rest.
 *
 * state: { format ("t20", "odi", "test"), runs, wkts, legal, oversLimit, target (null batting first),
 *          test: { lead (the batting side's, before this innings' runs), oversLeft, innings (1..4) } or null }.
 */

/** Runs a ball with all ten wickets in hand, by format, and how much of that the last wickets keep. */
const RATE = { t20: 1.32, odi: 0.95, test: 0.55 };
const TAIL_KEEPS = 0.45;
/** A typical first-innings total, a ball, by format: the par a side batting first is measured against. */
const PAR_RATE = { t20: 1.32, odi: 0.9 };
/** How spread out the runs still to come are: the sd grows with the root of the balls left, plus a floor. */
const SPREAD = 1.25;
const SPREAD_FLOOR = 4;
/** Test runs a wicket in hand is worth, and how far a lead goes before it's as good as a win. */
const TEST_WICKET_RUNS = 32;
const TEST_SPREAD = 140;

/** The normal curve's area, near enough (a logistic). */
const phi = (z) => 1 / (1 + Math.exp(-1.7 * z));

/** Runs a side can expect from `balls` with `wickets` in hand. */
function expected(format, balls, wickets) {
  const keep = TAIL_KEEPS + (1 - TAIL_KEEPS) * clamp(wickets / 6);
  return balls * RATE[format] * keep * (wickets > 0 ? 1 : 0);
}

export function winProbability({ format = "odi", runs, wkts, legal, oversLimit, target = null, test = null }) {
  const wickets = Math.max(0, 10 - wkts);
  if (format === "test" || test) {
    const balls = Math.max(0, (test?.oversLeft ?? 90) * 6);
    // Chasing in the fourth innings: the target against what's left, in time and wickets.
    if (target !== null && target !== undefined) {
      const need = target - runs;
      if (need <= 0) return 1;
      if (wickets === 0) return 0;
      const can = expected("test", balls, wickets);
      return phi((can - need) / (SPREAD * Math.sqrt(Math.max(1, Math.min(balls, need * 2))) + SPREAD_FLOOR + need * 0.15));
    }
    const lead = (test?.lead ?? 0) + runs + wickets * TEST_WICKET_RUNS;
    return phi(lead / TEST_SPREAD);
  }
  const balls = Math.max(0, oversLimit * 6 - legal);
  if (target !== null && target !== undefined) {
    const need = target - runs;
    if (need <= 0) return 1;
    if (balls === 0 || wickets === 0) return 0;
    const can = expected(format, balls, wickets);
    return phi((can - need + 0.5) / (SPREAD * Math.sqrt(balls) + SPREAD_FLOOR));
  }
  // Batting first: the projected total against par.
  const par = oversLimit * 6 * (PAR_RATE[format] ?? PAR_RATE.odi);
  const projected = runs + expected(format, balls, wickets);
  return phi((projected - par) / (0.14 * par + SPREAD_FLOOR));
}
