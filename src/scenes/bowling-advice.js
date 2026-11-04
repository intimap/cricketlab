import { Rng } from "../sim/rng.js";
import { pickDeliveryPlan } from "../sim/ai.js";
import { isSpinner } from "../sim/teams.js";
import { deliveryName, aimAllowance, lengthName, lineName } from "../sim/delivery.js";
import { armOf } from "../sim/bowling-side.js";
import { selectedWicketSide } from "./bowling-side.js";

/**
 * The keeper's word in the setup panel while the player bowls: the ball the computer's own plan for the over
 * would bowl next (sim/ai.js), from what the player knows (the over plan only uses a weakness once it's
 * been given away). Enter takes it. Rolled on presentation dice, so asking never changes the match.
 */

/** What each over plan is for, said as the keeper would. */
const PLAN_WORDS = {
  short: "BOUNCE HIM",
  setup: "SET HIM UP",
  corridor: "THE CORRIDOR",
  squeeze: "SQUEEZE HIM",
  rough: "INTO THE ROUGH",
  flight: "TOSS IT UP",
  stock: "BOWL STOCK",
};

/** The keeper's suggestion for the next ball: { intent, lines (to show) }. */
export function suggestBall(scene) {
  const inn = scene.inn;
  const rng = new Rng(Math.floor(Math.random() * 2 ** 31));
  const { intent } = pickDeliveryPlan(inn, rng);
  const skills = inn.bowler.p.bowl;
  // The computer's lines are for a right-armer over the wicket to a right-hander: allow for the angle and turn.
  const flip = scene.match.facing * armOf(skills);
  const allow = aimAllowance(intent, skills, inn.ball, inn.pitch, flip, selectedWicketSide(scene));
  const plan = { ...intent, line: intent.line + allow };
  const spinner = isSpinner(skills);
  // A yorker or a bouncer says its own length.
  const length = plan.type === "yorker" || plan.type === "bouncer" ? "" : `${lengthName(plan.length, spinner)}, `;
  const where = `${length}${lineName(intent.line)}`.toUpperCase();
  return {
    intent: plan,
    lines: [`KEEPER: ${PLAN_WORDS[inn.overPlan] ?? "KEEP IT TIGHT"}.`, `${deliveryName(plan.type, skills)}, ${where}`],
  };
}

/** The player takes the keeper's ball (the "takeAdvice" action): delivery, effort and aim. */
export function takeAdvice(scene, plan) {
  scene.deliveryType = plan.type;
  scene.effort = plan.effort;
  scene.target = { line: plan.line, length: plan.length };
}
