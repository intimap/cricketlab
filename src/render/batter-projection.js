import { solveBatterSkeleton, RIG_DEPTH_RISE } from "./batter-skeleton.js";
import { batMesh } from "./bat-mesh.js";
import { sub3 } from "./rig-3d.js";

/**
 * Oblique projection matched to the hand-tuned pixel-art camera. X/Y below
 * are screen-local; Z remains canonical depth for tooling. The renderer mirrors
 * X at the bowler's end, so both views consume exactly the same XYZ skeleton.
 */
export function projectBatterJoint(point, front = false) {
  return { x: point.x, y: -point.y - point.z * RIG_DEPTH_RISE * (front ? -1 : 1), z: point.z };
}

/** Keep the old solveBatterRig API as the renderer's projected view of the 3D solver. */
export function solveBatterRig(pose, front = false) {
  const skeleton = solveBatterSkeleton(pose);
  const project = (point) => projectBatterJoint(point, front);
  const result = {};
  for (const [key, value] of Object.entries(skeleton)) {
    result[key] = value && typeof value === "object" ? project(value) : value;
  }
  const mesh = batMesh(skeleton);
  const cameraDepth = (point) => point.z * (front ? -1 : 1);
  result.bat = {
    faces: mesh.faces.map(({ kind, points }) => ({
      kind,
      depth: points.reduce((sum, point) => sum + cameraDepth(point), 0) / points.length,
      points: points.map(project),
    })).sort((a, b) => b.depth - a.depth),
    grip: mesh.grip.map(project),
    grain: mesh.grain.map(project),
    grainVisible: mesh.normal.z * (front ? -1 : 1) < -0.08,
  };
  const delta = sub3(skeleton.batToe, skeleton.topHand);
  result.dir = { x: delta.x / 36, y: (-delta.y - delta.z * RIG_DEPTH_RISE * (front ? -1 : 1)) / 36 };
  result.near = Math.max(0, -skeleton.batDir.z * (front ? -1 : 1));
  result.frontLift = 0;
  result.frontFootShadow = project({ ...skeleton.frontFoot, y: 0 });
  result.backFootShadow = project({ ...skeleton.backFoot, y: 0 });
  result.frontLegNear = cameraDepth(skeleton.frontHip) + cameraDepth(skeleton.frontFoot) <
    cameraDepth(skeleton.backHip) + cameraDepth(skeleton.backFoot);
  result.frontArmNear = cameraDepth(skeleton.frontShoulder) + cameraDepth(skeleton.frontWrist) <
    cameraDepth(skeleton.backShoulder) + cameraDepth(skeleton.backWrist);
  // Make canonical joint positions available to studies and future visual tools.
  result.skeleton = skeleton;
  return result;
}
