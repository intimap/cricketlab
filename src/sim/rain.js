import { clamp } from "../math.js";

/**
 * Rain stopping play. At the end of each over on a showery (or cloudy) day a shower may come, rolled from
 * the match's dice since it changes the result. In a Test the overs lost come off the day, and a long
 * enough one ends it. In a limited-overs game both sides' overs are cut and the side chasing gets a revised
 * target, in proportion to the batting each side had left to use (`resources`: this game's own rule, a
 * simple curve in the spirit of the published methods, not the official tables).
 */

/** Chance per over of a stoppage in a Test, by the day's weather (sim/weather.js ids). */
const SHOWER_ODDS = { rain: 0.02, overcast: 0.004, humid: 0.003 };
/** A limited-overs game is stopped less often (about one rainy day's game in two). */
const LIMITED_ODDS = 0.6;
/** Overs a stoppage costs in a Test. */
const TEST_LOST = [6, 30];
/** A limited-overs stoppage: the share of each side's overs it costs. */
const LIMITED_LOST = [0.08, 0.25];
/** The fewest overs a side a limited-overs game is cut to. */
export const MIN_OVERS = 5;

/**
 * The share of a 50-over innings' runs a side would still score with `overs` left and `wkts` down: more
 * overs are worth less each, and wickets lost cut what's left (all out, nothing).
 */
export function resources(overs, wkts) {
  const f = Math.pow(clamp((10 - wkts) / 10), 0.7);
  if (f <= 0 || overs <= 0) return 0;
  return f * (1 - Math.exp(-overs / (30 * f)));
}

/** Does a shower come at the end of this over? (No dice are used on a dry day.) */
export function showerComes(match) {
  const odds = (SHOWER_ODDS[match.weather?.id] ?? 0) * (match.clock ? 1 : LIMITED_ODDS);
  return odds > 0 && !match.nets && match.rng.chance(odds);
}

/** How many overs a Test stoppage costs. */
export function testOversLost(rng) {
  return Math.round(rng.range(TEST_LOST[0], TEST_LOST[1]));
}

/**
 * A limited-overs stoppage at the end of an over: cut the overs and revise the chase. Returns
 * { lost, overs (a side, now), target (the chase's, if set) }, or null if the game can't be cut further.
 */
export function limitedRain(match) {
  const inn = match.inn;
  const first = match.innings.length === 1;
  const done = Math.floor(inn.legal / 6);
  const before = first ? match.overs : inn.oversLimit;
  const cut = Math.max(1, Math.round(before * match.rng.range(LIMITED_LOST[0], LIMITED_LOST[1])));
  // At least the minimum, and not fewer than the batting side has had (then its innings ends now).
  const finished = first && inn.isOver;
  const overs = Math.max(MIN_OVERS, finished ? 0 : done, before - cut);
  if (overs >= before) return null;
  const rain = (match.rain ??= { first: resources(match.overs, 0), second: null });
  const lostShare = finished ? 0 : resources(before - done, inn.wkts) - resources(overs - done, inn.wkts);
  if (first) {
    rain.first -= lostShare;
    match.overs = overs;
    if (!finished) inn.oversLimit = overs;
    return { lost: before - overs, overs };
  }
  rain.second = (rain.second ?? resources(before, 0)) - lostShare;
  inn.oversLimit = overs;
  inn.target = revisedTarget(match, match.innings[0].runs);
  return { lost: before - overs, overs, target: inn.target };
}

/** The chase's target when rain has had a say: the first side's runs scaled by the batting each had to use. */
export function revisedTarget(match, firstRuns) {
  const rain = match.rain;
  if (!rain) return firstRuns + 1;
  const second = rain.second ?? resources(match.overs, 0);
  return Math.floor((firstRuns * second) / rain.first) + 1;
}
