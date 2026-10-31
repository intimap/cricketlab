import test from "node:test";
import assert from "node:assert/strict";
import { BATTER_CLIPS, sampleBatterMotion } from "../src/render/batter-motion-all.js";
import { BATTER_POSES } from "../src/render/batter-poses.js";
import { solveBatterSkeleton, batterJointToWorld, UNITS_PER_METRE } from "../src/render/batter-skeleton.js";
import { solveBatterRig, projectBatterJoint } from "../src/render/batter-projection.js";
import { batMesh } from "../src/render/bat-mesh.js";
import { solveTwoBone3, length3, sub3 } from "../src/render/rig-3d.js";

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const distance = (a, b) => length3(sub3(a, b));
function checkBones(r) {
  for (const side of ["front", "back"]) {
    for (const [a, b, length] of [["Hip", "Knee", 22], ["Knee", "Foot", 23], ["Shoulder", "Elbow", 19], ["Elbow", "Wrist", 18]]) {
      near(distance(r[side + a], r[side + b]), length);
    }
  }
  near(distance(r.pelvis, r.chest), 28);
  near(distance(r.chest, r.head), 12);
  near(distance(r.topHand, r.bottomHand), 4.5);
  near(distance(r.topHand, r.batToe), 36);
}

test("all 28 clips have finite XYZ joints, fixed bone lengths and rigid grips", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) {
    for (let i = 0; i <= 120; i++) {
      const pose = sampleBatterMotion(name, clip.start + (clip.end - clip.start) * i / 120);
      const r = solveBatterSkeleton(pose);
      checkBones(r);
      for (const p of Object.values(r)) {
        if (p && typeof p === "object") for (const axis of ["x", "y", "z"]) assert.ok(Number.isFinite(p[axis]), `${name}: ${axis}`);
      }
      // The leg solve may lower the pelvis but must keep the authored ankle goals.
      near(r.frontFoot.x, pose.frontFootX);
      near(r.frontFoot.y, 3 + pose.frontLift);
      near(r.frontFoot.z, pose.frontFootZ);
      near(r.backFoot.x, pose.backFootX);
      near(r.backFoot.y, 3 + pose.backLift);
      near(r.backFoot.z, pose.backFootZ);
    }
  }
});

test("legacy stances and transitions also solve in 3D without shortening limbs", () => {
  for (const pose of Object.values(BATTER_POSES)) checkBones(solveBatterSkeleton(pose));
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) {
    for (let i = 0; i <= 20; i++) {
      const pose = sampleBatterMotion(name, clip.start + 0.04);
      checkBones(solveBatterSkeleton({ ...pose, from: BATTER_POSES.stance, fromK: i / 20 }));
    }
  }
});

test("both cameras project the same canonical skeleton and reverse depth", () => {
  const a = sampleBatterMotion("straightDrive", 0.05, { view: "batter" });
  const b = sampleBatterMotion("straightDrive", 0.05, { view: "bowler" });
  assert.deepEqual(a, b);
  const nearView = solveBatterRig(a);
  const farView = solveBatterRig(b, true);
  assert.deepEqual(nearView.skeleton, farView.skeleton);
  assert.notEqual(nearView.frontFoot.y, farView.frontFoot.y);
  for (const [rig, front] of [[nearView, false], [farView, true]]) {
    const p = projectBatterJoint(rig.skeleton.batToe, front);
    near(rig.topHand.x + rig.dir.x * 36, p.x);
    near(rig.topHand.y + rig.dir.y * 36, p.y);
    for (let i = 1; i < rig.bat.faces.length; i++) assert.ok(rig.bat.faces[i - 1].depth >= rig.bat.faces[i].depth);
  }
});

test("authored joint depths change projection and convert to world metres", () => {
  const pose = sampleBatterMotion("straightDrive", 0);
  const r = solveBatterSkeleton({ ...pose, frontFootZ: pose.frontFootZ - 8 });
  near(r.frontFoot.z, pose.frontFootZ - 8);
  const world = batterJointToWorld({ x: UNITS_PER_METRE, y: 2 * UNITS_PER_METRE, z: 3 * UNITS_PER_METRE }, { x: 5, y: 0, z: 1 });
  assert.deepEqual(world, { x: 6, y: 2, z: 4 });
});

test("elbows and knees remain continuous through each stroke", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) {
    let previous;
    for (let i = 0; i <= 600; i++) {
      const r = solveBatterSkeleton(sampleBatterMotion(name, clip.start + (clip.end - clip.start) * i / 600));
      if (previous) for (const key of ["frontElbow", "backElbow", "frontKnee", "backKnee"]) {
        assert.ok(distance(r[key], previous[key]) < 3, `${name}: ${key} jumped`);
      }
      previous = r;
    }
  }
});

test("the 3D blade retains physical width and thickness throughout a swing", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) for (let i = 0; i <= 20; i++) {
    const mesh = batMesh(solveBatterSkeleton(sampleBatterMotion(name, clip.start + (clip.end - clip.start) * i / 20)));
    const toe = mesh.faces.find((f) => f.kind === "toe").points;
    near(distance(toe[0], toe[1]), 6);
    near(distance(toe[1], toe[2]), 2.1);
  }
});

test("unreachable and coincident IK goals stay finite without stretching", () => {
  const origin = { x: 0, y: 0, z: 0 };
  for (const target of [origin, { x: 100, y: -100, z: 50 }, { x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: -100 }]) {
    const r = solveTwoBone3(origin, target, 19, 18, { x: 0.8, y: 0.6, z: 0 });
    near(distance(origin, r.joint), 19);
    near(distance(r.joint, r.end), 18);
  }
});
