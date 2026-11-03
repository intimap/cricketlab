import { clamp } from "../math.js";

/** Which shot suits which ball: front or back foot, how well a shot fits, the back-foot shot a ball calls for. */

export const isSweep = (type) => type === "sweep" || type === "reverseSweep";

/**
 * Does this shot go back (true) or forward? The attacking shots carry their
 * foot; defence follows the player's choice (`foot`), or the length for the
 * computer when it hasn't said; leaves follow the length.
 */
export function playsBack(type, foot, pitchZ) {
  if (type === "cutpull" || type === "ramp") return true;
  if (type === "defend") return foot ? foot === "back" : pitchZ > 6.8;
  if (type === "leave") return pitchZ > 7;
  return false;
}

/**
 * 0..1: how well the chosen shot suits the ball (height at contact, pitching
 * length, line). `foot` is the defence's foot ("front"/"back").
 */
export function shotSuitability(type, height, pitchZ, line, spinner, foot = null) {
  let s = 1;
  // A yorker at the toes can be dug out, but it's very hard to hit.
  if (pitchZ > 1.2 && pitchZ < 2.6 && !spinner && type !== "defend" && type !== "leave") s -= 0.5;
  if (type === "drive") {
    if (height > 0.95) s -= (height - 0.95) * 1.3;
    if (pitchZ > 8) s -= 0.35;
    if (line > 0.6) s -= 0.3;
    if (line < -0.3) s -= 0.15;
  } else if (type === "cutpull") {
    if (pitchZ < 6 && pitchZ > 1.3) s -= 0.5;
    if (height < 0.45) s -= 0.35;
    if (line > 0.2 && line < 0.32) s -= 0.15;
    // No width and not much bounce: only a punch down the ground, and that's a risk.
    if (line <= 0.2 && line > -0.1 && height < 0.8) s -= 0.2;
    // Above the shoulder it's very hard to keep down.
    if (height > 1.55) s -= 0.45;
  } else if (type === "loft") {
    if (pitchZ > 6.5) s -= 0.4;
    if (height > 1) s -= 0.3;
    if (spinner) s += 0.1;
  } else if (type === "ramp") {
    // Needs pace to work with, and a ball short enough to get under.
    s -= 0.25;
    if (spinner) s -= 0.45;
    if (pitchZ < 4.5) s -= 0.4;
    if (height < 0.5) s -= 0.3;
    if (height > 1.4) s -= 0.2;
  } else if (isSweep(type)) {
    // A spinner's shot: full and low. Against pace or bounce it's a gamble.
    if (!spinner) s -= 0.55;
    if (pitchZ > 7) s -= 0.45;
    if (height > 0.9) s -= 0.4;
    if (type === "reverseSweep") s -= 0.1;
  } else if (type === "defend") {
    if (height > 1.35) s = 0.5;
    if (line > 0.6) s = Math.min(s, 0.8);
    // The wrong foot: forward to a short one (it climbs at the splice), back to a full one (stuck on the crease).
    const back = playsBack(type, foot, pitchZ);
    if (!back && pitchZ > 7.5) s -= 0.3 + (height > 1 ? 0.2 : 0);
    if (back && pitchZ < 5) s -= 0.45;
  }
  return clamp(s, 0.15, 1);
}

/**
 * Which back-foot shot a ball calls for, from its line and height at the bat:
 * "cut" with width outside off, "punch" (back-foot drive) with no width and
 * not much bounce, "glance" off the hip down leg, otherwise "pull" (a hook
 * when it's up around the head).
 */
export function backFootShot(line, height) {
  if (line > 0.24) return "cut";
  if (line > -0.12 && height < 1) return "punch";
  if (line < -0.3 && height < 0.95) return "glance";
  return "pull";
}
