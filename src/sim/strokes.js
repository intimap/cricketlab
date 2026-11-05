import { shotName } from "./shot-direction.js";
import { FOOTWORK_MAX } from "./feet.js";

/**
 * The stroke matrix (TODO.md, Batting): the button, the feet and the ball make the stroke.
 *
 * - Attack: a drive off the front foot (or the crease, or charging). At a ball up around the waist it's
 *   the front-foot pull. Off the back foot it's the cut, late cut, upper cut, punch, pull, hook or glance
 *   the ball calls for.
 * - Loft: a lofted drive; off the back foot, a short one hit in the air (the lofted pull, the upper cut).
 * - Improvise: the sweep (with power, the slog-sweep); across to the off side the reverse sweep (with
 *   power, the switch hit); going back, the ramp or scoop.
 * - Defend: blocks off the foot he's on. Smothered forward to a pitched-up spinner, jabbed (or dug out) on
 *   the crease, fended off when it's up at him.
 *
 * Gone right across the crease (beyond a shuffle) turns his angles: backed away, a straight one is driven
 * inside-out or cut; across to the off side, it's whipped to leg or pulled from inside the line.
 *
 * Variants the sim plays differently: "slog" (a sweep or reverse sweep hit in the air), "aerial" (a back-foot
 * shot hit in the air).
 */

/** A ball this high (m) where the front foot meets it is pulled, not driven. */
export const PULL_HEIGHT = 0.95;
/** Up at the body (m): a block becomes a fend. */
const FEND_HEIGHT = 1.15;
/** Gone this far across (m) and his angles have turned. */
const TURNED = 0.12;

/** The stroke for a button, the feet and the ball where they meet it (`ball`: { y }, or null). */
export function strokeFor(button, feet, ball = null, power = false) {
  const back = feet.stride === "back";
  if (button === "defend") return { type: "defend", foot: back ? "back" : "front" };
  if (button === "attack") return { type: back || (ball && ball.y >= PULL_HEIGHT) ? "cutpull" : "drive" };
  if (button === "loft") return back ? { type: "cutpull", variant: "aerial" } : { type: "loft" };
  if (back) return { type: "ramp" };
  const type = (feet.across ?? 0) > 0.05 ? "reverseSweep" : "sweep";
  return power ? { type, variant: "slog" } : { type };
}

/**
 * How far his feet have turned his angles (m): nothing for a shuffle across (the computer's, or the
 * player's first few centimetres), the rest of the way beyond it. The ball's line less this is the line
 * he plays it to.
 */
export const turnedBy = (across = 0) => Math.sign(across) * Math.max(0, Math.abs(across) - FOOTWORK_MAX);

/**
 * The stroke's name, as the commentary and the HUD call it: shotName's (sim/shot-direction.js), told apart
 * by the feet, the variant and the ball. `line` is the ball's line where he met it, `pitchZ` where it pitched.
 */
export function strokeName({ type, bearing, height, back, feet, variant, pitchZ = 5, spinner = false, line = 0 }) {
  const stride = feet?.stride ?? "forward";
  const across = feet?.across ?? 0;
  const forward = stride === "forward" || stride === "down";
  if (type === "defend") {
    if (height > FEND_HEIGHT && !forward) return "fend";
    if (stride === "crease") return pitchZ < 2.6 ? "dig out" : "jab";
    if (forward && spinner && pitchZ < 4.5) return "smother";
    return stride === "back" ? "back-foot defence" : "forward defence";
  }
  if (type === "cutpull") {
    if (back === "upperCut") return "upper cut";
    if (stride !== "back" && back === "punch") return shotName("drive", bearing, height, false, null);
    if (stride !== "back" && back === "pull") return "front-foot pull";
    if (back === "pull" && across > TURNED) return "pull from inside the line";
    if (back === "pull" && variant === "aerial") return "lofted pull";
    return shotName(type, bearing, height, stride === "back", back);
  }
  if (type === "drive" && stride === "back") return "back-foot drive";
  if (variant === "slog" && type === "sweep") return "slog-sweep";
  if (variant === "slog" && type === "reverseSweep") return "switch hit";
  let name = shotName(type, bearing, height, stride === "back", back);
  if (type === "drive" || type === "loft") {
    if (across < -TURNED && line <= 0.1 && bearing > 12) name = `inside-out ${name}`;
    else if (type === "drive" && across > TURNED && line > -0.05 && bearing < -40) name = "whip through midwicket";
    if (stride === "down") name = `charging ${name}`;
  }
  return name;
}

/**
 * How he leaves it, for the drawing: a ball up at him is swayed out of the way going back, ducked under
 * otherwise; anything lower he just lets go.
 */
export function leaveStyle(feet, height) {
  if (!(height > FEND_HEIGHT)) return "leave";
  return feet?.stride === "back" && height < 1.6 ? "sway" : "duck";
}
