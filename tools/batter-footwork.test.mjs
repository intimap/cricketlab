import test from "node:test";
import assert from "node:assert/strict";
import { BATTER_CLIPS, sampleBatterMotion } from "../src/render/batter-motion-all.js";
import { solveBatterSkeleton } from "../src/render/batter-skeleton.js";
import { solveBatterRig } from "../src/render/batter-projection.js";
import { batterSurfaces } from "../src/render/batter-surfaces.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const toe = (r, name) => ({
  x: r[`${name}Foot`].x + Math.cos(r[`${name}ToeYaw`]) * 7,
  y: r[`${name}Foot`].y - 3 - r[`${name}Heel`] * 0.35,
  z: r[`${name}Foot`].z + Math.sin(r[`${name}ToeYaw`]) * 7,
});

test("the hips start turning before the torso and reverse sweeps turn the other way", () => {
  const clip = BATTER_CLIPS.straightDrive;
  const snapshot = JSON.stringify(clip);
  const contact = sampleBatterMotion("straightDrive", 0);
  const start = sampleBatterMotion("straightDrive", 0.02);
  assert.ok(start.hipTurn < contact.hipTurn);
  const end = sampleBatterMotion("straightDrive", 0.25);
  assert.ok(end.hipTurn < clip.frames.find((f) => f.phase === "Finish").pose.hipTurn - 20);
  assert.ok(end.shoulderTurn < clip.frames.find((f) => f.phase === "Finish").pose.shoulderTurn - 25);
  const reverse = BATTER_CLIPS.reverseSweep;
  assert.ok(sampleBatterMotion("reverseSweep", 0.2).hipTurn > reverse.frames.find((f) => f.time === 0).pose.hipTurn);
  assert.equal(JSON.stringify(clip), snapshot);
});

test("drives stride forward and cuts step back, then lift a recovery foot", () => {
  const drive = sampleBatterMotion("straightDrive", 0);
  const cut = sampleBatterMotion("cut", 0);
  assert.ok(drive.frontFootZ > 55);
  assert.ok(cut.backFootZ < -15);
  const recovery = sampleBatterMotion("straightDrive", 0.65);
  assert.ok(recovery.backLift > 2);
});

test("both toes stay fixed through the drive plant while the rear heel rises", () => {
  const reference = solveBatterSkeleton(sampleBatterMotion("straightDrive", 0));
  const base = { front: toe(reference, "front"), back: toe(reference, "back") };
  for (let i = 0; i <= 40; i++) {
    const r = solveBatterSkeleton(sampleBatterMotion("straightDrive", i / 100));
    for (const side of ["front", "back"]) {
      const p = toe(r, side);
      near(p.x, base[side].x); near(p.z, base[side].z); near(p.y, 0);
    }
  }
  assert.ok(solveBatterSkeleton(sampleBatterMotion("straightDrive", 0.25)).backHeel > reference.backHeel + 3);
});

test("every attacking stroke keeps its toes anchored until its plant windows end", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) {
    if (clip.kind !== "attack") continue;
    const contact = solveBatterSkeleton(sampleBatterMotion(name, 0));
    for (const side of ["front", "back"]) {
      const anchor = toe(contact, side);
      for (let i = 0; i <= 25; i++) {
        const r = solveBatterSkeleton(sampleBatterMotion(name, clip.plant[side][1] * i / 25));
        const planted = toe(r, side);
        near(planted.x, anchor.x); near(planted.z, anchor.z);
      }
    }
  }
});

test("rotating cloth and boots stay finite, above the turf, and depth sorted in either camera", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) for (let i = 0; i <= 80; i++) {
    const pose = sampleBatterMotion(name, clip.start + (clip.end - clip.start) * i / 80);
    const r = solveBatterSkeleton(pose);
    const surfaces = batterSurfaces(r);
    for (const key of ["shirt", "hips", "frontBoot", "backBoot"]) for (const face of surfaces[key]) {
      for (const p of face.points) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), name);
        if (key.endsWith("Boot")) assert.ok(p.y > -1e-7, `${name}: boot below the ground`);
      }
    }
    for (const front of [false, true]) {
      const body = solveBatterRig(pose, front).body;
      for (const key of ["shirt", "hips", "frontBoot", "backBoot"]) for (let j = 1; j < body[key].length; j++) {
        assert.ok(body[key][j - 1].depth >= body[key][j].depth);
      }
    }
  }
});

test("all clips return to guard without residual turns or step offsets", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) {
    const r = solveBatterSkeleton(sampleBatterMotion(name, clip.end));
    const source = solveBatterSkeleton(clip.frames.at(-1).pose);
    for (const key of ["frontFoot", "backFoot", "frontShoulder", "backShoulder"]) {
      near(r[key].x, source[key].x); near(r[key].y, source[key].y); near(r[key].z, source[key].z);
    }
    near(r.frontToeYaw, 0); near(r.backToeYaw, 0);
  }
});
