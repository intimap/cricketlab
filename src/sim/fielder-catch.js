import { clamp } from "../math.js";

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
