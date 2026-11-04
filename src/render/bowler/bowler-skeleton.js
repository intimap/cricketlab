import { add3, sub3, mul3, unit3, length3, cross3 } from "../batter/rig-3d.js";
import { RAD } from "./bowler-action.js";

/**
 * The bowler's joints from a pose (bowler-action.js), in the action's frame: metres, `x` to the bowler's
 * right of his run line, `y` up, `z` down the pitch in the world. Body sizes are for a 1.85 m bowler and
 * scale with his height; where the feet plant does not. Knees and elbows come from two-bone solves towards
 * a pole (knees forward, elbows out and back), so nothing flips; the bowling arm is straight through the
 * delivery because its hand is placed on the arm's full reach.
 */

export const BOWLER_BODY = {
  hipHalf: 0.13,
  shoulderHalf: 0.2,
  spine: 0.55,
  neck: 0.2,
  thigh: 0.46,
  shin: 0.48,
  ankle: 0.07,
  upperArm: 0.31,
  forearm: 0.35,
};
const REF_HEIGHT = 1.85;
/** The ball hand while running in, when a pose gives none (from its shoulder: right, up, forward). */
const CARRY = { r: -0.08, up: -0.32, fwd: 0.16 };

const v3 = (x, y, z) => ({ x, y, z });
/** Facing at a turn of `deg` (0 at the batter, 90 side-on): forward and to his right, in the action's frame. */
const forwardAt = (deg) => v3(Math.sin(deg * RAD), 0, -Math.cos(deg * RAD));
const rightAt = (deg) => v3(Math.cos(deg * RAD), 0, Math.sin(deg * RAD));
/** An offset given as (right, up, forward towards the batter) in the action's frame. */
const offset = (o, k) => v3(o.r * k, o.up * k, -o.fwd * k);

/** Two bones from `origin` towards `target`, bending towards `pole`; never stretched, never quite locked. */
export function twoBone(origin, target, upper, lower, pole) {
  const delta = sub3(target, origin);
  const dist = Math.max(Math.abs(upper - lower) + 0.01, Math.min(length3(delta), (upper + lower) * 0.998));
  const axis = unit3(delta);
  const end = add3(origin, mul3(axis, dist));
  const toPole = sub3(pole, origin);
  let side = sub3(toPole, mul3(axis, toPole.x * axis.x + toPole.y * axis.y + toPole.z * axis.z));
  if (length3(side) < 1e-6) side = cross3(axis, v3(0, 0, 1));
  const along = (upper * upper - lower * lower + dist * dist) / (2 * dist);
  const out = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { joint: add3(add3(origin, mul3(axis, along)), mul3(unit3(side), out)), end };
}

/** Every joint of the bowler for `pose`, `height` metres tall. */
export function bowlerSkeleton(pose, height = REF_HEIGHT) {
  const k = height / REF_HEIGHT;
  const b = BOWLER_BODY;
  const pelvis = v3(pose.pelvis.x, pose.pelvis.y * k, pose.pelvis.z);
  const hipRight = rightAt(pose.hips);
  const hipFwd = forwardAt(pose.hips);
  const hipR = add3(pelvis, mul3(hipRight, b.hipHalf * k));
  const hipL = sub3(pelvis, mul3(hipRight, b.hipHalf * k));
  // The trunk: leaning forward over the shoulders' facing, bent away from the bowling arm.
  const shFwd = forwardAt(pose.shoulders);
  const shRightFlat = rightAt(pose.shoulders);
  const up = unit3(
    add3(add3(v3(0, 1, 0), mul3(shFwd, Math.tan(pose.pitch * RAD))), mul3(shRightFlat, -Math.tan(pose.roll * RAD))),
  );
  const neck = add3(pelvis, mul3(up, b.spine * k));
  const across = unit3(sub3(shRightFlat, mul3(up, shRightFlat.x * up.x + shRightFlat.y * up.y + shRightFlat.z * up.z)));
  const shoulderR = add3(neck, mul3(across, b.shoulderHalf * k));
  const shoulderL = sub3(neck, mul3(across, b.shoulderHalf * k));
  const head = add3(add3(neck, mul3(up, b.neck * k)), mul3(shFwd, 0.03 * k));

  // Legs: ankles over where the feet are, knees bending forward (and up when the foot swings forward, so the
  // bend never lines up with the leg and flips), a little out.
  const leg = (hip, foot, side) => {
    const ankle = v3(foot.x, foot.y * k + b.ankle * k, foot.z);
    const middle = mul3(add3(hip, ankle), 0.5);
    const pole = add3(add3(add3(middle, mul3(hipFwd, 0.5)), v3(0, 0.25, 0)), mul3(hipRight, 0.08 * side));
    const { joint, end } = twoBone(hip, ankle, b.thigh * k, b.shin * k, pole);
    return { knee: joint, ankle: end };
  };
  const left = leg(hipL, pose.left, -1);
  const right = leg(hipR, pose.right, 1);

  // Front arm: the hand placed from its shoulder, the elbow down and back (a little out), as a runner's is.
  const frontTarget = add3(shoulderL, offset(pose.frontHand, k));
  const frontPole = add3(add3(shoulderL, mul3(across, -0.15)), v3(0, -0.4, 0.35));
  const front = twoBone(shoulderL, frontTarget, b.upperArm * k, b.forearm * k, frontPole);

  // Bowling arm: round its shoulder in the shoulders' plane (0 down, 180 up), blended from the carried ball.
  const armLength = (b.upperArm + b.forearm) * k;
  const angle = pose.arm.angle * RAD;
  const circle = add3(
    shoulderR,
    mul3(add3(mul3(up, -Math.cos(angle)), mul3(across, Math.sin(angle))), armLength * pose.arm.reach),
  );
  const carried = add3(shoulderR, offset(pose.arm.hand ?? CARRY, k));
  const w = pose.arm.weight;
  const bowlTarget = add3(mul3(carried, 1 - w), mul3(circle, w));
  // The elbow points back and down while he carries the ball; round the circle it trails the hand, so it
  // bends the way the arm turns and never lines up with it.
  const carryPole = add3(shoulderR, add3(v3(0, -0.3, 0), mul3(shFwd, -0.35)));
  const trailing = add3(mul3(up, Math.sin(angle)), mul3(across, Math.cos(angle)));
  const circlePole = add3(
    add3(shoulderR, mul3(trailing, 0.4)),
    mul3(add3(mul3(up, -Math.cos(angle)), mul3(across, Math.sin(angle))), 0.2),
  );
  const bowlPole = add3(mul3(carryPole, 1 - w), mul3(circlePole, w));
  const bowl = twoBone(shoulderR, bowlTarget, b.upperArm * k, b.forearm * k, bowlPole);

  return {
    pelvis,
    hipL,
    hipR,
    neck,
    head,
    shoulderL,
    shoulderR,
    kneeL: left.knee,
    ankleL: left.ankle,
    kneeR: right.knee,
    ankleR: right.ankle,
    elbowL: front.joint,
    handL: front.end,
    elbowR: bowl.joint,
    handR: bowl.end,
    up,
    facing: shFwd,
    hipFacing: hipFwd,
  };
}
