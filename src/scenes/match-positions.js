import { clamp } from "../math.js";
import { activeWicketSide } from "./bowling-side.js";
import { bowlerPose } from "../render/bowler-motion.js";

/** Where the non-striker and bowler are through a ball: shared by the close and wide views. */

/** Near the close camera, figures are capped at the striker's size (about 1.8 m in 94 px). */
export const NEAR_PIXELS_PER_METRE = 52;

/** How far down the pitch the non-striker backs up once the ball is bowled. */
export const BACKED_UP_Z = 17.9;

/** The non-striker backs up during the run-up. */
export function nonStrikerDepth(scene) {
  const cur = scene.cur;
  if (!cur) return 19.1;
  if (scene.phase === "runup") return 19.1 - clamp(cur.tRun / cur.runupDur) * 1.2;
  return cur.delivery ? BACKED_UP_Z : 19.1;
}

/** Bowler position and pose through run-up, delivery and follow-through. */
export function bowlerState(scene) {
  return bowlerPose(scene, activeWicketSide(scene));
}

/** How far through their walk-in the ring is (0..1): during the run-up, and at the ball once bowled. */
export function walkInShare(scene) {
  const cur = scene.cur;
  if (scene.phase === "runup" && cur) return clamp(cur.tRun / cur.runupDur);
  return scene.phase === "flight" ? 1 : 0;
}
