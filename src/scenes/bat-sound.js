import { clamp } from "../math.js";

/**
 * The sound of bat on ball, as layers for the synth (engine/audio.js playSound): { tones, bursts, clicks }.
 * A crack is several things at once: the click of leather on willow, the blade ringing at a few
 * out-of-tune pitches (brighter off the middle, duller mistimed), a knock of wood, a low thump when there's
 * weight behind it, and off the biggest hits a slap back from the stands. Edges, the toe and the splice each
 * have their own. Every hit is detuned a little, so no two sound the same.
 *
 * hit: { kind ("middle" or an edge), quality (0..1), power (0..1: how hard it left the bat), region ("toe",
 * "splice" or the blade), thickness (an edge's, 0 thin .. 1 thick) }. `rand`: the dice (presentation only).
 */

/** A struck sound's attack (s). */
const STRUCK = 0.001;
/** The blade's ring: each mode's pitch against the lowest, and how long it lasts against it. Not a harmonic series: wood. */
const MODES = [
  [1, 1],
  [2.32, 0.62],
  [4.1, 0.4],
  [6.4, 0.26],
];
/** Exit speed (m/s) of a full-blooded hit: the bat's sound is at full weight from here. */
export const FULL_POWER_SPEED = 36;
/** Weight behind it from here up brings the low thump in; a clean hit from ECHO_FROM, the slap back off the stands. */
const THUMP_FROM = 0.45;
/** The thump's level at full weight. */
const THUMP = 0.38;
const ECHO_FROM = 0.6;
/** The stands' slap back arrives this long after (s). */
const ECHO_DELAY = 0.13;

/** How hard a ball left the bat, 0..1, from its exit velocity (m/s). */
export const powerOf = (exit) => (exit ? clamp(Math.hypot(exit.x, exit.y, exit.z) / FULL_POWER_SPEED) : 0);

export function batSound({ kind = "middle", quality = 0.5, power = 0.5, region = null, thickness = 0.4 }, rand = Math.random) {
  // Each layer's pitch a few percent either way.
  const near = (f, spread = 0.08) => f * (1 + (rand() - 0.5) * spread);
  const tones = [];
  const bursts = [];
  const clicks = [];
  const ring = (freq, dur, vol, delay = 0, slide = 0) => tones.push([freq, dur, vol, "sine", delay, slide, STRUCK]);

  if (kind !== "middle") {
    // An edge: a thin, bright tick; the thicker it is, the more wood in it.
    const t = clamp(thickness);
    clicks.push([0.006 + 0.006 * t, 4200 - 1500 * t, 0.26 + 0.1 * t]);
    const f = near(1700 - 600 * t);
    ring(f, 0.02 + 0.02 * t, 0.1 + 0.1 * t, 0, -400);
    ring(near(f * 1.7), 0.014, 0.06);
    bursts.push([0.02 + 0.02 * t, 1800 - 600 * t, 2, 0.12 + 0.15 * t, 0, STRUCK]);
    if (t > 0.6) ring(near(520), 0.03, (0.1 * (t - 0.6)) / 0.4);
    return { tones, bursts, clicks };
  }

  if (region === "toe") {
    // Off the toe: a low clonk that jars up the handle (the buzz).
    tones.push([near(240), 0.08, 0.32, "triangle", 0, -60, STRUCK]);
    tones.push([near(118), 0.05, 0.08, "square", 0.004, 0]);
    bursts.push([0.04, 1200, 1, 0.3, 0, STRUCK]);
    clicks.push([0.005, 2600, 0.14]);
    return { tones, bursts, clicks };
  }
  if (region === "splice") {
    // Off the splice: dead wood, and the handle rattling after it.
    tones.push([near(170), 0.05, 0.3, "triangle", 0, -30, STRUCK]);
    bursts.push([0.04, 800, 0.8, 0.32, 0, STRUCK]);
    clicks.push([0.004, 2600, 0.12, 0.012]);
    clicks.push([0.004, 2600, 0.08, 0.03]);
    return { tones, bursts, clicks };
  }

  const q = clamp(quality);
  const p = clamp(power);
  // A block is soft; a full swing is all of it.
  const amp = 0.45 + 0.55 * p;
  // Leather on willow: sharper off the middle, and harder the harder it's hit.
  clicks.push([0.008 + 0.004 * q, 3200 + 1800 * q, amp * (0.25 + 0.4 * q) * (0.5 + 0.5 * p)]);
  // The blade's ring: off the middle it's higher and the upper modes sing; mistimed, they're all but gone.
  const f0 = near(380 + 140 * q);
  const length = 0.07 + 0.05 * p;
  const weights = [0.34 * (0.6 + 0.4 * q), 0.2 * (0.4 + 0.6 * q), 0.12 * q, 0.07 * q * p];
  MODES.forEach(([ratio, life], i) => {
    const f = i === 0 ? f0 : near(f0 * ratio);
    ring(f, length * life, amp * weights[i], 0, i === 0 ? -f * 0.18 : 0);
  });
  // The knock of wood.
  bursts.push([0.035 + 0.02 * p, 1500 + 700 * q, 3, amp * (0.3 + 0.25 * p), 0, STRUCK]);
  // Weight behind it.
  if (p > THUMP_FROM) ring(near(95), 0.07 + 0.05 * p, ((THUMP * (p - THUMP_FROM)) / (1 - THUMP_FROM)) * (0.5 + 0.5 * q), 0, -35);
  // Mistimed: a dull clunk under it, and a second little knock as it comes off the bat badly.
  if (q < 0.45) {
    const off = (0.45 - q) / 0.45;
    tones.push([near(190), 0.06, 0.25 * off * amp, "triangle", 0, -40, STRUCK]);
    bursts.push([0.02, 700, 1, 0.15 * off * amp, 0.018, STRUCK]);
  }
  // A big clean hit comes back off the stands.
  if (p > ECHO_FROM && q > 0.5) {
    bursts.push([0.06, 1100, 1, 0.07 * p, ECHO_DELAY]);
    ring(f0, 0.05, 0.05 * p, ECHO_DELAY);
  }
  return { tones, bursts, clicks };
}
