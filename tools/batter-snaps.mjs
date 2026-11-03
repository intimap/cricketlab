// Where the striker's animation snaps: plays every stroke the way the game does (trigger, blend in from the
// ready pose, the clip, blend back out to the stance) at 60 fps and reports sudden changes of joint speed.
//
//   node tools/batter-snaps.mjs            worst jolt per clip, and when
//   node tools/batter-snaps.mjs pull       frame-by-frame for one clip
import { BATTER_CLIPS, sampleGameBatterMotion, gamePreparationWindow } from "../src/render/batter/batter-motion-all.js";
import { solveBatterSkeleton } from "../src/render/batter/batter-skeleton.js";
import { BATTER_POSES, lerpPose } from "../src/render/batter/batter-rig.js";
import { strokeTimeline } from "../src/scenes/batter-blend.js";

const JOINTS = ["head", "chest", "pelvis", "topHand", "batToe", "frontFoot", "backFoot", "frontKnee", "backKnee", "frontElbow"];
const FPS = 60;

/** Joint positions through the whole stroke, frame by frame. */
export function strokeFrames(name) {
  const ready = lerpPose(BATTER_POSES.stance, BATTER_POSES.trigger, 1);
  const window = gamePreparationWindow(name);
  const clip = BATTER_CLIPS[name];
  const frames = [];
  for (let t = -window - 0.1; t <= clip.end + 0.35; t += 1 / FPS) {
    const pose = strokeTimeline(name, t, window, ready, (rel) => sampleGameBatterMotion(name, rel, { windowBeforeContact: window }));
    const s = solveBatterSkeleton(pose);
    frames.push({ t, joints: JOINTS.map((j) => s[j]) });
  }
  return frames;
}

/**
 * The biggest jolt of any joint, and when: the change in its acceleration between frames (rig units).
 * A fast arc accelerates smoothly and scores low; a snap, where motion lurches, scores high.
 */
export function worstJolt(frames) {
  let worst = { jolt: 0, t: 0, joint: "" };
  for (let i = 3; i < frames.length; i++) {
    for (let j = 0; j < JOINTS.length; j++) {
      const [a, b, c, d] = [frames[i - 3], frames[i - 2], frames[i - 1], frames[i]].map((f) => f.joints[j]);
      const jolt = Math.hypot(d.x - 3 * c.x + 3 * b.x - a.x, d.y - 3 * c.y + 3 * b.y - a.y, d.z - 3 * c.z + 3 * b.z - a.z);
      if (jolt > worst.jolt) worst = { jolt, t: frames[i].t, joint: JOINTS[j] };
    }
  }
  return worst;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2];
  const rows = Object.keys(BATTER_CLIPS)
    .filter((n) => !only || n === only)
    .map((name) => ({ name, ...worstJolt(strokeFrames(name)) }))
    .sort((a, b) => b.jolt - a.jolt);
  for (const r of rows) console.log(`${r.name.padEnd(22)} jolt ${r.jolt.toFixed(1).padStart(5)} at ${r.t.toFixed(2)}s (${r.joint})`);
}
