import { clamp } from "../math.js";
import { releaseSweetSpot } from "./delivery.js";

/**
 * The player's run-up and the release meter it drives. Each ball gets its own
 * plan, so the timing can't simply be learnt:
 *   - the run-up time varies a little (rhythm), and with style and effort;
 *   - the marker accelerates into the crease (ramp), more for quicks and big efforts;
 *   - the marker surges and eases with the strides (wobble), more when the
 *     bowler is tired, settling right at the crease so a perfect release is still there;
 *   - effort trades zone width for pace: high effort, narrower gold zone.
 *
 * The meter runs in "position" units: 0 at the start of the run-up, 1 at the
 * delivery stride. Release errors come back in seconds-equivalent so the
 * delivery model (no-balls, length) reads them as before.
 */

/** Base run-up time (seconds) by bowling style. */
const STYLE_RUNUP = { fast: 2.5, swing: 2.3, medium: 2.2, offspin: 1.5, legspin: 1.5 };
/** Effort changes the approach: a big effort is quicker in. */
const EFFORT_RUNUP = { low: 1.08, med: 1, high: 0.93 };
/** How hard the marker accelerates (1 = steady). */
const EFFORT_RAMP = { low: 1.25, med: 1.5, high: 1.8 };
/** Spinners amble in: this share of the ramp. */
const SPINNER_RAMP_SHARE = 0.45;
/** Ball-to-ball variation in run-up time (fraction, standard deviation). */
const RHYTHM_SD = 0.07;
/** Stride surges, as a share of the marker's speed: fresh, plus extra when tired (keep the sum under 0.8). */
const WOBBLE_FRESH = 0.15;
const WOBBLE_TIRED = 0.45;
/** Strides per second through the run-up. */
const STRIDE_RATE = 3.3;
/** Gold zone width by effort, relative to the base sweet spot. */
const EFFORT_ZONE = { low: 1.5, med: 1.2, high: 0.85 };
/** The gold zone never passes in less than this (seconds), however tired and hard-running the bowler. */
const MIN_GOLD_WINDOW = 0.04;
/** Releasing this late (seconds-equivalent) or later is a no-ball on the meter. */
export const METER_NO_BALL = 0.11;
/** The meter shows from this far into the run-up... */
export const METER_FROM = 0.4;

/**
 * A run-up for one ball. `random` is a () => [0, 1) source (presentation only).
 * Returns { dur, ramp, wobble, phase, zone }. The gold zone spans meter
 * positions 1 +/- zone / dur.
 */
export function planRunup(style, effort, stamina, random = Math.random) {
  const spinner = style === "offspin" || style === "legspin";
  const gauss = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const rhythm = clamp(1 + gauss() * RHYTHM_SD * (1.4 - 0.4 * stamina), 0.8, 1.2);
  const ramp = 1 + (EFFORT_RAMP[effort] - 1) * (spinner ? SPINNER_RAMP_SHARE : 1);
  return {
    dur: (STYLE_RUNUP[style] ?? 2.2) * EFFORT_RUNUP[effort] * rhythm,
    ramp,
    wobble: WOBBLE_FRESH + WOBBLE_TIRED * (1 - stamina),
    phase: random() * Math.PI * 2,
    // Half-width of the gold zone, as a release error (seconds-equivalent).
    zone: Math.max(releaseSweetSpot(stamina) * EFFORT_ZONE[effort], (MIN_GOLD_WINDOW * ramp) / 2),
  };
}

/** Marker position at run-up time t: accelerating to 1 at the stride, then on at the same pace. */
export function meterPos(r, t) {
  const k0 = Math.max(0, t / r.dur);
  // Stride surges speed the marker up and slow it down (never backwards), fading
  // out at both ends so the stride itself still lands exactly at 1.
  const w = 2 * Math.PI * STRIDE_RATE;
  const surge = k0 < 1 ? (r.wobble * Math.sin(w * t + r.phase) * Math.sin(Math.PI * k0)) / w : 0;
  const k = Math.max(0, (t + surge) / r.dur);
  return k <= 1 ? k ** r.ramp : 1 + (k - 1) * r.ramp;
}

/** Release error (seconds-equivalent, + is late) for a release at meter position `pos`. */
export function releaseError(r, pos) {
  return (pos - 1) * r.dur;
}

/** Meter position past which a release is a no-ball (where the red starts). */
export const noBallPos = (r) => 1 + METER_NO_BALL / r.dur;
