import { clamp } from "../math.js";

/**
 * How the format and the batter change the computer's game (TODO.md, Batting stream 7).
 *
 * Short games (a match's `tempo`, 1 at five overs, about 0.7 at twenty, 0.2 at fifty) are batted in a hurry:
 * fewer leaves, more lofted drives, charges and ramps, harder swings. They're bowled with a death plan
 * through the last fifth of the innings: yorkers, wide yorkers, slower balls and the odd bouncer. Tests are
 * batted patiently (leave outside off, play late) and bowled fuller in the corridor, to find the edge.
 *
 * Bowlers also read a batter's feet over the balls he's played: one who goes forward to the short ones gets
 * more of them, one who goes back to the full ones gets it fuller, and one who never moves gets the lengths mixed.
 */

/** The computer batter's style for the format: scales and chances for pickShot (sim/ai.js). */
export function battingStyle(inn) {
  const tempo = inn.tempo ?? 0;
  return {
    /** Times the usual odds of leaving a ball alone. */
    leave: inn.test ? 2 : 1 - 0.6 * tempo,
    /** Chance (times his aggression) a drive is lofted instead. */
    loft: 0.35 * tempo,
    /** Chance (times his aggression) he ramps a full one from a quick. */
    ramp: 0.06 * Math.max(0, tempo - 0.5),
    /** Chance (times his aggression and nimbleness) he charges, on top of the usual. */
    charge: 0.25 * tempo,
    /** Times his usual swing. */
    power: 1 + 0.3 * tempo,
  };
}

/** The last fifth of a limited-overs innings, short games only: the death. */
export function deathOvers(inn) {
  if (inn.test || !(inn.tempo > 0.4) || !inn.oversLimit) return false;
  return inn.legal >= inn.oversLimit * 6 * 0.8;
}

/** A death ball from a quick: { type, line, length, effort } or null to bowl his own (his repertoire `has`). */
export function deathBall(has, rng) {
  const r = rng.next();
  if (r < 0.35 && has("yorker")) return { type: "yorker", line: 0.02, length: 1.8, effort: "high" };
  if (r < 0.55 && has("yorker")) return { type: "yorker", line: 0.55, length: 2.0, effort: "high" };
  if (r < 0.72 && has("slower")) return { type: "slower", line: 0.15, length: 6, effort: "med" };
  if (r < 0.82 && has("bouncer")) return { type: "bouncer", line: -0.05, length: 11, effort: "high" };
  return null;
}

/** A Test quick pitches it this much fuller (m) than usual: up in the corridor to find the edge. */
export const TEST_FULLER = 0;

/**
 * A batter's habits of feet, as the bowlers see them over the balls he plays (not leaves): how often he's
 * forward to the shorter ones, back to the fuller ones, and stuck on the crease. Each builds by HABIT_RATE a
 * ball and is read once it passes HABIT_SHOWN, after READ_AFTER balls; then READ_ODDS of the time a bowler
 * bowls at it. Going forward to a full one, or back to a short one, is no habit: it's the right feet.
 */
const HABIT_RATE = 0.3;
const HABIT_SHOWN = 0.55;
const READ_AFTER = 8;
const READ_ODDS = 0.75;
/** Through his first PROBE_UNTIL balls, PROBE_ODDS of them test his feet. */
const PROBE_UNTIL = 30;
const PROBE_ODDS = 0.08;
/** Pitched shorter than this it's a back-foot ball, fuller than FULL_TO a front-foot one (m from his stumps). */
const SHORT_FROM = 7.2;
const FULL_TO = 5.8;

const ema = (was, now) => (was ?? 0) * (1 - HABIT_RATE) + (now ? HABIT_RATE : 0);

/** After a ball: what his feet did with it, by its length (`pitchZ`), goes into his habits. */
export function noteFeet(batter, shot, pitchZ) {
  if (!shot?.feet || shot.type === "leave") return;
  const stride = shot.feet.stride;
  if (pitchZ > SHORT_FROM) batter.forwardToShort = ema(batter.forwardToShort, stride === "forward" || stride === "down");
  if (pitchZ < FULL_TO) batter.backToFull = ema(batter.backToFull, stride === "back");
  batter.onCrease = ema(batter.onCrease, stride === "crease");
}

/**
 * The length (m from his stumps) a bowler bowls at a habit he's read, or null: short at one who goes forward
 * to them, full at one who goes back to them, and full or short at one who never moves.
 */
export function lengthAgainstFeet(batter, spinner, rng) {
  const forward = batter.forwardToShort ?? 0;
  const back = batter.backToFull ?? 0;
  const still = batter.onCrease ?? 0;
  const worst = Math.max(forward, back, still);
  // Early in his innings, with nothing read yet, the odd one tests him: short, or right up.
  if (worst < HABIT_SHOWN && (batter.balls ?? 0) < PROBE_UNTIL && rng.chance(PROBE_ODDS))
    return rng.chance(0.5) ? (spinner ? 7 : 9.2) : spinner ? 3.6 : 3.2;
  if ((batter.balls ?? 0) < READ_AFTER || !rng.chance(READ_ODDS)) return null;
  if (worst < HABIT_SHOWN) return null;
  if (worst === forward) return spinner ? 7 : 9.2 + rng.normal(0, 0.5);
  if (worst === back) return spinner ? 3.6 : 3.2 + rng.normal(0, 0.4);
  return rng.chance(0.5) ? (spinner ? 3.8 : 3.4) : spinner ? 6.8 : 9;
}

/** Shot power as the computer swings it in this format (charge 0..1 before AI_SHOT_POWER). */
export const styledCharge = (charge, style) => clamp(charge * style.power, 0, 1);
