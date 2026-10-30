import { clamp } from "../math.js";

/**
 * A batter's "eye" (every batter's, the computer's as well as the player's,
 * by the same numbers): 0..1, builds with every well-timed shot (more for one
 * perfectly middled), dents on a miss or an edge, and is lost on an air
 * swing. The better you bat, the more you get your eye in, and every shot
 * gets the bonus. Off strike it fades a little with every ball his partner
 * faces.
 */
const EYE_TIMED = 0.08;
const EYE_MIDDLED = 0.18;
/** Share of what's left kept after being beaten, and after an edge. */
const EYE_KEPT_MISS = 0.85;
const EYE_KEPT_EDGE = 0.95;
/** Lost over an over watched from the other end, a sixth for each ball (wides and no-balls too). */
const EYE_OFF_STRIKE_OVER = 0.05;
/** A well-timed block helps a little. */
const EYE_DEFENCE = 0.04;
/** Contact quality (0..1) that counts as perfectly middled. */
export const EYE_PERFECT = 0.8;
/** The multiplier at a full eye. */
export const EYE_MAX_MULT = 1.4;

/** The shot multiplier for an eye of 0..1. */
export const eyeMultiplier = (eye) => 1 + (EYE_MAX_MULT - 1) * eye;

/** The non-striker's eye after a ball bowled to his partner. */
export const offStrikeEye = (eye) => Math.max(0, eye - EYE_OFF_STRIKE_OVER / 6);

/**
 * The eye after shot `shot` (see batting.js) met the ball with result `res`.
 * Leaves and mistimed shots change nothing. A miss (beaten, bowled, on the
 * pad) costs 15% of what's left and an edge 5%; an air swing, the timing
 * nowhere near, resets it.
 */
export function nextEye(eye, shot, res) {
  // A leave, or a block to a ball too wide to reach, is let go by: no harm done.
  if (shot.type === "leave" || res.contact.missReason === "wide") return eye;
  const contact = res.contact;
  if (!res.touchedBat) return contact.missReason === "early" || contact.missReason === "late" ? 0 : eye * EYE_KEPT_MISS;
  if (contact.kind !== "middle") return eye * EYE_KEPT_EDGE;
  if (!contact.timed) return eye;
  if (shot.type === "defend") return clamp(eye + EYE_DEFENCE);
  return clamp(eye + (contact.quality >= EYE_PERFECT ? EYE_MIDDLED : EYE_TIMED));
}
