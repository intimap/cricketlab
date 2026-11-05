import { crossingAtZ } from "../sim/delivery.js";
import { SWING_TIME, CONTACT_Z_FRONT, CONTACT_Z_BACK, backFootShot } from "../sim/batting.js";
import { shotBearing } from "../sim/shot-direction.js";
import { strokeName, turnedBy, leaveStyle } from "../sim/strokes.js";
import { feetOf } from "../sim/feet.js";
import { BATTER_CLIPS, gamePreparationWindow } from "../render/batter/batter-motion-all.js";
import { clipForShot } from "../render/batter/batter-catalog.js";

/**
 * Presentation routing only. It reads a committed shot, never changes its result or consumes dice.
 * On a clean contact the realised label gives the intended placement; an edge's exit does not.
 */

/** The strokes with clips of their own. */
const PLAYED = new Set(["drive", "loft", "cutpull", "ramp", "sweep", "reverseSweep", "defend"]);
/** Slower than this (m/s) and it's a spinner's ball, for the smother. */
const SPIN_PACE = 28;

/**
 * The stroke the striker is shown playing: the realised one when he middled it, otherwise the one he went
 * for, named the way the sim names it (sim/strokes.js) from his feet, the ball where he met it and the shot.
 * A leave is let go, swayed or ducked by the ball's height.
 */
export function attemptedStroke(cur) {
  const type = cur.shot?.type ?? cur.swingType;
  if (!type || !cur.delivery) return null;
  const pitchZ = cur.delivery.pitchedAt?.z ?? 5;
  const feet = feetOf(cur.shot ?? { type }, pitchZ);
  const contact = cur.play?.res?.contact;
  if (type !== "leave" && !PLAYED.has(type)) return null;
  if (type !== "leave" && contact?.kind === "middle") {
    const realised = clipForShot(type, contact.shotName);
    if (realised) return realised;
  }
  const at = contact?.at ?? crossingAtZ(cur.delivery.samples, feet.stride === "back" ? CONTACT_Z_BACK : CONTACT_Z_FRONT);
  const line = at?.x ?? cur.lineAtBat;
  const height = at?.y ?? 0;
  if (type === "leave") return leaveStyle(feet, height);
  const shotLine = line - turnedBy(feet.across);
  const back = type === "cutpull" ? backFootShot(shotLine, height) : null;
  const variant = cur.shot?.variant ?? null;
  const bearing = shotBearing(type, shotLine, height, back, variant);
  const spinner = cur.delivery.speed < SPIN_PACE;
  return clipForShot(type, strokeName({ type, bearing, height, back, feet, variant, pitchZ, spinner, line: shotLine }));
}

/**
 * Clip and existing scene clock for an attack, held block or leave. No shot is disclosed before
 * commitment; the automatic leave only starts at the same passage-minus-0.22 s cue as the old pose.
 */
export function rigStroke(scene, cur) {
  if (!cur.delivery) return null;
  if (!cur.shot) {
    if (scene.human !== "bat") return null;
    return { name: "leave", type: "leave", contactAt: scene.arrival("drive"), window: 0.22, frontFoot: false };
  }
  const type = cur.shot.type ?? cur.swingType;
  const name = attemptedStroke(cur);
  if (!name) return null;
  const frontFoot = feetOf(cur.shot, cur.delivery.pitchedAt?.z ?? 5).stride !== "back";
  if (type === "defend" && Number.isFinite(cur.defendAt)) {
    const contactAt = Math.max(cur.defendAt + gamePreparationWindow(name), scene.arrival("defend", cur.shot.foot, cur.shot.feet));
    return { name, type, contactAt, window: contactAt - cur.defendAt, frontFoot };
  }
  if (type === "leave") {
    const contactAt = scene.arrival(scene.human === "bowl" ? "leave" : "drive", cur.shot.foot, cur.shot.feet);
    const start = Number.isFinite(cur.leaveAt) ? cur.leaveAt : contactAt - 0.22;
    return { name, type, contactAt, window: Math.max(0.001, contactAt - start), frontFoot: false };
  }
  if (!Number.isFinite(cur.swingAt) || !Number.isFinite(cur.backliftAt) || !SWING_TIME[type]) return null;
  const contactAt = cur.swingAt + SWING_TIME[type];
  const window = contactAt - cur.backliftAt;
  return window > BATTER_CLIPS[name].downswing ? { name, type, contactAt, window, frontFoot } : null;
}
