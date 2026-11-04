import { clamp } from "../math.js";

/**
 * The player's run-up rhythm: two taps on the bowler's last two footfalls before he leaps (the scene times
 * them from his action), then the release. Each tap is graded against its beat; the rhythm (0..1, the
 * mean of the two) sets how much of his pace he gets, how tight the line is, and whether his aftertouch is
 * earned. High effort tightens the beats but rewards a good rhythm more. The computer's bowlers have no
 * rhythm (their quality is in their release): a delivery without one is unchanged.
 */

/** Half-width (s) of a beat's window by effort: a tap inside 40% of it is perfect, outside it is off the beat. */
export const BEAT_WINDOW = { low: 0.09, med: 0.07, high: 0.05 };
const PERFECT_SHARE = 0.4;

/**
 * How good one tap was, 0..1, for an error of `error` seconds against a beat (null: no tap). `widen` scales
 * the window and `floor` is the least a tap (or a miss) is worth: the player's assist level (scenes/assists.js).
 */
export function gradeTap(error, effort, widen = 1, floor = 0) {
  if (error === null || error === undefined) return floor;
  const w = BEAT_WINDOW[effort] * widen;
  return Math.max(floor, clamp(1 - Math.max(0, Math.abs(error) - PERFECT_SHARE * w) / ((1 - PERFECT_SHARE) * w)));
}

/** The run-up's rhythm from its two taps' errors (s, or null for a beat missed). */
export function rhythmOf(errors, effort, widen = 1, floor = 0) {
  return (gradeTap(errors[0], effort, widen, floor) + gradeTap(errors[1], effort, widen, floor)) / 2;
}

/**
 * What a rhythm does to the ball: multipliers on its speed and on how far the line strays, and the share of
 * any aftertouch it earns. On the beat he is quicker and tighter, off it slower and less accurate; at high
 * effort a poor rhythm costs the extra pace and a good one tightens the line he'd otherwise spray.
 */
export function rhythmEffect(rhythm, effort) {
  // An ordinary rhythm bowls the ball as it always was; better is a bonus, worse a cost.
  const off = GOOD_RHYTHM - rhythm;
  const high = effort === "high";
  return {
    speed: 1 - 0.035 * off - (high ? 0.03 * Math.max(0, off) : 0),
    spray: (1 + 0.55 * off) * (high ? 1 - 0.25 * rhythm : 1),
    touch: clamp((rhythm - 0.4) / 0.5),
  };
}

/**
 * The rhythm at which a delivery is as it was before rhythm: an ordinary player's (about 60 ms off each beat).
 * A good one (about 35 ms) is a touch quicker and tighter.
 */
export const GOOD_RHYTHM = 0.6;
