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

/** Over how much of the pitch (a share of it) the non-striker angles from where he stood into his running lane. */
const LANE_BLEND = 0.15;

/**
 * A batter's spot (striker's frame) on the wide view and the mini-map while the ball's live: his running lane
 * (sim/running.js runnerPos). The non-striker stands out of the bowler's way (`standX`), angles into his lane as
 * he sets off and stays in it, even once he's home, until the next ball (when the close view puts him back),
 * rather than jumping across the pitch as he gets in.
 */
export function runnerSpot(scene, live, runner, standX) {
  const pos = live.runnerPos(runner);
  if (runner.bat !== live.setup.nonStrikerIdx) return pos;
  const left = (scene.cur.leftCrease ??= new Set());
  if (runner.progress < 1 - LANE_BLEND) left.add(runner.bat);
  if (left.has(runner.bat)) return pos;
  const k = clamp((1 - runner.progress) / LANE_BLEND);
  const standZ = nonStrikerDepth(scene);
  return { x: standX + (pos.x - standX) * k, z: standZ + (pos.z - standZ) * k };
}
