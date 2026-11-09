import { voiceLines } from "./lines.js";
/**
 * The box on the umpire's warnings for too many bouncers (Law 41.6): the first and final warning, then the
 * bowler taken off for the innings. Voice order, as in the other banks: dry Bunnings, excitable Lorry,
 * tactical Grog.
 */

const WARNING = voiceLines("warning", "warning");
const SUSPENDED = voiceLines("warning", "suspended");

const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? "")).toUpperCase();

/** The voice's call on the umpire's word ("warning" or "suspended") to bowler `w`. */
export function warningCall(who, kind, facts, pick) {
  return fill(pick((kind === "suspended" ? SUSPENDED : WARNING)[who]), facts);
}
