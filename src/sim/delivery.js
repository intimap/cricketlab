import { clamp } from "../math.js";
import { GRAVITY, CREASE, STUMPS_HALF_WIDTH, STUMPS_HEIGHT, BALL_RADIUS } from "./geometry.js";
import { isSpinner, bowlingSpeed } from "./teams.js";

export const EFFORTS = ["low", "med", "high"];
const EFFORT_SPEED = { low: 0.93, med: 1, high: 1.055 };
const EFFORT_SPRAY = { low: 0.8, med: 1, high: 1.4 };
export const EFFORT_STAMINA = { low: 0.65, med: 1, high: 1.6 };

export const DELIVERY_NAMES = { seam: "SEAM", outswing: "OUTSWING", inswing: "INSWING", offspin: "OFFSPIN", legspin: "LEGSPIN" };

/** Flight simulation time step (seconds). */
const DT = 1 / 240;

/**
 * Turn a bowler's intent into an actual delivery: speed, where it really
 * lands (accuracy, fatigue and release timing all spray it), swing, seam,
 * spin and bounce, then simulate its flight.
 *
 * intent: { type, line, length, effort }. line is x at the stumps, length is
 * the intended pitching distance from the striker's stumps.
 * releaseError: seconds early (<0) or late (>0) at the delivery stride.
 */
export function bowlDelivery(intent, skills, stamina, ball, pitch, releaseError, rng) {
  const spinner = isSpinner(skills);
  const tiredness = 1 - stamina;
  let speed = bowlingSpeed(skills) * EFFORT_SPEED[intent.effort] * (0.88 + 0.12 * stamina);
  speed *= 1 + rng.normal(0, 0.012);

  const spray = (1.35 - skills.accuracy) * (1 + tiredness * 1.3) * EFFORT_SPRAY[intent.effort];
  const badRelease = Math.abs(releaseError) > 0.1 ? 2.2 : 1;
  const line =
    intent.line + rng.normal(0, 0.075 * spray * badRelease) + Math.abs(releaseError) * 1.6 * (rng.next() < 0.5 ? -1 : 1);
  // Releasing late drags the ball fuller, early drops it shorter.
  let length = intent.length + rng.normal(0, 0.55 * spray * badRelease) - releaseError * 26;
  length = clamp(length, -1.5, 15);

  const noBall =
    releaseError > 0.11 ||
    (intent.effort === "high" && releaseError > 0.075 && rng.chance(0.5)) ||
    rng.chance(0.004 + tiredness * 0.006);

  let swingDir = 0;
  if (intent.type === "outswing") swingDir = 1;
  else if (intent.type === "inswing") swingDir = -1;
  else if (intent.type === "seam") swingDir = rng.normal(0, 0.25);

  // Lateral acceleration in the air (m/s^2).
  let swingAcc = 0;
  let reversing = false;
  if (spinner) {
    swingAcc = (intent.type === "offspin" ? 0.9 : intent.type === "legspin" ? -0.9 : 0) * skills.spin * ball.grip * 0.6;
  } else {
    const conventional = ball.swing * pitch.type.swingAir;
    const reverse = speed > 32.5 ? ball.reverse * pitch.type.swingAir : 0;
    if (reverse > conventional * 0.8 && reverse > 0.12) {
      reversing = true;
      swingAcc = -swingDir * 9.5 * skills.swing * reverse;
    } else {
      swingAcc = swingDir * 8.5 * skills.swing * conventional;
    }
    swingAcc *= (speed / 36) * (1 + rng.normal(0, 0.25 * (1.2 - skills.consistency)) + tiredness * rng.normal(0, 0.2));
  }

  // How much of the swing the batter reads out of the hand.
  let read = rng.normal(0.75, 0.3);
  if (reversing) read = rng.normal(0.25, 0.4);
  else if (!spinner && rng.chance(0.12)) read = -0.4;
  const expectedSwingAcc = swingAcc * read;

  // Sideways kick off the pitch (m/s).
  const seamFactor = intent.type === "seam" ? 1.25 : spinner ? 0.25 : 0.75;
  const seamKick = rng.normal(0, 1) * 0.3 * skills.seam * ball.seam * pitch.seam * seamFactor * (speed / 36);
  let spinKick = 0;
  if (intent.type === "offspin" || intent.type === "legspin") {
    const dir = intent.type === "offspin" ? -1 : 1;
    const rip = clamp(rng.normal(1, 0.3 + 0.2 * (1 - skills.consistency)) * (0.85 + 0.15 * stamina), 0.3, 1.45);
    spinKick = dir * Math.min(2.6, 0.85 * skills.spin * ball.grip * pitch.turn * rip);
  }
  const expectedSpinKick = spinKick === 0 ? 0 : Math.sign(spinKick) * Math.min(2.6, 0.85 * skills.spin * ball.grip * pitch.turn);

  // Coefficient of restitution at the bounce, with occasional shooters and lifters.
  const expectedBounce = 0.5 * pitch.bounce * ball.bounceFactor * (spinner ? 0.92 : 1);
  let bounce = expectedBounce * (1 + rng.normal(0, pitch.variability));
  let bounceNote = "";
  const roll = rng.next();
  if (roll < pitch.lowChance) {
    bounce *= 0.5;
    bounceNote = "low";
  } else if (roll < pitch.lowChance + pitch.highChance) {
    bounce *= 1.38;
    bounceNote = "high";
  }
  const paceKept = clamp((spinner ? 0.86 : 0.875) * pitch.pace, 0.6, 0.97);

  // Solve the release velocity that lands the ball at (line, length).
  const hand = { x: spinner ? 0.28 : 0.36, y: spinner ? 1.95 : 2.18, z: 18.7 };
  const flightTime = (hand.z - length) / speed;
  const vy = (0.5 * GRAVITY * flightTime * flightTime - hand.y) / flightTime;
  const vx = (line - hand.x - 0.5 * swingAcc * 0.85 * flightTime * flightTime) / flightTime;
  const release = { t: 0, x: hand.x, y: hand.y, z: hand.z, vx, vy, vz: -speed };

  const flight = simulateFlight(release, swingAcc, seamKick, spinKick, bounce, paceKept, []);
  return {
    intent,
    speed,
    release,
    swingAcc,
    expectedSwingAcc,
    seamKick,
    spinKick,
    expectedSpinKick,
    bounce,
    expectedBounce,
    bounceNote,
    paceKept,
    noBall,
    releaseError,
    reversing,
    samples: flight.samples,
    bounceIndex: flight.bounceIndex,
    pitchedAt: flight.pitchedAt,
  };
}

/**
 * Integrate the ball from `start` until it passes `stopZ`, recording a
 * sample per step into `samples` (cleared first). Swing only acts before the
 * first bounce; the bounce applies restitution, pace loss and the sideways kicks.
 */
export function simulateFlight(start, swingAcc, seamKick, spinKick, bounce, paceKept, samples, bounced = false, stopZ = -16) {
  const s = { ...start };
  samples.length = 0;
  samples.push({ ...s });
  let bounceIndex = -1;
  let pitchedAt = null;
  for (let i = 0; i < 2400; i++) {
    const ax = bounced ? 0 : swingAcc;
    s.vx += ax * DT;
    s.vy -= GRAVITY * DT;
    s.x += s.vx * DT;
    s.y += s.vy * DT;
    s.z += s.vz * DT;
    s.t += DT;
    if (s.y <= 0 && s.vy < 0) {
      s.y = 0;
      if (bounced) {
        s.vy = -s.vy * 0.28;
        s.vz *= 0.8;
      } else {
        bounced = true;
        pitchedAt = { x: s.x, z: s.z };
        s.vy = -s.vy * bounce;
        s.vz *= paceKept;
        s.vx = s.vx * 0.9 + seamKick + spinKick;
        bounceIndex = samples.length;
      }
    }
    samples.push({ ...s });
    if (s.z < stopZ) break;
  }
  return { samples, bounceIndex, pitchedAt };
}

/** Interpolated ball state where the flight first crosses depth z, or null. */
export function crossingAtZ(samples, z) {
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a.z >= z && b.z < z) {
      const k = (a.z - z) / (a.z - b.z);
      return {
        t: a.t + (b.t - a.t) * k,
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        z,
        vx: b.vx,
        vy: b.vy,
        vz: b.vz,
      };
    }
  }
  return null;
}

/** Interpolated ball state at time t. */
export function sampleAtTime(samples, t) {
  const i = Math.min(samples.length - 1, Math.max(1, Math.ceil(t / DT)));
  const a = samples[i - 1];
  const b = samples[i];
  const k = clamp((t - a.t) / (b.t - a.t || 1));
  return {
    t,
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    vx: b.vx,
    vy: b.vy,
    vz: b.vz,
  };
}

export function hitsStumps(samples) {
  const p = crossingAtZ(samples, 0);
  return p ? Math.abs(p.x) < STUMPS_HALF_WIDTH + BALL_RADIUS && p.y < STUMPS_HEIGHT + BALL_RADIUS * 0.5 : false;
}

/** Wide if it passes the popping crease out of the batter's reach. */
export function isWide(samples) {
  const p = crossingAtZ(samples, CREASE);
  return p ? p.x > 0.93 || p.x < -0.78 || p.y > 2.05 : false;
}

export function lengthName(length, spinner) {
  if (length < 1.3) return "full toss";
  if (length < 2.6) return "yorker";
  if (length < 4.5) return "full";
  if (length < (spinner ? 6.5 : 7.5)) return "good length";
  if (length < 9.5) return "back of a length";
  return "short";
}

export function lineName(line) {
  if (line > 0.55) return "wide outside off";
  if (line > 0.2) return "outside off";
  if (line > 0.06) return "off stump";
  if (line > -0.06) return "middle";
  if (line > -0.16) return "leg stump";
  return "down leg";
}
