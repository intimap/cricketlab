import { addBatterFootwork } from "./batter-footwork.js";
import { BACKLIFT_TIME } from "../../sim/shot-timing.js";
import { accentBackswing } from "./batter-backswing.js";
import { withBatterDepth } from "./batter-skeleton.js";

// Expanded visual sampler. Original three clips remain in batter-motion.js.
import { BATTER_CLIPS as currentClips } from "./batter-motion.js";
import { extendBatterShots } from "./batter-shot-extensions.js";
const BASE = { ...currentClips.straightDrive.frames[0].pose, crouch: 0 };
const stance = () => ({ ...BASE });
function clip(name, downswing, plant, frames, options = {}) {
  let pose = stance();
  return {
    name,
    downswing,
    contact: 0,
    start: frames[0][0],
    end: frames.at(-1)[0],
    plant,
    kind: "attack",
    group: "Batting",
    ...options,
    frames: frames.map(([time, phase, values, ease = "smooth"]) => {
      pose = { ...pose, ...values };
      return { time, phase, ease, pose: { ...pose } };
    }),
  };
}

export const BATTER_CLIPS = Object.fromEntries(
  Object.entries(currentClips).map(([name, c]) => [
    name,
    {
      ...c,
      kind: name === "forwardDefence" ? "defence" : "attack",
      group: name === "forwardDefence" ? "Defence and leave" : name === "pull" ? "Back-foot shots" : "Front-foot drives",
      frames: c.frames.map((f) => ({ ...f, pose: { ...BASE, ...f.pose } })),
    },
  ]),
);
Object.assign(BATTER_CLIPS, extendBatterShots({ clip, stance, clips: BATTER_CLIPS }));
/**
 * A clip's keyframes as channels for smooth sampling: times, and each numeric pose value per frame
 * (with depth filled in), cached on first use.
 */
const channelCache = new Map();
function channels(c) {
  let ch = channelCache.get(c);
  if (!ch) {
    const poses = c.frames.map((f) => withBatterDepth(f.pose));
    const keys = Object.keys(poses[0]).filter((k) => typeof poses[0][k] === "number");
    ch = {
      times: c.frames.map((f) => f.time),
      keys,
      values: keys.map((k) => poses.map((p) => p[k] ?? poses[0][k])),
      first: poses[0],
    };
    channelCache.set(c, ch);
  }
  return ch;
}

/**
 * A channel's value at t through its keyframes: a monotone cubic (Fritsch-Carlson), so every keyframe is hit
 * exactly and motion carries its speed through them (no jolt at contact) without overshooting a pose; it
 * comes to rest where a movement turns back, like the top of the backlift.
 */
function smoothAt(times, ys, t) {
  const n = times.length;
  let k = 0;
  while (k < n - 2 && t > times[k + 1]) k++;
  const h = times[k + 1] - times[k] || 1e-4;
  const slope = (i) => (ys[i + 1] - ys[i]) / (times[i + 1] - times[i] || 1e-4);
  const tangent = (i) => {
    if (i <= 0) return slope(0);
    if (i >= n - 1) return slope(n - 2);
    const d0 = slope(i - 1);
    const d1 = slope(i);
    if (d0 * d1 <= 0) return 0;
    const h0 = times[i] - times[i - 1];
    const h1 = times[i + 1] - times[i];
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / d0 + w2 / d1);
  };
  const s = Math.max(0, Math.min(1, (t - times[k]) / h));
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * ys[k] +
    (s3 - 2 * s2 + s) * h * tangent(k) +
    (-2 * s3 + 3 * s2) * ys[k + 1] +
    (s3 - s2) * h * tangent(k + 1)
  );
}

export function sampleBatterMotion(name, secondsFromContact, { view = "batter" } = {}) {
  const c = BATTER_CLIPS[name];
  if (!c) throw new Error(`Unknown batter clip: ${name}`);
  const t = Math.max(c.start, Math.min(c.end, secondsFromContact));
  const ch = channels(c);
  const pose = { ...ch.first };
  ch.keys.forEach((key, i) => {
    pose[key] = smoothAt(ch.times, ch.values[i], t);
  });
  // Camera changes belong to the projection, never to the canonical XYZ pose.
  if (view !== "batter" && view !== "bowler") throw new Error(`Unknown camera view: ${view}`);
  return addBatterFootwork(accentBackswing(pose, c, t), c, t, name);
}

export function gamePreparationWindow(name) {
  const c = BATTER_CLIPS[name];
  return c.kind === "leave" ? 0.22 : c.kind === "defence" ? 0.12 : c.downswing + BACKLIFT_TIME;
}

// Fit the authored load into the committed shot's preparation window.
// Downswings and contact remain at their original times. Defence has no swing to protect.
export function gameMotionTime(name, t, windowBeforeContact = gamePreparationWindow(name)) {
  const clip = BATTER_CLIPS[name];
  const swing = clip.kind === "defence" || clip.kind === "leave" ? 0 : clip.downswing;
  if (!(windowBeforeContact > swing)) throw new Error("Preparation window must exceed the protected downswing");
  if (t >= -swing) return t;
  const progress = Math.max(0, Math.min(1, (t + windowBeforeContact) / (windowBeforeContact - swing)));
  return clip.start + progress * (-swing - clip.start);
}

export function sampleGameBatterMotion(name, t, { view = "batter", windowBeforeContact = gamePreparationWindow(name) } = {}) {
  return sampleBatterMotion(name, gameMotionTime(name, t, windowBeforeContact), { view });
}
