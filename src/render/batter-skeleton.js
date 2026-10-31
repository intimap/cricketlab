import { add3, sub3, mul3, unit3, length3, mix3, withinReach3, solveTwoBone3 } from "./rig-3d.js";

// Local rig units retain the pixel-art proportions. All joints have real depth;
// divide by UNITS_PER_METRE when placing them in the match's metre-based world.
export const UNITS_PER_METRE = 94 / 1.8;
export const BATTER_BONES = { thigh: 22, shin: 23, upperArm: 19, forearm: 18, spine: 28, neck: 12 };
const RAD = Math.PI / 180;
export const RIG_DEPTH_RISE = 0.25;

/** Convert the older compact poses into the same authored targets as the shot clips. */
function targets(p) {
  if (p.rig === 1) return p;
  const stride = -7 * p.step + 3 * p.back;
  const drop = p.drop ?? 0;
  const reach = p.reach ?? 0;
  const pelvisX = 1 + p.lean * 0.5 + reach * 0.22;
  const pelvisY = -47 + drop + stride * 0.5 + p.back;
  const chestX = pelvisX + p.lean * 0.9 + reach * 0.18;
  const chestY = pelvisY - 29 + Math.abs(p.lean) * 0.25;
  return {
    ...p,
    frontFootX: 4 + 2 * p.step,
    frontFootY: -9 + stride,
    backFootX: -3 - 2 * p.back - (drop > 8 ? 5 : 0),
    backFootY: -3,
    frontLift: 0,
    backLift: 0,
    pelvisX, pelvisY, chestX, chestY,
    headX: chestX + p.lean * 0.4 + 1 + reach * 0.15,
    headY: chestY - 12,
    px: p.px,
    py: p.py + stride * 0.5,
    hipTurn: 55,
    shoulderTurn: 40,
    crouch: drop,
  };
}

function foot(p, name) {
  return {
    x: p[`${name}FootX`],
    y: 3 + (p[`${name}Lift`] ?? 0),
    z: p[`${name}FootZ`] ?? -(p[`${name}FootY`] + 3) / RIG_DEPTH_RISE,
  };
}

// Existing clips author screen-height targets. Lift those into 3D once;
// camera choice never changes these canonical body positions.
const lifted = (x, screenY, z) => ({ x, y: -screenY - z * RIG_DEPTH_RISE, z });

function goalsFor(pose) {
  const p = targets(pose);
  const frontFoot = foot(p, "front");
  const backFoot = foot(p, "back");
  const rootZ = p.pelvisZ ?? (frontFoot.z + backFoot.z) * 0.5;
  const pelvis = lifted(p.pelvisX, p.pelvisY, rootZ);
  const chest = lifted(p.chestX, p.chestY, p.chestZ ?? rootZ + (p.chestX - p.pelvisX) * 0.3);
  const head = lifted(p.headX, p.headY, p.headZ ?? chest.z + (p.headX - p.chestX) * 0.3);
  const angle = p.angle * RAD;
  const plane = Math.max(0, Math.min(1, p.plane ?? 0.85));
  const azimuth = Math.atan2(plane, 1 - plane);
  const batDir = { x: Math.sin(angle) * Math.cos(azimuth), y: -Math.cos(angle), z: -Math.sin(angle) * Math.sin(azimuth) };
  const handZ = p.handZ ?? rootZ - 20 - Math.sin(angle) * 4;
  return {
    pelvis, chest, head, frontFoot, backFoot,
    topHand: lifted(p.px, p.py, handZ), batDir,
    hipTurn: p.hipTurn * RAD, shoulderTurn: p.shoulderTurn * RAD,
    face: p.batFace ?? 1, angle, azimuth,
    lean: p.lean ?? 0, drop: p.drop ?? 0,
  };
}

/** Supply depth keyframes for existing clips; authored Z values take precedence. */
export function withBatterDepth(pose) {
  const g = goalsFor(pose);
  return {
    ...pose,
    frontFootZ: g.frontFoot.z, backFootZ: g.backFoot.z,
    pelvisZ: g.pelvis.z, chestZ: g.chest.z, headZ: g.head.z, handZ: g.topHand.z,
  };
}

/** Blend targets before IK, rather than lerping solved knees/elbows and shortening their bones. */
function blendGoals(a, b, k) {
  const result = {};
  for (const key of Object.keys(b)) {
    result[key] = typeof b[key] === "number" ? a[key] + (b[key] - a[key]) * k : mix3(a[key], b[key], k);
  }
  const delta = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
  result.angle = a.angle + delta * k;
  result.batDir = {
    x: Math.sin(result.angle) * Math.cos(result.azimuth),
    y: -Math.cos(result.angle),
    z: -Math.sin(result.angle) * Math.sin(result.azimuth),
  };
  return result;
}

function poseGoals(pose) {
  const current = goalsFor(pose);
  if (!pose.from) return current;
  return blendGoals(current, poseGoals(pose.from), Math.max(0, Math.min(1, pose.fromK)));
}

function hipsAt(pelvis, angle) {
  const offset = { x: Math.cos(angle) * 5.5, y: 0, z: Math.sin(angle) * 5.5 };
  return { backHip: sub3(pelvis, offset), frontHip: add3(pelvis, offset) };
}

/** Canonical XYZ skeleton. It is independent of the camera and never changes match physics. */
export function solveBatterSkeleton(pose) {
  const g = poseGoals(pose);
  const originalPelvis = g.pelvis;
  let pelvis = { ...g.pelvis };
  // Move the pelvis into both legs' reach; planted ankle targets remain fixed.
  const legReach = (BATTER_BONES.thigh + BATTER_BONES.shin) * 0.98;
  for (let i = 0; i < 16; i++) {
    const previous = pelvis;
    for (const name of ["front", "back"]) {
      const hip = hipsAt(pelvis, g.hipTurn)[`${name}Hip`];
      const reached = withinReach3(g[`${name}Foot`], hip, legReach);
      pelvis = add3(pelvis, sub3(reached, hip));
    }
    if (length3(sub3(pelvis, previous)) < 1e-8) break;
  }
  const hips = hipsAt(pelvis, g.hipTurn);
  const shift = sub3(pelvis, originalPelvis);
  const chest = add3(pelvis, mul3(unit3(sub3(g.chest, originalPelvis)), BATTER_BONES.spine));
  const head = add3(chest, mul3(unit3(sub3(g.head, g.chest)), BATTER_BONES.neck));
  const shoulderOffset = { x: Math.cos(g.shoulderTurn) * 10, y: 0, z: Math.sin(g.shoulderTurn) * 10 };
  const backShoulder = sub3(chest, shoulderOffset);
  const frontShoulder = add3(chest, shoulderOffset);
  const batDir = g.batDir;
  const grip = mul3(batDir, 4.5);
  let topHand = add3(g.topHand, shift);
  // Both wrists share one rigid grip. Constrain the grip as a whole to the
  // intersection of the two arms' reach spheres instead of separating hands.
  const armReach = (BATTER_BONES.upperArm + BATTER_BONES.forearm) * 0.98;
  const keepWristClear = (shoulder, wrist) => {
    const delta = sub3(wrist, shoulder);
    return length3(delta) < 4 ? add3(shoulder, mul3(unit3(delta), 4)) : wrist;
  };
  for (let i = 0; i < 16; i++) {
    const previous = topHand;
    topHand = keepWristClear(frontShoulder, topHand);
    topHand = sub3(keepWristClear(backShoulder, add3(topHand, grip)), grip);
    topHand = withinReach3(frontShoulder, topHand, armReach);
    topHand = sub3(withinReach3(backShoulder, add3(topHand, grip), armReach), grip);
    if (length3(sub3(topHand, previous)) < 1e-8) break;
  }
  const bottomHand = add3(topHand, grip);
  const { thigh, shin, upperArm, forearm } = BATTER_BONES;
  const kneeHinge = { x: 1, y: 0.05 };
  const frontLeg = solveTwoBone3(hips.frontHip, g.frontFoot, thigh, shin, kneeHinge);
  const backLeg = solveTwoBone3(hips.backHip, g.backFoot, thigh, shin, kneeHinge);
  const frontArm = solveTwoBone3(frontShoulder, topHand, upperArm, forearm, { x: 0.8, y: 0.6 });
  const backArm = solveTwoBone3(backShoulder, bottomHand, upperArm, forearm, { x: 0.15, y: -0.8 });
  return {
    pelvis, chest, head, ...hips, frontShoulder, backShoulder,
    frontFoot: frontLeg.end, backFoot: backLeg.end,
    frontKnee: frontLeg.joint, backKnee: backLeg.joint,
    frontElbow: frontArm.joint, backElbow: backArm.joint,
    topHand, bottomHand, frontWrist: topHand, backWrist: bottomHand,
    batShoulder: add3(topHand, mul3(batDir, 9)),
    batToe: add3(topHand, mul3(batDir, 36)),
    batDir, face: g.face, angle: g.angle, azimuth: g.azimuth,
    lean: g.lean, drop: g.drop,
  };
}

/** Convert one joint to match-world metres without making it a simulation collider. */
export function batterJointToWorld(joint, anchor, heightScale = 1) {
  return add3(anchor, mul3(joint, heightScale / UNITS_PER_METRE));
}
