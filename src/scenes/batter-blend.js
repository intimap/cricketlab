import { BATTER_POSES } from "../render/batter/batter-rig.js";
import { BATTER_CLIPS } from "../render/batter/batter-motion-all.js";

/**
 * How a stroke on the rig joins the stance either side of it: eased in from the ready pose as it starts,
 * played, then eased back out to the stance. Pure, so tools/batter-snaps.mjs can check it for jolts.
 */

/** How long a stroke eases in from the ready pose, and back out to the stance after (s). */
export const RIG_BLEND_IN = 0.12;
export const RIG_BLEND_OUT = 0.24;
/** Crossfades start and finish at rest, so neither end of a blend jolts. */
const smooth = (k) => k * k * (3 - 2 * k);

/**
 * The striker's pose `rel` s from contact in stroke `name`, which started `window` s before contact from
 * `ready`. `sample(rel)` gives the clip's pose (shaped as the game wants, e.g. reaching for the ball).
 */
export function strokeTimeline(name, rel, window, ready, sample) {
  const end = BATTER_CLIPS[name].end;
  if (rel < -window) return ready;
  if (rel > end)
    return { ...BATTER_POSES.stance, from: sample(end), fromK: smooth(Math.max(0, 1 - (rel - end) / RIG_BLEND_OUT)) };
  const pose = sample(rel);
  const since = rel + window;
  return since < RIG_BLEND_IN ? { ...pose, from: ready, fromK: smooth(1 - since / RIG_BLEND_IN) } : pose;
}
