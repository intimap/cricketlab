import { clamp } from "../math.js";
import { crossingAtZ } from "./delivery.js";
import { playsBack } from "./shot-choice.js";

/**
 * The batter's feet (TODO.md, Batting): they decide where and when the bat meets the ball. He takes guard
 * on the crease. A stride forward meets the ball further down, nearer where it pitched; going back meets it
 * deeper, with longer to watch it; down the pitch further still. Each stride takes time: started late, he's
 * caught part of the way and the bat meets the ball wherever his feet have got to. Across the crease his
 * body, pads and reach go with him. How he stands decides how high and low the bat can get (batRange), so
 * the wrong feet hurt through where the ball is, not a penalty.
 *
 * A shot's feet: { stride: "crease" | "forward" | "back" | "down", across (m, + to his off side),
 * from (ball time he started the stride, or null for in good time) }.
 */

/** Where he meets the ball (m from his stumps) with the stride made, and how long it takes (s, average feet). */
export const STRIDES = Object.freeze({
  crease: Object.freeze({ z: 1.45, time: 0 }),
  forward: Object.freeze({ z: 1.95, time: 0.2 }),
  back: Object.freeze({ z: 0.85, time: 0.15 }),
  down: Object.freeze({ z: 3.4, time: 0.45 }),
});

/**
 * How high (m) the middle of the bat can meet the ball from each stance, all the way there. The front knee
 * bent gets it down to a full one but can't get over a short one; back and tall it's the other way round.
 * An upright bat (drives, blocks, lofts) and one swung across the body (cuts, pulls) differ; a sweep is
 * played down on one knee.
 */
const UPRIGHT = { crease: [0.16, 0.95], forward: [0.1, 0.68], back: [0.24, 1.4], down: [0.08, 0.8] };
const ACROSS = { crease: [0.4, 1.45], forward: [0.35, 1.0], back: [0.45, 1.65], down: [0.3, 1.1] };
const KNEELING = [0.04, 0.8];
const RAMP = [0.35, 1.5];

/**
 * He takes guard at STANCE_X (m, just leg side of middle); today's controls step him across the crease as
 * far as FOOTWORK_MIN (leg side) or FOOTWORK_MAX (off side).
 */
export const STANCE_X = -0.14;
export const FOOTWORK_MIN = -0.1;
export const FOOTWORK_MAX = 0.1;
/** How far the player can take him across the crease (m): towards the off side, or away to leg. */
export const PLAYER_ACROSS = Object.freeze({ off: 0.3, leg: -0.3 });
/** How far the computer's batters shuffle towards the line they've read (share of the way). */
const AI_FOOTWORK = 0.5;

/**
 * How far either side of his body he can reach the ball (m): less for a block than an attacking shot, and
 * less behind him to leg than to the off side, which he faces. Beyond it the ball goes past the bat.
 */
export const REACH = Object.freeze({ attack: { off: 0.65, leg: 0.5 }, defend: { off: 0.42, leg: 0.32 } });

/**
 * How much of his weight goes into the shot from these feet (bat speed, times): a drive wants the front
 * foot (or a charge), a cut or pull the back foot; from the crease neither gets it all.
 */
const WEIGHT = {
  front: { crease: 0.85, forward: 1, back: 0.75, down: 1.05 },
  back: { crease: 0.85, forward: 0.8, back: 1, down: 0.75 },
  either: { crease: 0.9, forward: 1, back: 1, down: 1 },
};
const FRONT_FOOT_SHOTS = new Set(["drive", "loft", "sweep", "reverseSweep"]);
const BACK_FOOT_SHOTS = new Set(["cutpull", "ramp"]);
export function weightInto(type, feet, made) {
  const table = FRONT_FOOT_SHOTS.has(type) ? WEIGHT.front : BACK_FOOT_SHOTS.has(type) ? WEIGHT.back : WEIGHT.either;
  const full = table[feet.stride] ?? 1;
  return table.crease + (full - table.crease) * made;
}

/**
 * How fast the bat is still coming down as it meets the ball (m/s), from these feet: from the back foot or
 * the crease it comes down steeply, so played late it's still above a low ball; striding forward it comes
 * through flatter. Cross-batted shots swing level.
 */
const DESCENT = { crease: 2, forward: 0.8, back: 3, down: 0.8 };
export const batDescent = (feet, made, crossBat) =>
  crossBat ? 0 : DESCENT.crease + ((DESCENT[feet.stride] ?? DESCENT.forward) - DESCENT.crease) * made;

/** The feet a shot is played with: its own, or for a shot that only says front or back, from that and the length. */
export function feetOf(shot, pitchZ) {
  if (shot?.feet) return shot.feet;
  const back = playsBack(shot?.type ?? "drive", shot?.foot ?? null, pitchZ);
  return { stride: back ? "back" : "forward", across: shot?.footwork ?? 0, from: null };
}

/** The time a stride takes (s): quicker for nimble feet. */
export const strideTime = (stride, footwork = 0.5) => (STRIDES[stride] ?? STRIDES.forward).time * (1.25 - 0.5 * footwork);

/** How far his feet have got (0..1) at ball time t. */
function madeBy(feet, t, footwork) {
  const time = strideTime(feet.stride, footwork);
  if (feet.from === null || feet.from === undefined || time <= 0) return 1;
  return clamp((t - feet.from) / time);
}

/**
 * Where and when the bat meets delivery `d` from these feet: { at (the ball there, from crossingAtZ), z, made
 * (how much of the stride he'd made, 1 = all of it) }. `at` is null if the ball never gets there.
 */
export function contactFor(d, feet, footwork = 0.5) {
  const full = (STRIDES[feet.stride] ?? STRIDES.forward).z;
  const crease = STRIDES.crease.z;
  let at = crossingAtZ(d.samples, full);
  if (!at || madeBy(feet, at.t, footwork) >= 1) return { at, z: full, made: 1 };
  // Caught part of the way: where his moving feet and the ball meet (between the crease and the full stride).
  const gap = (z) => {
    const there = crossingAtZ(d.samples, z);
    if (!there) return 0;
    return z - (crease + (full - crease) * madeBy(feet, there.t, footwork));
  };
  let lo = Math.min(crease, full);
  let hi = Math.max(crease, full);
  const loSign = Math.sign(gap(lo));
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(gap(mid)) === loSign) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  at = crossingAtZ(d.samples, z) ?? at;
  return { at, z, made: madeBy(feet, at.t, footwork) };
}

/**
 * How high and low (m) the middle of the bat can get from these feet, `made` of the way there, for this
 * shot. Beyond it the ball meets the bat's toe or bottom edge, or its splice, top edge or the gloves.
 */
export function batRange(feet, made, type, horizontal) {
  if (type === "sweep" || type === "reverseSweep") return KNEELING;
  if (type === "ramp") return RAMP;
  const table = horizontal ? ACROSS : UPRIGHT;
  const from = table.crease;
  const to = table[feet.stride] ?? table.forward;
  return [from[0] + (to[0] - from[0]) * made, from[1] + (to[1] - from[1]) * made];
}

/** Where his pads are (m from the stumps) when the ball gets to him: just behind where the bat meets it. */
export const padDepth = (z) => Math.max(0.7, z - 0.4);

/** Odds a computer batter with heavy feet (footwork 0) stays on the crease instead of committing. */
const CREASE_ODDS = 0.08;
/** Odds an aggressive, nimble computer batter (both 1) charges a pitched-up spinner. */
const CHARGE_ODDS = 0.35;

/**
 * The computer batter's feet for the shot he's chosen, from his read of the length (`pitchZ`): forward to a
 * full one, back to a short one (`line` the line he's read); with heavy feet sometimes stuck on the crease; down the pitch to a spinner
 * now and then, or swinging for it. He gets them going a moment after release, sooner with quick feet and a
 * settled eye, later against spin (there's longer to wait).
 */
export function computerFeet({ type, pitchZ, line, spinner, footwork, settled, aggression, slog, rng, charge = 0 }) {
  let stride;
  if (type === "cutpull" || type === "ramp") stride = "back";
  else if (type === "sweep" || type === "reverseSweep") stride = "forward";
  else if (type === "defend") stride = pitchZ > 6.8 ? "back" : "forward";
  else if (type === "leave") stride = pitchZ > 7 ? "back" : "forward";
  else stride = pitchZ > 7.5 ? "back" : "forward";
  if ((type === "drive" || type === "loft") && pitchZ > 2.5 && pitchZ < 6.5) {
    // `charge`: the format's extra hurry to get at it (sim/styles.js).
    const odds = (spinner ? CHARGE_ODDS * aggression * footwork : slog ? 0.25 : 0) + charge * aggression * footwork;
    if (odds > 0 && rng.chance(odds)) stride = "down";
  }
  if (type !== "leave" && stride !== "down" && rng.chance(CREASE_ODDS * (1 - footwork))) stride = "crease";
  const from = (0.1 + 0.1 * (1 - footwork) + 0.04 * (1 - settled)) * (spinner ? 1.5 : 1) + rng.normal(0, 0.03);
  // He shuffles part of the way across to the line he's read.
  const across = type === "leave" ? 0 : clamp((line - STANCE_X) * AI_FOOTWORK, FOOTWORK_MIN, FOOTWORK_MAX);
  return { stride, across, from: Math.max(0, from) };
}
