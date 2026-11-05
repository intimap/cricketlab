import { STANCE_X } from "./feet.js";

/**
 * The footwork word by the timing meter (TODO.md, Batting): what his feet did with this ball, judged from
 * where they met it (the shot's resolved feet, `res.feet` from sim/batting.js), the length and the result.
 * The nets coach says the same, with a tip.
 */

export const FOOTWORK_WORDS = Object.freeze({
  goodStride: "GOOD STRIDE",
  crease: "CAUGHT ON THE CREASE",
  wrongFoot: "WRONG FOOT",
  acrossLine: "ACROSS THE LINE",
  outOfReach: "OUT OF REACH",
  room: "ROOM TO WORK",
});

/** Pitched fuller than this (m from his stumps) wants the front foot; shorter than BACK_FROM, the back. */
const FORWARD_TO = 6.2;
const BACK_FROM = 7.6;
/** Less of a stride than this and he was caught on the crease. */
const HALF_MADE = 0.75;
/** Gone this far across to the off side (m) with the ball passing behind his legs: across the line. */
const ACROSS = 0.12;
/** Backed away this far (m) with the ball this far outside his body: room to work. */
const BACKED_AWAY = 0.1;
const ROOMY = 0.25;
/** Shots played from where they're played (down on a knee, laid back): the length doesn't pick their feet. */
const OWN_FEET = new Set(["sweep", "reverseSweep", "ramp"]);

/** Which stride the length wants: "forward", "back", or "either". */
export function wantedStride(pitchZ) {
  return pitchZ < FORWARD_TO ? "forward" : pitchZ > BACK_FROM ? "back" : "either";
}

/** The word for this ball's feet: { key, text, good }, or null for a leave or a shot that says nothing. */
export function footworkWord(res, shotType, pitchZ) {
  const feet = res?.feet;
  if (!feet || !shotType || shotType === "leave") return null;
  const word = (key, good) => ({ key, text: FOOTWORK_WORDS[key], good });
  if (res.contact?.outOfReach) return word("outOfReach", false);
  const fromBody = feet.line === null ? 0 : feet.line - (STANCE_X + feet.across);
  if (feet.across > ACROSS && fromBody < -0.05) return word("acrossLine", false);
  const want = wantedStride(pitchZ);
  const forward = feet.stride === "forward" || feet.stride === "down";
  if (!OWN_FEET.has(shotType) && ((want === "forward" && feet.stride === "back") || (want === "back" && forward)))
    return word("wrongFoot", false);
  if (!OWN_FEET.has(shotType) && (feet.stride === "crease" || feet.made < HALF_MADE)) return word("crease", false);
  if (feet.across < -BACKED_AWAY && fromBody > ROOMY) return word("room", true);
  return word("goodStride", true);
}

/** What the coach tells him about it. */
export function footworkTip(word, pitchZ) {
  switch (word?.key) {
    case "outOfReach":
      return "OUT OF REACH: LET THOSE GO, OR GET ACROSS TO THEM FIRST.";
    case "acrossLine":
      return "ACROSS THE LINE: YOU WENT TOO FAR OVER. THE STUMPS AND PADS WERE IN ITS PATH.";
    case "wrongFoot":
      return pitchZ > BACK_FROM ? "WRONG FOOT: THAT WAS SHORT. GO BACK TO IT." : "WRONG FOOT: THAT WAS PITCHED UP. GET FORWARD.";
    case "crease":
      return "CAUGHT ON THE CREASE: MOVE YOUR FEET SOONER. PUSH AS IT LEAVES THE HAND.";
    default:
      return "";
  }
}
