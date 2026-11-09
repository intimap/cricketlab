import { voiceLines } from "./lines.js";
/**
 * The box's wrap-up as the scorecard comes up at the end of an innings or the match: the lead voice sums it
 * up, a second voice has the last word. Voice order: dry Bunnings, excitable Lorry, tactical Grog.
 */

const BREAK = voiceLines("wrapUp", "break");
const RESULT = voiceLines("wrapUp", "result");
const FINISH = voiceLines("wrapUp", "finish");

const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? "")).toUpperCase();

/**
 * The lead voice's wrap-up line for an innings that's just ended. facts: { team, score, chasers, need,
 * result }: a break between innings when `need` is set, a result when `result` is.
 */
export function wrapUpCall(who, facts, pick) {
  const bank = facts.need ? BREAK : facts.result ? RESULT : FINISH;
  return fill(pick(bank[who]), facts);
}
