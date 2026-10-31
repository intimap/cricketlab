import { clamp } from "../math.js";
import { bowlingGeometry } from "../sim/bowling-side.js";

/** The bowling arm is unchanged; the whole action moves to the selected side. */
export function bowlerPose(scene, side) {
  const cur = scene.cur;
  const lane = bowlingGeometry(scene.spinner, side);
  const startZ = cur?.runupStartZ ?? (scene.spinner ? 25.5 : 33);
  if (!cur || ["setup", "ready", "chooseBowler"].includes(scene.phase)) {
    return { x: lane.startX, z: startZ, pose: "stand", phase: 0 };
  }
  if (scene.phase === "runup") {
    const k = clamp(cur.tRun / cur.runupDur);
    const accel = 0.6 * k + 0.4 * k * k;
    const left = cur.runupDur - cur.tRun;
    return { x: lane.startX + (lane.bodyX - lane.startX) * k,
      z: startZ + (19.4 - startZ) * clamp(accel),
      pose: left < 0.08 ? "release" : left < 0.38 ? "bound" : "run", phase: cur.tRun * (1.6 + 2.2 * k) };
  }
  const t = cur.t;
  if (cur.done?.rec.wicket && scene.phase !== "flight") return { x: lane.bodyX + 0.35, z: 16.5, pose: "celebrate", phase: 0 };
  if (t < 0.12) return { x: lane.bodyX, z: 19, pose: "release", phase: 0 };
  const k = clamp((t - 0.12) / 0.8);
  const res = cur.play?.res;
  if (res?.padHit && (res.lbw || res.lbwNote) && t > res.start.t && t < res.start.t + 1.6)
    return { x: lane.bodyX + 0.35, z: 17.4, pose: "appeal", phase: 0 };
  return { x: lane.bodyX + 0.4 * k, z: 19 - 2.2 * k, pose: k < 1 ? "follow" : "walk", phase: t };
}
