import { clamp } from "../math.js";

/**
 * The player's "eye": 0..1, builds with every well-timed shot (more for one
 * perfectly middled) and is lost on an air swing or a miss. The better you
 * bat, the more you get your eye in, and every shot gets the bonus.
 */
const EYE_TIMED = 0.08;
const EYE_MIDDLED = 0.18;
/** A well-timed block helps a little. */
const EYE_DEFENCE = 0.04;
/** Contact quality (0..1) that counts as perfectly middled. */
export const EYE_PERFECT = 0.8;
/** The multiplier at a full eye. */
export const EYE_MAX_MULT = 1.4;

/** The shot multiplier for an eye of 0..1. */
export const eyeMultiplier = (eye) => 1 + (EYE_MAX_MULT - 1) * eye;

/**
 * The eye after shot `shot` (see batting.js) met the ball with result `res`.
 * Leaves change nothing, nor does an edge or a mistimed shot; an air swing
 * or a miss (beaten, bowled, on the pad) resets it.
 */
export function nextEye(eye, shot, res) {
  if (shot.type === "leave") return eye;
  const contact = res.contact;
  if (!res.touchedBat) return 0;
  if (contact.kind !== "middle" || !contact.timed) return eye;
  if (shot.type === "defend") return clamp(eye + EYE_DEFENCE);
  return clamp(eye + (contact.quality >= EYE_PERFECT ? EYE_MIDDLED : EYE_TIMED));
}
