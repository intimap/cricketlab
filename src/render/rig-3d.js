/** Small, deterministic 3D helpers for visual rigs. Coordinates use Y up and Z down the pitch. */
export const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul3 = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length3 = (a) => Math.hypot(a.x, a.y, a.z);
export const unit3 = (a, fallback = { x: 0, y: 1, z: 0 }) => (length3(a) > 1e-8 ? mul3(a, 1 / length3(a)) : { ...fallback });
export const cross3 = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const mix3 = (a, b, k) => add3(mul3(a, 1 - k), mul3(b, k));

/** Keep a target inside a reach sphere without moving a reachable target. */
export function withinReach3(origin, target, radius) {
  const delta = sub3(target, origin);
  return length3(delta) > radius ? add3(origin, mul3(unit3(delta), radius)) : { ...target };
}

/**
 * Two-bone IK in a 3D hinge plane. Unreachable goals are clamped before solving,
 * so neither bone stretches. Hinge coordinates pick a bend in a transported
 * frame, keeping elbows and knees from flipping between two 2D solutions.
 */
export function solveTwoBone3(origin, target, upper, lower, hinge) {
  const delta = sub3(target, origin);
  const axis = unit3(delta, { x: 0, y: -1, z: 0 });
  const distance = Math.max(Math.abs(upper - lower) + 0.01, Math.min(length3(delta), (upper + lower) * 0.985));
  const end = add3(origin, mul3(axis, distance));
  // Transport a hinge frame from -Z onto the limb axis. Projecting a fixed
  // pole directly onto the limb would flip it when the hand crosses that pole.
  const denominator = 1 - axis.z;
  const across = denominator > 1e-6
    ? { x: 1 - axis.x * axis.x / denominator, y: -axis.x * axis.y / denominator, z: axis.x }
    : { x: 1, y: 0, z: 0 };
  const up = denominator > 1e-6
    ? { x: -axis.x * axis.y / denominator, y: 1 - axis.y * axis.y / denominator, z: axis.y }
    : { x: 0, y: -1, z: 0 };
  const bend = unit3(add3(mul3(across, hinge.x), mul3(up, hinge.y)));
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { joint: add3(add3(origin, mul3(axis, along)), mul3(unit3(bend), height)), end };
}
