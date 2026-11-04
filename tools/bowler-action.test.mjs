import test from "node:test";
import assert from "node:assert/strict";
import { bowlerAction, actionTimes, markZ } from "../src/render/bowler/bowler-action.js";
import { bowlerSkeleton, BOWLER_BODY } from "../src/render/bowler/bowler-skeleton.js";
import { BOWLER_STYLES } from "../src/render/bowler/bowler-styles.js";
import { bowlingGeometry } from "../src/sim/bowling-side.js";

const STYLES = Object.keys(BOWLER_STYLES);
const RUN = 1.8;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const JOINTS = [
  "pelvis",
  "neck",
  "head",
  "shoulderL",
  "shoulderR",
  "elbowL",
  "elbowR",
  "handL",
  "handR",
  "kneeL",
  "kneeR",
  "ankleL",
  "ankleR",
];
const frames = (id, from, to, dt = 1 / 120) => {
  const out = [];
  for (let t = from; t <= to; t += dt) out.push({ t, j: bowlerSkeleton(bowlerAction(id, t, RUN)) });
  return out;
};

test("every style's hand is over the sim's release point at release, with a straight arm", () => {
  for (const id of STYLES) {
    const spin = id.includes("spin");
    const j = bowlerSkeleton(bowlerAction(id, 0, RUN));
    const geo = bowlingGeometry(spin, "over");
    const hand = { x: geo.bodyX - j.handR.x, y: j.handR.y, z: j.handR.z };
    const sim = { x: geo.releaseX, y: spin ? 1.95 : 2.18, z: 18.7 };
    assert.ok(dist(hand, sim) < 0.2, `${id}: ${JSON.stringify(hand)}`);
    // Elbow flexion at release, within the law's 15 degrees.
    const u = { x: j.shoulderR.x - j.elbowR.x, y: j.shoulderR.y - j.elbowR.y, z: j.shoulderR.z - j.elbowR.z };
    const v = { x: j.handR.x - j.elbowR.x, y: j.handR.y - j.elbowR.y, z: j.handR.z - j.elbowR.z };
    const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / Math.hypot(u.x, u.y, u.z) / Math.hypot(v.x, v.y, v.z);
    assert.ok(180 - (Math.acos(cos) * 180) / Math.PI < 15, id);
  }
});

test("limbs keep their length through the whole action", () => {
  const b = BOWLER_BODY;
  for (const id of STYLES) {
    for (const { t, j } of frames(id, -RUN - 0.6, 1.8, 1 / 30)) {
      for (const [a, c, len] of [
        ["kneeL", "ankleL", b.shin],
        ["kneeR", "ankleR", b.shin],
        ["shoulderL", "elbowL", b.upperArm],
        ["shoulderR", "elbowR", b.upperArm],
        ["elbowR", "handR", b.forearm],
      ]) {
        assert.ok(Math.abs(dist(j[a], j[c]) - len) < 0.005, `${id} ${a}-${c} at ${t.toFixed(2)}`);
      }
      for (const k of JOINTS) assert.ok(Number.isFinite(j[k].x + j[k].y + j[k].z), `${id} ${k} at ${t}`);
    }
  }
});

test("the front foot stays planted from front-foot contact into the follow-through, the back foot from its landing", () => {
  for (const id of STYLES) {
    const t = actionTimes(id);
    const span = (from, to, joint) => {
      const fs = frames(id, from, to);
      return Math.max(...fs.map(({ j }) => dist(j[joint], fs[0].j[joint])));
    };
    assert.ok(span(t.ffc, t.f1, "ankleL") < 0.01, `${id} front foot slides`);
    assert.ok(span(t.bfc, t.ffc, "ankleR") < 0.03, `${id} back foot slides`);
  }
});

test("no jolts: every joint moves smoothly, run-up into delivery into follow-through", () => {
  for (const id of STYLES) {
    const fs = frames(id, -RUN + 0.35, 1.6);
    let worst = 0;
    let at = 0;
    for (let i = 2; i < fs.length; i++) {
      for (const k of JOINTS) {
        // The change in velocity between frames (m per frame, at 120 a second).
        const a = fs[i].j[k];
        const b = fs[i - 1].j[k];
        const c = fs[i - 2].j[k];
        const jolt = Math.hypot(a.x - 2 * b.x + c.x, a.y - 2 * b.y + c.y, a.z - 2 * b.z + c.z);
        if (jolt > worst) [worst, at] = [jolt, fs[i].t];
      }
    }
    // A running foot or the back leg whipping through changes speed by up to about 0.15 m a frame at this
    // rate; a knee or elbow flipping, or a pose jumping, is 0.5 or more.
    assert.ok(worst < 0.2, `${id}: ${worst.toFixed(3)} m/frame change at ${at.toFixed(2)} s`);
  }
});

test("he starts from a mark behind the crease and finishes off the pitch's middle", () => {
  for (const id of STYLES) {
    assert.ok(markZ(id, RUN) > 22, id);
    const end = bowlerAction(id, 2.5, RUN);
    assert.ok(end.pelvis.x < -0.4, `${id} follow-through veers off`);
  }
});
