/**
 * The five bowling actions as data: each style's timing, distances and angles, from which bowler-action.js
 * builds the keyframes of a real action. A delivery runs through these events (seconds from release):
 *   takeoff  the jump off the front (left) foot into the bound
 *   peak     the top of the bound: the gather, hands up by the chin
 *   bfc      back-foot contact: side-on, the front arm reaching up at the batter, the bowling arm down behind
 *   ffc      front-foot contact: the front leg braced just behind the popping crease, the arm coming over
 *   release  the arm just past vertical, straight, close to the head (at 0)
 *   f1..f4   the follow-through: rotating through, the arm across the body, stepping off the pitch
 * Distances are metres (world z down the pitch, the front foot planting at `ffcZ`); angles are degrees.
 *   hips/shoulders: turn from facing the batter (0) towards side-on (90, the chest to the bowler's right)
 *   pitch: the trunk leaning forward (+); roll: bending away from the bowling arm (+), to get it up high
 *   arm: the bowling arm's angle round the shoulder (0 down by his side, 90 out behind when side-on,
 *        180 straight up, 270 at the batter), and `reach` how straight it is (1 straight)
 */

const FAST = {
  run: { speed: 6.6, stride: 1.75, bounce: 0.045, lean: 10 },
  times: { takeoff: -0.56, peak: -0.42, bfc: -0.27, ffc: -0.13, f1: 0.12, f2: 0.34, f3: 0.62, f4: 0.95 },
  ffcZ: 19.05,
  /** Back foot to front foot at the crease, and the bound before it (take-off to back-foot landing). */
  stride: 1.25,
  bound: 2.0,
  /** Pelvis height at each event (m, for a 1.85 m bowler). */
  height: { takeoff: 0.97, peak: 1.2, bfc: 0.9, ffc: 0.84, release: 0.98, f1: 0.84, f2: 0.88, f3: 0.95, f4: 0.97 },
  hips: { takeoff: 20, peak: 60, bfc: 72, ffc: 45, release: 0, f1: -38, f2: -52, f3: -30, f4: -10 },
  shoulders: { takeoff: 25, peak: 78, bfc: 98, ffc: 72, release: 15, f1: -48, f2: -72, f3: -36, f4: -10 },
  pitch: { takeoff: 6, peak: 0, bfc: -12, ffc: -4, release: 14, f1: 42, f2: 30, f3: 14, f4: 8 },
  roll: { takeoff: 0, peak: 0, bfc: 6, ffc: 10, release: 12, f1: 8, f2: 0, f3: 0, f4: 0 },
  arm: { takeoff: 300, peak: 330, bfc: 385, ffc: 455, release: 538, f1: 630, f2: 690, f3: 720, f4: 720 },
  reach: { takeoff: 0.62, peak: 0.55, bfc: 0.96, ffc: 1, release: 1, f1: 1, f2: 0.95, f3: 0.85, f4: 0.8 },
  /** How far the follow-through carries him down the pitch, and off it to his left. */
  follow: 2.6,
  veer: 1.15,
  /** His hips' drift to his right at release (m), putting the hand over the sim's release point. */
  releaseX: 0.12,
};

/** A style made from another by changing a few of its numbers (scaled times, distances, angle tables). */
function variant(base, changes) {
  const out = { ...base, ...changes };
  for (const k of ["run", "times", "height", "hips", "shoulders", "pitch", "roll", "arm", "reach"]) {
    out[k] = { ...base[k], ...(changes[k] ?? {}) };
  }
  return out;
}

const SWING = variant(FAST, {
  run: { speed: 5.9, stride: 1.6, bounce: 0.04, lean: 8 },
  times: { takeoff: -0.52, peak: -0.39, bfc: -0.26, ffc: -0.13, f1: 0.12, f2: 0.34, f3: 0.6, f4: 0.9 },
  stride: 1.15,
  bound: 1.6,
  height: { peak: 1.12 },
  shoulders: { bfc: 90, ffc: 66 },
  arm: { release: 537 },
  follow: 2.3,
  veer: 1.0,
});

const MEDIUM = variant(FAST, {
  run: { speed: 5.0, stride: 1.45, bounce: 0.035, lean: 7 },
  times: { takeoff: -0.48, peak: -0.36, bfc: -0.24, ffc: -0.12, f1: 0.12, f2: 0.32, f3: 0.56, f4: 0.85 },
  stride: 1.05,
  bound: 1.3,
  height: { peak: 1.08, ffc: 0.86, f1: 0.86 },
  hips: { bfc: 62, ffc: 38 },
  shoulders: { bfc: 84, ffc: 60 },
  pitch: { release: 13, f1: 34 },
  arm: { release: 538 },
  follow: 1.9,
  veer: 0.9,
});

const OFFSPIN = variant(FAST, {
  run: { speed: 3.4, stride: 1.05, bounce: 0.025, lean: 5 },
  times: { takeoff: -0.42, peak: -0.33, bfc: -0.22, ffc: -0.11, f1: 0.12, f2: 0.32, f3: 0.58, f4: 0.88 },
  ffcZ: 19.1,
  stride: 0.85,
  bound: 0.7,
  height: { takeoff: 0.96, peak: 1.06, bfc: 0.9, ffc: 0.88, release: 0.93, f1: 0.88, f2: 0.9, f3: 0.96, f4: 0.97 },
  hips: { takeoff: 30, peak: 70, bfc: 85, ffc: 60, release: 5, f1: -60, f2: -80, f3: -40, f4: -10 },
  shoulders: { takeoff: 35, peak: 80, bfc: 100, ffc: 80, release: 15, f1: -70, f2: -90, f3: -45, f4: -10 },
  pitch: { takeoff: 5, peak: 0, bfc: -5, ffc: 0, release: 18, f1: 34, f2: 24, f3: 12, f4: 6 },
  roll: { bfc: 5, ffc: 8, release: 8, f1: 6 },
  arm: { takeoff: 300, peak: 320, bfc: 380, ffc: 452, release: 532, f1: 620, f2: 680, f3: 720, f4: 720 },
  reach: { takeoff: 0.6, peak: 0.55, bfc: 0.9 },
  follow: 1.6,
  veer: 0.7,
  releaseX: 0.03,
});

/** Leg-spin: more side-on, the arm a touch lower and round, less of a pivot after. */
const LEGSPIN = variant(OFFSPIN, {
  hips: { bfc: 88, ffc: 70, release: 15, f1: -35, f2: -55 },
  shoulders: { bfc: 104, ffc: 88, release: 25, f1: -45, f2: -65 },
  roll: { ffc: 6, release: 6, f1: 4 },
  arm: { release: 536, f1: 600 },
  pitch: { release: 22, f1: 38 },
});

export const BOWLER_STYLES = { fast: FAST, swing: SWING, medium: MEDIUM, offspin: OFFSPIN, legspin: LEGSPIN };

/** The style's action, for a bowling style id (sim/teams.js); anything unknown bowls medium. */
export const styleOf = (id) => BOWLER_STYLES[id] ?? MEDIUM;
