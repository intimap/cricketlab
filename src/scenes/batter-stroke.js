import { crossingAtZ } from "../sim/delivery.js";
import { SWING_TIME, CONTACT_Z_FRONT, CONTACT_Z_BACK, playsBack, backFootShot, driveBearing } from "../sim/batting.js";
import { BATTER_CLIPS, gamePreparationWindow } from "../render/batter-motion-all.js";
import { clipForShot } from "../render/batter-catalog.js";

/**
 * Presentation routing only. It reads a committed shot, never changes its result or consumes dice.
 * On a clean contact the realised label gives the intended placement; an edge's exit does not.
 */

function naturalBearing(type, line, height, back) {
  if (type === "drive" || type === "loft") return driveBearing(line);
  if (type === "cutpull") {
    if (back === "cut") return 92 + line * 15;
    if (back === "punch") return 8 + line * 70;
    if (back === "glance") return -125;
    return -72 - Math.max(0, Math.min(1, height - 0.8)) * 30;
  }
  if (type === "ramp") return line > 0.15 ? 160 : -165;
  if (type === "sweep") return -115;
  if (type === "reverseSweep") return 110;
  return 0;
}

/** A miss still has an attempted stroke, inferred from its input, line, height and foot. */
export function intentLabel(type, bearing, height, footBack, back) {
  if (type === "defend") return footBack ? "back-foot defence" : "forward defence";
  if (type === "cutpull") {
    if (back === "cut") return bearing > 115 ? "late cut" : "cut";
    if (back === "punch") return "back-foot drive";
    if (back === "glance") return "leg glance";
    return height > 1.35 ? "hook" : "pull";
  }
  if (type === "ramp")
    return Math.abs(bearing) > 168 ? "ramp over the keeper" : bearing > 0 ? "ramp over the slips" : "scoop over fine leg";
  if (type === "sweep") return bearing < -125 ? "paddle sweep" : "sweep";
  if (type === "reverseSweep") return "reverse sweep";
  const lofted = type === "loft" ? "lofted " : "";
  if (bearing > 80) return "square drive";
  if (bearing > 45) return lofted + "cover drive";
  if (bearing > 12) return lofted + "off drive";
  if (bearing > -12) return lofted + "straight drive";
  if (bearing > -40) return lofted + "on drive";
  if (bearing > -100) return type === "loft" ? "slog over midwicket" : "clip off the pads";
  return type === "loft" ? "slog over midwicket" : "leg glance";
}

export function attemptedStroke(cur) {
  const type = cur.shot?.type ?? cur.swingType;
  if (type === "leave") return "leave";
  if (!["drive", "loft", "cutpull", "ramp", "sweep", "reverseSweep", "defend"].includes(type)) return null;
  const footBack = playsBack(type, cur.shot?.foot, cur.delivery?.pitchedAt?.z ?? 5);
  if (type === "defend") return footBack ? "backFootDefence" : "forwardDefence";
  const contact = cur.play?.res?.contact;
  if (contact?.kind === "middle") {
    const realised = clipForShot(type, contact.shotName);
    if (realised) return realised;
  }
  const at = crossingAtZ(cur.delivery.samples, footBack ? CONTACT_Z_BACK : CONTACT_Z_FRONT);
  const line = at?.x ?? cur.lineAtBat;
  const height = at?.y ?? 0;
  const back = type === "cutpull" ? backFootShot(line, height) : null;
  return clipForShot(type, intentLabel(type, naturalBearing(type, line, height, back), height, footBack, back));
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
  const frontFoot = !playsBack(type, cur.shot.foot, cur.delivery.pitchedAt?.z ?? 5);
  if (type === "defend" && Number.isFinite(cur.defendAt)) {
    const contactAt = Math.max(cur.defendAt + gamePreparationWindow(name), scene.arrival("defend", cur.shot.foot));
    return { name, type, contactAt, window: contactAt - cur.defendAt, frontFoot };
  }
  if (type === "leave") {
    const contactAt = scene.arrival(scene.human === "bowl" ? "leave" : "drive", cur.shot.foot);
    const start = Number.isFinite(cur.leaveAt) ? cur.leaveAt : contactAt - 0.22;
    return { name, type, contactAt, window: Math.max(0.001, contactAt - start), frontFoot: false };
  }
  if (!Number.isFinite(cur.swingAt) || !Number.isFinite(cur.backliftAt) || !SWING_TIME[type]) return null;
  const contactAt = cur.swingAt + SWING_TIME[type];
  const window = contactAt - cur.backliftAt;
  return window > BATTER_CLIPS[name].downswing ? { name, type, contactAt, window, frontFoot } : null;
}
