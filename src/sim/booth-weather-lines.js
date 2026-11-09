import { byCase, voiceLines } from "./lines.js";
/**
 * The box on the weather (the report before play, and each morning of a Test), the intervals, and the
 * dressing room's call to declare. Voice order, as in the other banks: dry Bunnings, excitable Lorry,
 * tactical Grog. Lines are filled from facts and must fit the booth's box.
 */

const WEATHER = byCase("weather", voiceLines);

/** Rain before the start, said first: overs lost today (a Test) or the game cut short. */
const RAIN_LOST = voiceLines("rainLost");
const RAIN_CUT = voiceLines("rainCut");
const DAY = voiceLines("day");

const BREAKS = byCase("break", voiceLines);

const DECLARE = voiceLines("declare");

const RAIN_STOPS = voiceLines("rainStops");
const STOP_LOST = voiceLines("rainCost", "lost");
const RAIN_DAY = voiceLines("rainCost", "dayOver");
const RAIN_TARGET = voiceLines("rainCost", "target");
const RAIN_OVERS = voiceLines("rainCost", "overs");

const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? "")).toUpperCase();

/**
 * The voice's take on the day's weather. facts: { id, temp, day (a Test's), lost (overs lost today), overs
 * (a limited-overs game cut to) }.
 */
export function weatherCall(who, facts, pick) {
  const parts = [];
  if (facts.day) parts.push(pick(DAY[who]));
  if (facts.lost) parts.push(pick(RAIN_LOST[who]));
  if (facts.overs) parts.push(pick(RAIN_CUT[who]));
  parts.push(pick((WEATHER[facts.id] ?? WEATHER.sunny)[who]));
  return fill(parts.join(" "), facts);
}

/** An interval (lunch, tea or stumps). facts: { team, score, day }. */
export function breakCall(who, brk, facts, pick) {
  return fill(pick(BREAKS[brk][who]), facts);
}

/** The dressing room (through the box) says it's time to declare. */
export function declareCall(who, pick) {
  return pick(DECLARE[who]);
}

/** Rain has stopped play: the voice's first word on it. */
export function rainStopCall(who, pick) {
  return pick(RAIN_STOPS[who]);
}

/** What the rain has cost. facts: { lost, dayOver, overs (a side, limited overs), target (the revised chase) }. */
export function rainCostCall(who, facts, pick) {
  const parts = [];
  if (facts.dayOver) parts.push(pick(RAIN_DAY[who]));
  else if (facts.lost) parts.push(pick(STOP_LOST[who]));
  if (facts.target) parts.push(pick(RAIN_TARGET[who]));
  else if (facts.overs) parts.push(pick(RAIN_OVERS[who]));
  return fill(parts.join(" "), facts);
}
