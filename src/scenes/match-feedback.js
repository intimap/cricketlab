import { clamp } from "../math.js";
import { footworkWord } from "../sim/footwork-words.js";

/**
 * Arcade feedback for the match scene: what to show when the bat meets (or misses) the ball and when
 * a ball is done, the hit-stop and shake on a big moment, and the eye and pressure bars easing to
 * their new values. Presentation only: none of it touches the match's dice or its results.
 */

/** A hit-stop: ball time crawls at this rate for this long (s) after a sweet strike or broken stumps. */
const HIT_STOP = 0.05;
const HIT_STOP_RATE = 0.05;
/** The 1 px camera shake lasts a little longer than the stop. */
const SHAKE = 0.12;
/** A strike this clean (contact quality) earns the hit-stop. */
const SWEET = 0.65;
/** How long floating words and the timing meter stay up (s). */
const FLOAT_LIFE = 1;
const TIMING_LIFE = 1.2;
/** How quickly the bars catch up with their values (per second). */
const EASE = 5;
/** Smallest change in eye or pressure worth a floating tag. */
const NOTICEABLE = 0.01;

const WORDS = {
  timed: ["WELL TIMED", "#ffe066"],
  lofted: ["LOFTED", "#f4ecd0"],
  edged: ["EDGED", "#f08a24"],
  missed: ["MISSED", "#e0283c"],
};

export function createFeedback() {
  return { floats: [], timing: null, stopUntil: -1, shakeUntil: -1, shown: { eye: null, pressure: null } };
}

/** Freeze the frame for a beat, with a little shake. */
export function hitStop(fb, now) {
  fb.stopUntil = now + HIT_STOP;
  fb.shakeUntil = now + SHAKE;
}

/** The rate ball time runs at just now (1, or a crawl during a hit-stop). */
export const timeFactor = (fb, now) => (now < fb.stopUntil ? HIT_STOP_RATE : 1);

/** The camera's shake offset (px) just now. */
export function shakeOffset(fb, now) {
  if (now >= fb.shakeUntil) return null;
  return [
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
  ][Math.floor(now * 60) % 4];
}

function float(fb, now, text, color, anchor) {
  fb.floats.push({ text, color, anchor, t0: now });
}

/** What the shot looked like off the bat, in a word (or null for a leave or a block let go). */
function shotWord(res, shot) {
  const c = res.contact;
  if (shot.type === "leave" || c.missReason === "wide") return null;
  if (!res.touchedBat) return WORDS.missed;
  if (c.kind !== "middle") return WORDS.edged;
  if (shot.type === "loft" || shot.type === "ramp" || (c.exit && c.exit.y > 6)) return WORDS.lofted;
  return c.timed ? WORDS.timed : null;
}

/** The footwork word's colours: good feet gold, the rest the timing meter's late crimson. */
const FEET_GOOD = "#ffe066";
const FEET_BAD = "#e0283c";

/**
 * The ball has reached the bat (or gone past it): a word over the striker, the player's timing meter with
 * the footwork word under it (sim/footwork-words.js), and a hit-stop for a sweet strike. `pitchZ`: where it
 * pitched.
 */
export function onContact(fb, now, res, shot, playerBatting, pitchZ = 5) {
  const word = shotWord(res, shot);
  if (word) float(fb, now, word[0], word[1], "striker");
  const timing = res.contact.timing;
  if (playerBatting && shot.type !== "leave" && Number.isFinite(timing)) fb.timing = { timing, t0: now };
  const feet = playerBatting ? footworkWord(res, shot.type, pitchZ) : null;
  fb.footwork = feet ? { text: feet.text, color: feet.good ? FEET_GOOD : FEET_BAD, t0: now } : null;
  if (res.touchedBat && res.contact.quality > SWEET) hitStop(fb, now);
}

/** The ball is done: tags for the striker's eye (when the player bats) and the bowling pressure. */
export function onBallDone(fb, now, eye, pressure) {
  if (eye && Math.abs(eye.after - eye.before) >= NOTICEABLE)
    float(fb, now, eye.after > eye.before ? "+EYE" : "-EYE", eye.after > eye.before ? "#ffe066" : "#e0283c", "eye");
  if (pressure && Math.abs(pressure.after - pressure.before) >= NOTICEABLE)
    float(
      fb,
      now,
      pressure.after > pressure.before ? "+PRESSURE" : "-PRESSURE",
      pressure.after > pressure.before ? "#e0283c" : "#7ec8ff",
      "pressure",
    );
}

/** Ease the bars towards their values and let old words go. */
export function stepFeedback(fb, now, dt, eye, pressure) {
  const ease = (shown, value) => (shown === null ? value : shown + (value - shown) * Math.min(1, dt * EASE));
  fb.shown.eye = eye === null ? null : ease(fb.shown.eye, eye);
  fb.shown.pressure = ease(fb.shown.pressure, pressure);
  fb.floats = fb.floats.filter((f) => now - f.t0 < FLOAT_LIFE);
  if (fb.timing && now - fb.timing.t0 >= TIMING_LIFE) fb.timing = null;
  if (fb.footwork && now - fb.footwork.t0 >= TIMING_LIFE) fb.footwork = null;
}

/** Age (0..1) of a float, and how far the timing meter has faded (1 = fully shown). */
export const floatAge = (f, now) => clamp((now - f.t0) / FLOAT_LIFE);
export const timingFade = (fb, now) => clamp((TIMING_LIFE - (now - fb.timing.t0)) / 0.3);
export const footworkFade = (fb, now) => clamp((TIMING_LIFE - (now - fb.footwork.t0)) / 0.3);
