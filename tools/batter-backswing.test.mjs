import test from "node:test";
import assert from "node:assert/strict";
import { BACKLIFT_TIME, POWER_BACKLIFT_TIME } from "../src/sim/shot-timing.js";
import { SWING_TIME } from "../src/sim/batting.js";
import { commitSwing } from "../src/scenes/match-input.js";
import { rigStroke } from "../src/scenes/batter-stroke.js";
import { BATTER_CLIPS, sampleBatterMotion, gameMotionTime, gamePreparationWindow } from "../src/render/batter-motion-all.js";
import { withBatterDepth } from "../src/render/batter-skeleton.js";
import { accentBackswing } from "../src/render/batter-backswing.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const poseNear = (a, b) => { for (const key of Object.keys(b)) near(a[key], b[key]); };
function scene() {
  return {
    cur: { intent: {}, delivery: { pitchedAt: { z: 5 } } },
    arrival: () => 0.6,
    flash() {},
    match: { resolve: () => ({ res: { contact: { kind: "middle", shotName: "straight drive" } } }) },
  };
}

test("normal and power input must precede contact by the new full load and downswing", () => {
  for (const [power, preparation, oldPreparation] of [[false, 0.14, 0.07], [true, 0.26, 0.2]]) {
    const s = scene();
    const press = 0.6 - preparation - SWING_TIME.drive;
    commitSwing(s, press, "drive", power);
    near(s.cur.shot.timingError, 0);
    near(s.cur.swingAt - s.cur.backliftAt, preparation);
    const stroke = rigStroke(s, s.cur);
    near(stroke.contactAt, 0.6);
    near(stroke.window, preparation + SWING_TIME.drive);
    // Pressing at the previous cue is now late; the feedback reads this same error.
    const late = scene();
    commitSwing(late, 0.6 - oldPreparation - SWING_TIME.drive, "drive", power);
    near(late.cur.shot.timingError, preparation - oldPreparation);
  }
  near(BACKLIFT_TIME, 0.14);
  near(POWER_BACKLIFT_TIME, 0.26);
});

test("the raised load returns to the authored contact pose and leaves follow-throughs intact", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) {
    const atContact = clip.frames.find((frame) => frame.time === 0);
    if (clip.kind !== "attack") continue;
    const pose = sampleBatterMotion(name, 0);
    poseNear(pose, withBatterDepth(atContact.pose));
    const start = withBatterDepth(clip.frames[0].pose);
    assert.strictEqual(accentBackswing(start, clip, clip.start), start);
    assert.strictEqual(accentBackswing(pose, clip, 0.1), pose);
  }
  const clip = BATTER_CLIPS.straightDrive;
  const authored = withBatterDepth(clip.frames.find((frame) => frame.time === -clip.downswing).pose);
  const peak = sampleBatterMotion("straightDrive", -clip.downswing);
  assert.ok(peak.py < authored.py - 6);
  assert.ok(peak.handZ < authored.handZ - 2);
  assert.ok(peak.angle > authored.angle + 15);
  assert.ok(peak.shoulderTurn > authored.shoulderTurn);
});

test("the longer load protects contact and downswing timing for all attacks", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) {
    if (clip.kind !== "attack") continue;
    near(gamePreparationWindow(name), clip.downswing + BACKLIFT_TIME);
    for (const preparation of [BACKLIFT_TIME, POWER_BACKLIFT_TIME]) {
      const window = clip.downswing + preparation;
      near(gameMotionTime(name, -window, window), clip.start);
      near(gameMotionTime(name, -clip.downswing, window), -clip.downswing);
      near(gameMotionTime(name, 0, window), 0);
      near(gameMotionTime(name, 0.2, window), 0.2);
    }
  }
});

test("defence and leaves retain their current preparation and poses", () => {
  for (const [name, clip] of Object.entries(BATTER_CLIPS)) {
    if (clip.kind === "attack") continue;
    near(gamePreparationWindow(name), clip.kind === "leave" ? 0.22 : 0.12);
    const frame = clip.frames[1];
    poseNear(sampleBatterMotion(name, frame.time), withBatterDepth(frame.pose));
  }
});
