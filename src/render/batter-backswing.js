const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

/** Deepen the load, then release it into the authored contact pose and follow-through. */
export function accentBackswing(pose, clip, time) {
  if (clip.kind === "defence" || clip.kind === "leave" || time <= clip.start || time >= 0) return pose;
  const load = smooth((time - clip.start) / (-clip.downswing - clip.start));
  const release = time < -clip.downswing ? 1 : smooth(-time / clip.downswing);
  const weight = load * release;
  const contact = clip.frames.find((frame) => frame.time === 0).pose;
  const angleDelta = (pose.angle - contact.angle) * Math.PI / 180;
  const difference = Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta)) * 180 / Math.PI;
  // Lift away from each stroke's contact angle, including reverse sweeps and ramps.
  // Pulls already have a broad arc, so keep their coil below a half turn.
  const extraAngle = Math.min(22, Math.max(0, 170 - Math.abs(difference))) * difference / Math.max(25, Math.abs(difference));
  const coilDelta = pose.shoulderTurn - contact.shoulderTurn;
  const shoulderCoil = coilDelta / Math.max(12, Math.abs(coilDelta));
  return {
    ...pose,
    py: pose.py - 7 * weight,
    handZ: pose.handZ - 3 * weight,
    angle: pose.angle + extraAngle * weight,
    shoulderTurn: pose.shoulderTurn + 7 * shoulderCoil * weight,
    hipTurn: pose.hipTurn + 3 * shoulderCoil * weight,
    chestY: pose.chestY - weight,
    headY: pose.headY - 1.4 * weight,
  };
}
