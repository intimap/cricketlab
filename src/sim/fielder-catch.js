import { clamp } from "../math.js";
import { ENDS } from "./geometry.js";
import { setState } from "./fielder-motion.js";
import { gatherDelay } from "./fielder-throw.js";

/** Most a settled fielder gains on a catch (tuned from 0.08), once set this long (s) before it arrives. */
const SET_BONUS = 0.04;
const SET_FOR = 0.3;
/** Taking it on the run (above this share of top speed) costs this much, and more above head height. */
const RUNNING_SHARE = 0.6;
const RUNNING_PENALTY = 0.06;
const HIGH_RUNNING_PENALTY = 0.04;
const HIGH = 2.2;

/**
 * The chance that fielder f holds the catch planned in `plan`, at time t: their hands, less the pace
 * of the ball, a dive and an awkward height (as before); more if they were waiting under it, less if
 * they were still running flat out.
 */
export function catchChance(f, plan, t) {
  const skill = f.player.field;
  const hands = f.role === "keeper" ? (skill.keeping + skill.catching) / 2 : skill.catching;
  const pace = clamp((plan.ballSpeed - 18) / 25) * 0.3;
  const awkward = plan.point.y > HIGH || plan.point.y < 0.25 ? 0.1 : 0;
  const set = f.state === "set" && f.setAt != null ? SET_BONUS * clamp((t - f.setAt) / SET_FOR) : 0;
  const running = f.curSpeed > RUNNING_SHARE * f.speed ? RUNNING_PENALTY + (plan.point.y > HIGH ? HIGH_RUNNING_PENALTY : 0) : 0;
  return clamp(0.55 + 0.42 * hands - pace - (plan.dive ? 0.32 : 0) - awkward + set - running, 0.05, 0.985);
}

// --- Fielding the ball: what happens when the planned fielder gets to it (ball-in-play.js calls this) ---

/** The planned fielder reaches the ball: catch or drop, stop or misfield. */
export function resolvePlan(live) {
  const plan = live.plan;
  const f = live.fielders[plan.fielder];
  const rng = live.setup.rng;
  const name = f.role === "keeper" ? "the keeper" : f.role === "bowler" ? "the bowler" : f.spot;
  const skill = f.player.field;
  live.plan = null;
  const wasSet = f.state === "set";
  // Jobs are done once they're at the ball.
  f.job = null;
  f.arriveBy = null;
  if (plan.dive) {
    setState(f, "dive", live.t);
    live.emit("dive", { fielder: f.idx });
  }

  if (plan.kind === "catch") {
    const chance = catchChance(f, plan, live.t);
    if (rng.chance(chance)) {
      live.ball.held = f.idx;
      live.ball.vel = { x: 0, y: 0, z: 0 };
      if (live.safe) {
        live.emit("gather", { fielder: f.idx, text: "no-ball" });
        live.pickupAt = live.t + 0.3;
      } else {
        live.emit("catch", { fielder: f.idx });
        f.state = "celebrate";
        f.stateAt = live.t;
        live.endWithWicket({ how: "caught", batter: live.setup.strikerIdx, fielder: name, caughtBehind: f.role === "keeper" });
      }
      return;
    }
    live.catchDropped = name;
    live.emit("drop", { fielder: f.idx });
    const v = live.ball.vel;
    const speed = Math.hypot(v.x, v.y, v.z) * 0.22;
    const dir = rng.range(0, Math.PI * 2);
    live.ball.vel = { x: Math.cos(dir) * speed, y: Math.abs(v.y) * 0.15, z: Math.sin(dir) * speed };
    live.ball.bounced = true;
    f.busyUntil = live.t + 0.8;
    if (plan.dive) setState(f, "down", live.t);
    live.replan();
    return;
  }

  if (plan.kind === "stop" || plan.kind === "collect" || plan.kind === "pickup") {
    const keeper = f.role === "keeper";
    const fumble =
      plan.kind === "pickup"
        ? 0.01
        : keeper && plan.kind === "collect"
          ? (1 - skill.keeping) * 0.09 + (plan.dive ? 0.12 : 0)
          : clamp(0.015 + 0.11 * clamp(plan.ballSpeed / 30) + (plan.dive ? 0.16 : 0) - 0.06 * skill.catching, 0.01, 0.4);
    if (rng.chance(fumble)) {
      live.emit(keeper ? "fumble" : "misfield", { fielder: f.idx });
      const v = live.ball.vel;
      const speed = Math.hypot(v.x, v.z) * 0.45;
      const dir = Math.atan2(v.x, v.z) + rng.normal(0, 0.5);
      live.ball.vel = { x: Math.sin(dir) * speed, y: 0, z: Math.cos(dir) * speed };
      live.ball.bounced = true;
      f.busyUntil = live.t + 0.9;
      if (plan.dive) setState(f, "down", live.t);
      live.replan();
      return;
    }
    live.ball.held = f.idx;
    live.ball.vel = { x: 0, y: 0, z: 0 };
    f.state = "hold";
    f.stateAt = live.t;
    f.target = null;
    f.curSpeed = 0;
    live.emit(keeper && plan.kind === "collect" ? "collect" : "stop", { fielder: f.idx });

    if (keeper && live.setup.res.stumpingChance && !live.safe && !live.setup.wide) {
      live.runners[0].progress = 0.08;
      live.emit("stumped", { fielder: f.idx });
      live.endWithWicket({ how: "stumped", batter: live.setup.strikerIdx, fielder: "the keeper" });
      return;
    }
    // Already by the stumps? Then no throw is needed.
    for (const end of [0, 1]) {
      const dist = Math.hypot(f.pos.x - ENDS[end].x, f.pos.z - ENDS[end].z);
      if (dist < 3 || (keeper && end === 0 && dist < 18 && !live.running)) {
        live.ball.atEnd = end;
        live.ball.thrownIn = false;
        live.breakDelay = 0.28 + dist / 22;
        live.idleSince = live.t;
        return;
      }
    }
    f.dived = plan.dive;
    f.wasSet = wasSet;
    live.pickupAt = live.t + gatherDelay(plan.dive);
  }
}
