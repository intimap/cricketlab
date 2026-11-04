import { smoothAt } from "../keyframes.js";
import { clamp } from "../../math.js";
import { styleOf } from "./bowler-styles.js";

/**
 * The bowler's action through a ball, as a pose at `tr` seconds from release (negative before it): the
 * run-up's gait, then the keyframed delivery (bowler-styles.js) on smooth curves, then the follow-through
 * and standing. Positions are metres: `x` to the bowler's right of his run line, `y` up, `z` down the
 * pitch in the world (so a planted foot stays put). Hand positions for the front arm are offsets from
 * its shoulder (right, up, forward towards the batter); the bowling arm is an angle round its shoulder and
 * how straight it is (see bowler-styles.js). Drawing only: the sim decides nothing from it.
 */

const EVENTS = ["takeoff", "peak", "bfc", "ffc", "release", "f1", "f2", "f3", "f4"];
/** The run-up eases into the keyframed bound over this long after take-off (s), both still moving. */
const BLEND = 0.1;
/** The ball hand while running, carried in front of him. */
const CARRY = { r: -0.08, up: -0.2, fwd: 0.16 };
/** And from standing at his mark into the run over this long (s). */
const START = 0.3;
const RAD = Math.PI / 180;

const cache = new Map();

/** Every channel's keyframe values at the style's events. */
function keysOf(id) {
  if (cache.has(id)) return cache.get(id);
  const s = styleOf(id);
  const zF = s.ffcZ;
  const zB = zF + s.stride;
  const zT = zB + s.bound;
  const leap = s.height.peak - s.height.takeoff;
  const f = s.follow;
  const v = s.veer;
  const times = EVENTS.map((e) => (e === "release" ? 0 : s.times[e]));
  const table = (t) => EVENTS.map((e) => t[e]);
  const keys = {
    times,
    zT,
    px: [0, 0, 0.02, s.releaseX * 0.5, s.releaseX, -0.1, -v * 0.4, -v * 0.8, -v],
    py: table(s.height),
    pz: [zT - 0.15, zT - s.bound * 0.45, zB - 0.05, zB - s.stride * 0.52, zF, zF - 0.3, zF - f * 0.45, zF - f * 0.8, zF - f],
    hips: table(s.hips),
    shoulders: table(s.shoulders),
    pitch: table(s.pitch),
    roll: table(s.roll),
    arm: table(s.arm),
    reach: table(s.reach),
    // Front (left) foot: take-off, swung up and forward, the leg raised at back-foot contact, planted, pivoting.
    lfx: [-0.06, -0.08, -0.1, -0.1, -0.1, -0.1, -v * 0.35, -v * 0.65, -v * 0.65],
    lfy: [0, 0.25 + leap, 0.22, 0, 0, 0, 0.22, 0, 0],
    lfz: [zT, zT - s.bound * 0.5, zF + 0.55, zF, zF, zF, zF - f * 0.5, zF - f * 0.75, zF - f * 0.75],
    // Back (right) foot: driven up at take-off, tucked, landing side-on, dragging, swinging through.
    rfx: [0.05, 0.05, 0.05, 0.05, 0.02, -0.12, -v * 0.35, -v * 0.75, -v],
    rfy: [0.25, 0.38 + leap, 0, 0.02, 0.1, 0.35, 0, 0.2, 0],
    rfz: [zT - 0.4, zT - s.bound * 0.55, zB, zB, zB - 0.25, zF - 0.15, zF - f * 0.55, zF - f * 0.85, zF - f - 0.3],
    // Front hand from its shoulder: coming up, at the chin, reaching high at the batter, pulled down past the hip.
    lhr: [0.05, 0.22, -0.02, -0.05, -0.12, -0.08, 0.02, 0, 0],
    lhu: [-0.3, 0.02, 0.48, 0.38, -0.42, -0.5, -0.55, -0.58, -0.58],
    lhf: [0.15, 0.28, 0.42, 0.5, 0.02, -0.12, 0.05, 0.05, 0.05],
  };
  cache.set(id, keys);
  return keys;
}

const at = (keys, channel, tr) => smoothAt(keys.times, keys[channel], tr);
const smooth = (k) => k * k * (3 - 2 * k);

/** The delivery's keyframed pose at tr (held at the ends). */
function keyed(keys, tr) {
  const t = clamp(tr, keys.times[0], keys.times[keys.times.length - 1]);
  const v = (c) => at(keys, c, t);
  return {
    pelvis: { x: v("px"), y: v("py"), z: v("pz") },
    hips: v("hips"),
    shoulders: v("shoulders"),
    pitch: v("pitch"),
    roll: v("roll"),
    left: { x: v("lfx"), y: v("lfy"), z: v("lfz") },
    right: { x: v("rfx"), y: v("rfy"), z: v("rfz") },
    frontHand: { r: v("lhr"), up: v("lhu"), fwd: v("lhf") },
    arm: { angle: v("arm"), reach: v("reach"), weight: 1, hand: CARRY },
  };
}

/** Running in: alternate footfalls a stride apart ending on the take-off foot, arms pumping, the ball carried. */
function gait(id, keys, tau, runTime) {
  const s = styleOf(id);
  const { speed, stride, bounce, lean } = s.run;
  // Distance still to run before take-off: accelerating from a third of his speed at the mark (and on past
  // take-off at full speed, for the blend into the bound).
  const t = Math.min(tau, runTime);
  const dist = t < 0 ? speed * t : speed * (t - (0.33 * t * t) / Math.max(0.2, runTime));
  const pz = keys.zT - 0.15 + dist;
  const q = (pz - keys.zT) / stride;
  const k = Math.round(q);
  const u = q - k;
  const plant = (n) => keys.zT + n * stride;
  const p = 0.5 - u;
  // The swing foot lifts and sets down softly (no speed at either end of its stride).
  const swing = { z: plant(k + 1) + (plant(k - 1) - plant(k + 1)) * smooth(p), y: Math.sin(Math.PI * p) ** 2 * stride * 0.15 };
  const leftDown = k % 2 === 0;
  const support = { z: plant(k), y: 0 };
  const left = leftDown ? support : swing;
  const right = leftDown ? swing : support;
  const phase = Math.PI * q;
  const pump = Math.sin(phase) * 0.24;
  return {
    pelvis: { x: 0, y: s.height.takeoff - bounce * Math.cos(2 * Math.PI * u), z: pz },
    hips: 6 * Math.sin(phase),
    shoulders: -5 * Math.sin(phase),
    pitch: lean,
    roll: 0,
    left: { x: -0.09, y: left.y, z: left.z },
    right: { x: 0.09, y: right.y, z: right.z },
    // Elbows bent, the hands driving forward and back past his hips, the ball in the bowling hand.
    frontHand: { r: 0.08, up: -0.2 + Math.max(0, pump) * 0.25, fwd: 0.16 + pump * 0.8 },
    // (Its angle is the one the bound starts from, so easing into the bound never swings the arm round.)
    arm: {
      angle: s.arm.takeoff,
      reach: 0.6,
      weight: 0,
      hand: { r: -0.08, up: -0.2 + Math.max(0, -pump) * 0.2, fwd: 0.16 - pump * 0.6 },
    },
  };
}

/**
 * Standing at a spot (his mark, or where the follow-through stopped), the ball held at his waist. `angle` is
 * the bowling arm's, matched to the pose it eases from or into.
 */
function standing(x, z, angle) {
  return {
    pelvis: { x, y: 0.97, z },
    hips: 0,
    shoulders: 0,
    pitch: 3,
    roll: 0,
    left: { x: x - 0.12, y: 0, z },
    right: { x: x + 0.12, y: 0, z },
    frontHand: { r: 0.02, up: -0.55, fwd: 0.06 },
    arm: { angle, reach: 0.6, weight: 0, hand: { r: -0.06, up: -0.4, fwd: 0.14 } },
  };
}

/** Blend two poses (k = 0 is a, 1 is b): every number eased across. */
function blend(a, b, k) {
  const mix = (x, y) =>
    typeof x === "number" ? x + (y - x) * k : x === null || y === null ? (k < 0.5 ? x : y) : mixObject(x, y);
  const mixObject = (x, y) => Object.fromEntries(Object.keys(x).map((key) => [key, mix(x[key], y[key])]));
  return mixObject(a, b);
}

/**
 * The pose at `tr` seconds from release for bowling style `id`. `runTime`: how long the run-up is before the
 * take-off (s; his mark is that far back). Before the run starts he stands at his mark.
 */
export function bowlerAction(id, tr, runTime) {
  const keys = keysOf(id);
  const takeoff = keys.times[0];
  const last = keys.times[keys.times.length - 1];
  if (tr >= takeoff + BLEND) {
    const pose = keyed(keys, tr);
    if (tr <= last) return pose;
    // Pulling up after the follow-through, then standing.
    return blend(pose, standing(pose.pelvis.x, pose.pelvis.z, pose.arm.angle), smooth(clamp((tr - last) / 0.5)));
  }
  const tau = takeoff - tr;
  let pose = gait(id, keys, tau, runTime);
  if (tr > takeoff) pose = blend(pose, keyed(keys, tr), smooth((tr - takeoff) / BLEND));
  const fromStart = runTime - tau;
  if (fromStart < START) pose = blend(standing(0, pose.pelvis.z, pose.arm.angle), pose, smooth(clamp(fromStart / START)));
  return pose;
}

/** Where his mark is (world z) for a run-up of `runTime` seconds: where the run starts. */
export function markZ(id, runTime) {
  return gait(id, keysOf(id), runTime, runTime).pelvis.z;
}

/**
 * When his last two footfalls before the leap land (s from release), for a run-up of `runTime`: the beats the
 * player taps (sim/rhythm.js). The take-off foot lands half a stride before he's over it, the foot before it
 * a stride earlier still.
 */
export function rhythmBeats(id, runTime) {
  const s = styleOf(id);
  const keys = keysOf(id);
  const { speed, stride } = s.run;
  const a = 0.33 / Math.max(0.2, runTime);
  // Time before take-off at which he has `dist` still to run (the gait's distance, solved for time).
  const before = (dist) => (a > 0 ? (1 - Math.sqrt(Math.max(0, 1 - (4 * a * dist) / speed))) / (2 * a) : dist / speed);
  const landing = (q) => keys.times[0] - before(q * stride + 0.15);
  return [landing(1.5), landing(0.5)];
}

/** The style's event times (s from release), for frame sheets and tests. */
export function actionTimes(id) {
  const keys = keysOf(id);
  return Object.fromEntries(EVENTS.map((e, i) => [e, keys.times[i]]));
}

export { RAD };
