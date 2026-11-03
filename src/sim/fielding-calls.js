/**
 * The player's calls while their side fields (scenes/player-actions.js sends them): a press timed to a catch
 * arriving, and which end a throw goes to. Both are optional: without them the fielders do as they would.
 * No dice here: a press changes the odds of the catch, not the roll.
 */

/** A press this close (s) to the ball arriving helps; this far off, or later, it hurts. */
const PRESS_GOOD = 0.08;
const PRESS_BAD = 0.22;
/** Presses longer than this (s) before the catch don't count as being for it. */
const PRESS_WINDOW = 0.6;
export const PRESS_BONUS = 0.08;
export const PRESS_PENALTY = 0.12;

/** How a press for the catch planned in `plan` changes its chance: + for good timing, - for bad, 0 without one. */
export function catchPressEffect(live, plan) {
  const at = live.catchPressAt;
  if (at === null || at === undefined || plan.t - at > PRESS_WINDOW) return 0;
  const off = Math.abs(at - plan.t);
  return off <= PRESS_GOOD ? PRESS_BONUS : off >= PRESS_BAD ? -PRESS_PENALTY : 0;
}

/** The end (0 striker's, 1 bowler's) the player has called the next throw to, or null to leave it to the fielder. */
export function calledEnd(live) {
  return live.calledEnd ?? null;
}
