import { clamp } from "../math.js";
import { BAT_BLADE } from "./bat-impact.js";

/**
 * Each batter's bat (TODO.md, Batting): its weight (1.1-1.4 kg), how thick its edges are (36-44 mm) and its
 * handle (short, normal or long). It comes from his ratings and build (power hitters swing heavy bats with
 * big edges, tall men long handles) unless his squad says otherwise (`blade` in sim/squads/).
 *
 * A heavier bat hits harder (more of it meets the ball) but swings slower: a touch less bat speed, a longer
 * downswing and a narrower window. Big edges keep more pace off an edge. A long handle reaches a little
 * further and swings a little faster; a short one is easier to control.
 */

/** The average bat, which the rest of the batting is tuned around. */
export const AVERAGE_BLADE = Object.freeze({ weight: 1.25, edges: 40, handle: "normal" });
/** Handle lengths (m). */
export const HANDLES = Object.freeze({ short: 0.27, normal: 0.3, long: 0.33 });
const WEIGHTS = [1.1, 1.4];
const EDGES = [36, 44];
/** How the average bat turns about the hands, and where its weight sits (m from the toe): sim/bat-ball.js. */
const INERTIA = 0.05;
const BALANCE = 0.28;

/** A batter's bat, from his batting ratings (`bat`) and look, with the squad's `overrides` on top. */
export function bladeFor(bat, look, overrides = {}) {
  const height = look?.height ?? 1.82;
  const weight = clamp(1.12 + 0.24 * (bat?.power ?? 0.55) + 0.4 * (height - 1.8), ...WEIGHTS);
  const edges = clamp(Math.round(36 + 8 * (bat?.power ?? 0.55) + 10 * (weight - AVERAGE_BLADE.weight)), ...EDGES);
  const handle = height >= 1.9 ? "long" : height <= 1.72 ? "short" : "normal";
  return { weight: Math.round(weight * 100) / 100, edges, handle, ...overrides };
}

/** The bat as a body for the collision (sim/bat-ball.js): mass, inertia about the hands, balance, and its edges. */
export function batBody(blade = AVERAGE_BLADE) {
  const length = BAT_BLADE.length + HANDLES[blade.handle ?? "normal"];
  const average = BAT_BLADE.length + HANDLES.normal;
  return {
    mass: blade.weight,
    inertia: INERTIA * (blade.weight / AVERAGE_BLADE.weight) * (length / average) ** 2,
    balance: BALANCE,
    // How much pace its edges keep (0 thin, 1 big).
    edgeKeep: clamp((blade.edges - EDGES[0]) / (EDGES[1] - EDGES[0])),
  };
}

const handleOver = (blade) => HANDLES[blade.handle ?? "normal"] - HANDLES.normal;

/** His bat speed with this bat, times the average bat's: heavier slower, a long handle a little faster. */
export const swingSpeedOf = (blade = AVERAGE_BLADE) =>
  (AVERAGE_BLADE.weight / blade.weight) ** 0.2 * (1 + 0.5 * handleOver(blade));

/** How long its downswing takes, times the average bat's: a heavier bat comes down later. */
export const swingTimeOf = (blade = AVERAGE_BLADE) => (blade.weight / AVERAGE_BLADE.weight) ** 0.6;

/** His timing window with it, times the average: narrower for a heavy bat, a little wider for a short handle. */
export const windowOf = (blade = AVERAGE_BLADE) => (AVERAGE_BLADE.weight / blade.weight) ** 0.5 * (1 - 0.8 * handleOver(blade));

/** Extra reach (m) its handle gives. */
export const reachOf = (blade = AVERAGE_BLADE) => 0.4 * handleOver(blade);

/** On the team sheet: "1.28", with + for big edges and L or S for a long or short handle. */
export function bladeLabel(blade) {
  const edges = blade.edges >= 42 ? "+" : "";
  const handle = blade.handle === "long" ? "L" : blade.handle === "short" ? "S" : "";
  return `${blade.weight.toFixed(2)}${edges}${handle}`;
}
