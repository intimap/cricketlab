import { clamp } from "../math.js";
import { bowlingGeometry, armOf } from "../sim/bowling-side.js";
import { bowlerAction, actionTimes, markZ } from "./bowler/bowler-action.js";

/**
 * Where the bowler is and what he's doing through a ball: his action (render/bowler/) at the time from
 * release, on his run line for the chosen side. `rig` is what the close view draws him from; `pose` and
 * `phase` are the wide view's tiny figure (render/tiny-figures.js). A wicket's celebration and an appeal
 * are still the older figure's poses (rig null).
 */
export function bowlerPose(scene, side) {
  const cur = scene.cur;
  const style = scene.inn?.bowler?.p.bowl?.style ?? (scene.spinner ? "offspin" : "medium");
  // A left-armer's lane is the mirror image of a right-armer's, and so is his action (render/bowler/).
  const arm = armOf(scene.inn?.bowler?.p.bowl);
  const lane = bowlingGeometry(scene.spinner, side, arm);
  const times = actionTimes(style);
  const runupDur = cur?.runupDur ?? (scene.spinner ? 1.5 : 2.4);
  const runTime = Math.max(0.3, runupDur + times.takeoff);
  let tr;
  if (!cur || ["setup", "ready", "chooseBowler"].includes(scene.phase)) tr = -runupDur - 1;
  else if (scene.phase === "runup") tr = Math.min(0, cur.tRun - runupDur);
  else tr = cur.t;

  const t = cur?.t ?? 0;
  if (cur?.delivery && cur.done?.rec.wicket && scene.phase !== "flight")
    return { x: lane.bodyX + 0.35 * arm, z: 16.5, pose: "celebrate", phase: 0, rig: null };
  const res = cur?.play?.res;
  if (cur?.delivery && res?.padHit && (res.lbw || res.lbwNote) && t > res.start.t && t < res.start.t + 1.6)
    return { x: lane.bodyX + 0.35 * arm, z: 17.4, pose: "appeal", phase: 0, rig: null };

  // His run line eases in from the side of his mark to the crease.
  const k = clamp((tr + runupDur) / runupDur);
  const line = tr >= times.takeoff ? lane.bodyX : lane.startX + (lane.bodyX - lane.startX) * k * k * (3 - 2 * k);
  const action = bowlerAction(style, tr, runTime);
  return {
    x: line - action.pelvis.x * arm,
    z: action.pelvis.z,
    pose: legacyPose(tr, times, runupDur),
    phase: Math.max(0, tr + runupDur) * 3.2,
    rig: { action, line, style, arm },
    mark: markZ(style, runTime),
  };
}

/** The tiny figure's pose for the same moment. */
function legacyPose(tr, times, runupDur) {
  if (tr < -runupDur) return "stand";
  if (tr < times.takeoff) return "run";
  if (tr < times.bfc) return "bound";
  if (tr < times.f1) return "release";
  if (tr < times.f4) return "follow";
  return "walk";
}
