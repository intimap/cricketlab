import { byCase, voiceLines } from "./lines.js";
/**
 * The box through an LBW decision and a DRS review, in stages: the on-field call, the review, the
 * ball-tracking, the verdict (with umpire's call explained). Reads the decision and tracking; decides
 * nothing. Voice order: dry Bunnings, excitable Lorry, tactical Grog.
 */

const ON_FIELD = byCase("onField", voiceLines);
const REVIEWING = byCase("review", voiceLines);
/** Ball-tracking, by its reason (sim/match.js tracking). */
const TRACKING = byCase("tracking");
const VERDICT = byCase("verdict", voiceLines);

const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? `{${k}}`)).toUpperCase();

/** The umpire's decision as it's given. */
export const onFieldCall = (who, out, facts, pick) => fill(pick(ON_FIELD[out ? "out" : "notOut"][who]), facts);

/** A review is called for, by "bat" or "bowl". */
export const reviewCall = (who, by, facts, pick) => fill(pick(REVIEWING[by][who]), facts);

/** The ball-tracking, said as it plays. */
export const trackingCall = (reason, pick) => pick(TRACKING[reason] ?? TRACKING["WICKETS: MISSING"]);

/** The verdict: out or not after the review, against what was given on the field. */
export function verdictCall(who, { onField, out, verdict }, facts, pick) {
  const kind =
    verdict === "umpiresCall" ? "umpiresCall" : out === onField ? "stands" : out ? "overturnedOut" : "overturnedNotOut";
  return fill(pick(VERDICT[kind][who]), facts);
}
