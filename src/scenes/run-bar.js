import { playerKit } from "../render/sprites.js";
import { canDive } from "../sim/running.js";

/**
 * When the run bar (render/run-bar.js) shows, and what's on it: from the moment the ball's played while
 * it's live, so you can judge whether there's a run, and a moment after it's dead; the batters' places
 * along the pitch and where a throw's going.
 */

/** How long it stays up once the ball's dead (s). */
const HOLD = 1.2;

export function runBarOf(scene) {
  const cur = scene.cur;
  const live = cur?.play?.live;
  if (!live || !cur.contactDone) return null;
  if (scene.phase !== "flight" && !(scene.phase === "after" && scene.phaseT < HOLD)) return null;
  return {
    runners: live.runners.map((r) => ({
      progress: r.progress,
      dir: r.target === null || live.t < r.startAt ? 0 : Math.sign(r.target - r.progress),
      kit: playerKit(scene.kitBat, scene.inn.bat[r.bat]?.p),
      down: !!r.diving || live.t < (r.downUntil ?? 0),
    })),
    throwTo: live.ball.throwing?.end ?? null,
    // The player's batters: a dive on offer, and runs he's asked for after this one.
    dive: scene.human === "bat" && live.runners.some((r) => canDive(live, r)),
    queued: scene.human === "bat" ? (live.queuedRuns ?? 0) : 0,
  };
}
