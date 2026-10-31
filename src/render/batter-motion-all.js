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
const ease = (kind, t) => (kind === "in" ? t * t : kind === "out" ? 1 - (1 - t) ** 2 : t * t * (3 - 2 * t));

export function sampleBatterMotion(name, secondsFromContact, { view = "batter" } = {}) {
  const c = BATTER_CLIPS[name];
  if (!c) throw new Error(`Unknown batter clip: ${name}`);
  const t = Math.max(c.start, Math.min(c.end, secondsFromContact));
  let left = c.frames[0],
    right = c.frames.at(-1);
  for (let i = 1; i < c.frames.length; i++) {
    if (t <= c.frames[i].time) {
      left = c.frames[i - 1];
      right = c.frames[i];
      break;
    }
  }
  const k = ease(left.ease, Math.max(0, Math.min(1, (t - left.time) / Math.max(0.0001, right.time - left.time))));
  const a = withBatterDepth(left.pose);
  const b = withBatterDepth(right.pose);
  const pose = {};
  for (const key of Object.keys(a)) pose[key] = a[key] + (b[key] - a[key]) * k;
  // Camera changes belong to the projection, never to the canonical XYZ pose.
  if (view !== "batter" && view !== "bowler") throw new Error(`Unknown camera view: ${view}`);
  return pose;
}

export function batterPhase(name, t) {
  const c = BATTER_CLIPS[name];
  if (t >= c.end) return "Ready";
  let phase = c.frames[0].phase;
  for (const frame of c.frames) if (t >= frame.time) phase = frame.phase;
  return phase;
}

export function gamePreparationWindow(name) {
  const c = BATTER_CLIPS[name];
  return c.kind === "leave" ? 0.22 : c.kind === "defence" ? 0.12 : c.downswing + 0.07;
}

// Compress the study's preparation into the existing player's available window.
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
