import { clamp, easeIn, easeOut } from "../math.js";
import { CREASE } from "../sim/geometry.js";
import { crossingAtZ } from "../sim/delivery.js";
import { SWING_TIME, NORMAL_CHARGE, CONTACT_Z_BACK, playsBack, backFootShot, driveBearing } from "../sim/batting.js";
import { projectFromStriker } from "../render/camera.js";
import { BATTER_POSES, lerpPose, reachPose } from "../render/batter-rig.js";
import { BATTER_CLIPS, sampleGameBatterMotion } from "../render/batter-motion-all.js";
import { rigStroke } from "./batter-stroke.js";
export { rigStroke } from "./batter-stroke.js";

/**
 * The striker's pose at any moment of a ball: stance, trigger, backlift, swing, defence or leave, on the
 * old poses or (for the strokes it has) the newer rig. match-view.js places, aligns and draws him.
 */

const FOLLOW_THROUGH_TIME = 0.15;
/** With no shot chosen, the striker starts lifting the bat out of the way this long before the ball arrives. */
export const LEAVE_LIFT = 0.22;
/** Where the striker stands across the crease (just leg side of middle). */
export const STRIKER_X = -0.14;

/** Stance before the ball: an occasional bat tap, then a trigger movement as the bowler delivers. */
export function readyPose(scene, cur, t) {
  if (cur && t > -0.35) return lerpPose(BATTER_POSES.stance, BATTER_POSES.trigger, easeOut((t + 0.35) / 0.2));
  const tap = Math.max(0, Math.sin(scene.now * 2.6)) ** 8;
  return { ...BATTER_POSES.stance, angle: BATTER_POSES.stance.angle + 12 * tap };
}

/** Follow-through for the shot being played, chosen by where the ball went (or was meant to go). */
export function finishPose(cur, type) {
  const contact = cur.play?.res.contact;
  if (type === "ramp") return BATTER_POSES.rampEnd;
  if (type === "sweep") return BATTER_POSES.sweepEnd;
  if (type === "reverseSweep") return BATTER_POSES.reverseSweepEnd;
  const bearing =
    contact?.kind === "middle" ? (Math.atan2(contact.exit.x, contact.exit.z) * 180) / Math.PI : driveBearing(cur.lineAtBat);
  if (type === "cutpull") {
    const at = crossingAtZ(cur.delivery.samples, CONTACT_Z_BACK);
    const back = backFootShot(at?.x ?? cur.lineAtBat, at?.y ?? 0);
    if (back === "cut") return contact?.shotName === "late cut" ? BATTER_POSES.lateCutEnd : BATTER_POSES.cutEnd;
    if (back === "punch") return bearing > 25 ? BATTER_POSES.coverDriveEnd : BATTER_POSES.straightDriveEnd;
    if (back === "glance") return BATTER_POSES.clipEnd;
    return (at?.y ?? 0) > 1.35 ? BATTER_POSES.hookEnd : BATTER_POSES.pullEnd;
  }
  if (type === "loft") return bearing < -35 ? BATTER_POSES.slogEnd : BATTER_POSES.loftEnd;
  if (bearing < -60) return BATTER_POSES.clipEnd;
  if (bearing < -15) return BATTER_POSES.onDriveEnd;
  if (bearing > 25) return BATTER_POSES.coverDriveEnd;
  return BATTER_POSES.straightDriveEnd;
}

/** How long a stroke on the new rig eases in from the old ready pose, and back out to the old stance after (s). */
const RIG_BLEND_IN = 0.06;
const RIG_BLEND_OUT = 0.2;
/** The striker on the new rig for `stroke` at scene time t, eased in from the old ready pose and out to the old stance. */
function rigPose(scene, cur, stroke, t, reach, fromBowler) {
  const view = fromBowler ? "bowler" : "batter";
  const start = stroke.contactAt - stroke.window;
  const rel = t - stroke.contactAt;
  const end = BATTER_CLIPS[stroke.name].end;
  if (rel > end) {
    const done = sampleGameBatterMotion(stroke.name, end, { view, windowBeforeContact: stroke.window });
    return { ...BATTER_POSES.stance, from: done, fromK: Math.max(0, 1 - (rel - end) / RIG_BLEND_OUT) };
  }
  const motion = sampleGameBatterMotion(stroke.name, rel, { view, windowBeforeContact: stroke.window });
  // Reaching towards the line of the ball, as the old strokes do: in through contact, then let go.
  const reachNow = (stroke.type === "leave" ? 0 : reach) * (rel < 0 ? clamp((t - start) / stroke.window) : clamp(1 - rel / 0.2));
  const pose = reachPose(motion, reachNow, stroke.frontFoot);
  const since = t - start;
  return since < RIG_BLEND_IN ? { ...pose, from: readyPose(scene, cur, start), fromK: 1 - since / RIG_BLEND_IN } : pose;
}

/** Where the striker is drawn from the batter's end (screen x). */
export const STRIKER_SCREEN_X = 300;

/**
 * How far (m) the striker has shuffled across his crease: as the player moves him, or (for the
 * computer) easing over to where he's decided to go once the ball is bowled.
 */
export function footworkOf(scene, cur, t) {
  if (!cur) return 0;
  if (scene.human === "bat") return cur.shot?.footwork ?? cur.footwork ?? 0;
  return (cur.shot?.footwork ?? 0) * clamp(t / 0.3);
}

/** Screen pixels the striker has moved from his guard, from the batter's end. */
export const footworkPixels = (moved) =>
  projectFromStriker(STRIKER_X + moved, 0, CREASE).x - projectFromStriker(STRIKER_X, 0, CREASE).x;

/**
 * The striker's stroke at scene time t, before any reaction to how the ball came off: { pose, rig,
 * shotDoneAt } (rig: drawn on the new rig; shotDoneAt: when an old-pose shot has finished).
 */
export function strikerStroke(scene, cur, t, fromBowler) {
  const ready = readyPose(scene, cur, t);
  let pose = ready;
  const arrive = cur.delivery ? scene.arrival(cur.swingType ?? cur.shot?.type ?? "drive", cur.shot?.foot) : 0.6;
  // Reach towards the line of the ball, from wherever his feet are.
  const stand = STRIKER_SCREEN_X + footworkPixels(footworkOf(scene, cur, t));
  const reach = clamp((projectFromStriker(cur.lineAtBat, 0, 1.9).x - (stand + 12)) * 0.8, -8, 26);
  let shotDoneAt = null;
  if (cur.swingAt !== null && t >= cur.swingAt && cur.swingType) {
    const type = cur.swingType;
    const top = lerpPose(BATTER_POSES.lift0, BATTER_POSES.lift1, cur.shot?.charge ?? 0.5);
    const contact =
      {
        cutpull: BATTER_POSES.contactBack,
        ramp: BATTER_POSES.rampContact,
        sweep: BATTER_POSES.sweepContact,
        reverseSweep: BATTER_POSES.reverseSweepContact,
      }[type] ?? BATTER_POSES.contactFront;
    const k = (t - cur.swingAt) / SWING_TIME[type];
    if (k < 1) pose = lerpPose(top, contact, easeIn(k));
    else pose = lerpPose(contact, finishPose(cur, type), easeOut((t - cur.swingAt - SWING_TIME[type]) / FOLLOW_THROUGH_TIME));
    if (k > 0.3 && k < 1.6) pose = reachPose(pose, reach * Math.min(1, k) * (1.6 - k), type !== "cutpull");
    shotDoneAt = cur.swingAt + SWING_TIME[type] + FOLLOW_THROUGH_TIME;
  } else if (cur.swingType && cur.swingAt !== null && t >= cur.backliftAt) {
    const charge = cur.shot?.charge ?? NORMAL_CHARGE;
    pose = lerpPose(
      ready,
      lerpPose(BATTER_POSES.lift0, BATTER_POSES.lift1, charge),
      easeOut((t - cur.backliftAt) / Math.max(0.01, cur.swingAt - cur.backliftAt)),
    );
  } else if (cur.defendAt !== null && t >= cur.defendAt) {
    const back = playsBack("defend", cur.shot?.foot, cur.delivery?.pitchedAt?.z ?? 5);
    const block = back ? BATTER_POSES.defendBack : BATTER_POSES.defendFront;
    pose = lerpPose(ready, block, easeOut((t - cur.defendAt) / 0.09));
    pose = reachPose(pose, reach * clamp((t - cur.defendAt) / 0.15), !back);
    shotDoneAt = cur.defendAt + 0.3;
  } else if (cur.leaveAt !== null && t >= cur.leaveAt) {
    pose = lerpPose(ready, BATTER_POSES.leave, (t - cur.leaveAt) / 0.18);
  } else if (scene.human === "bat" && cur.delivery && !cur.shot && t > arrive - LEAVE_LIFT) {
    // No shot chosen yet: start lifting the bat out of the way.
    pose = lerpPose(ready, BATTER_POSES.leave, (t - (arrive - LEAVE_LIFT)) / 0.18);
  }

  // Named strokes use the current rig; the old poses remain available for fallback states.
  const stroke = rigStroke(scene, cur);
  const rig = !!stroke && t >= stroke.contactAt - stroke.window;
  if (rig) pose = rigPose(scene, cur, stroke, t, reach, fromBowler);
  return { pose, rig, shotDoneAt };
}
