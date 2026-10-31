import { bowlingGeometry } from "./bowling-side.js";
import { clamp } from "../math.js";
import { GRAVITY, CREASE, STUMPS_HALF_WIDTH, STUMPS_HEIGHT, BALL_RADIUS } from "./geometry.js";
import { isSpinner, bowlingSpeed } from "./teams.js";

export const EFFORTS = ["low", "med", "high"];
const EFFORT_SPEED = { low: 0.93, med: 1, high: 1.055 };
const EFFORT_SPRAY = { low: 0.8, med: 1, high: 1.4 };
export const EFFORT_STAMINA = { low: 0.65, med: 1, high: 2.6 };

export const DELIVERY_NAMES = {
  seam: "SEAM",
  outswing: "OUTSWING",
  inswing: "INSWING",
  bouncer: "BOUNCER",
  yorker: "YORKER",
  slower: "SLOWER BALL",
  cutter: "CUTTER",
  offspin: "OFFSPIN",
  legspin: "LEGSPIN",
  armBall: "ARM BALL",
  googly: "GOOGLY",
};

/** Spinners use effort as flight: tossed up, stock, or fired in flat. */
export const SPIN_EFFORT_NAMES = { low: "FLIGHTED", med: "STOCK", high: "FLAT" };
const SPIN_EFFORT_TURN = { low: 1.15, med: 1, high: 0.85 };

/** Seam-up variations that otherwise behave like a seam ball. */
const SEAM_LIKE = new Set(["seam", "bouncer", "yorker", "slower", "cutter"]);
/**
 * Aftertouch (the player holding left/right through the run-up), at full
 * strength: extra sideways swing (m/s^2) for seamers, extra turn (m/s) for
 * spinners, and how much it costs in accuracy (spray multiplier).
 */
const AFTERTOUCH_SWING = 2.2;
const AFTERTOUCH_SPIN = 0.8;
const AFTERTOUCH_SPRAY = 0.6;

const SPEED_FACTOR = { slower: 0.78, cutter: 0.9, armBall: 1.06 };

/** Half-width (seconds) of the perfect-release window at the delivery stride; shrinks as the bowler tires. */
export const releaseSweetSpot = (stamina) => 0.03 * (0.5 + stamina);

/** Flight simulation time step (seconds). */
const DT = 1 / 240;

/**
 * Turn a bowler's intent into an actual delivery: speed, where it really
 * lands (accuracy, fatigue and release timing all spray it), swing, seam,
 * spin and bounce, then simulate its flight.
 *
 * intent: { type, line, length, effort, wicketSide? ("over" or "around") }. line is x at the stumps, length is
 * the intended pitching distance from the striker's stumps.
 * releaseError: seconds early (<0) or late (>0) at the delivery stride.
 */
export function bowlDelivery(intent, skills, stamina, ball, pitch, releaseError, rng) {
  const spinner = isSpinner(skills);
  const tiredness = 1 - stamina;
  const type = intent.type;
  let speed = bowlingSpeed(skills) * EFFORT_SPEED[intent.effort] * (0.88 + 0.12 * stamina) * (SPEED_FACTOR[type] ?? 1);
  speed *= 1 + rng.normal(0, 0.012);

  const touch = intent.aftertouch ?? 0;
  const spray =
    (1.35 - skills.accuracy) * (1 + tiredness * 1.3) * EFFORT_SPRAY[intent.effort] * (1 + AFTERTOUCH_SPRAY * Math.abs(touch));
  const badRelease = Math.abs(releaseError) > 0.1 ? 2.2 : 1;
  const line =
    intent.line + rng.normal(0, 0.075 * spray * badRelease) + Math.abs(releaseError) * 1.6 * (rng.next() < 0.5 ? -1 : 1);
  // A bouncer is banged in short; a yorker is aimed at the toes and is easy to over-pitch.
  let target = intent.length;
  if (type === "bouncer") target = Math.max(target, 11);
  if (type === "yorker") target = Math.min(target, 2.2);
  const lengthSpray = type === "yorker" ? 1.6 : 1;
  // Releasing late drags the ball fuller, early drops it shorter.
  let length = target + rng.normal(0, 0.55 * spray * badRelease * lengthSpray) - releaseError * 26;
  length = clamp(length, -1.5, 15);

  const noBall =
    releaseError > 0.11 ||
    (intent.effort === "high" && releaseError > 0.075 && rng.chance(0.5)) ||
    rng.chance(0.004 + tiredness * 0.006);

  let swingDir = 0;
  if (intent.type === "outswing") swingDir = 1;
  else if (intent.type === "inswing") swingDir = -1;
  else if (SEAM_LIKE.has(type)) swingDir = rng.normal(0, 0.25);

  // Lateral acceleration in the air (m/s^2).
  let swingAcc = 0;
  let reversing = false;
  if (spinner) {
    // Drift: the googly drifts like a leg-break, the arm ball comes in with the arm.
    const drift = { offspin: 0.9, legspin: -0.9, googly: -0.9, armBall: -0.6 }[type] ?? 0;
    swingAcc = drift * skills.spin * ball.grip * 0.6 * (intent.effort === "low" ? 1.3 : 1);
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
  const seamFactor = type === "cutter" ? 3 : SEAM_LIKE.has(type) ? 1.25 : spinner ? 0.25 : 0.75;
  let seamKick = rng.normal(0, 1) * 0.3 * skills.seam * ball.seam * pitch.seam * seamFactor * (speed / 36);
  let spinKick = 0;
  const turnBy = spinner ? SPIN_EFFORT_TURN[intent.effort] : 1;
  const spinDir = { offspin: -1, legspin: 1, googly: -1 }[type] ?? 0;
  if (spinDir) {
    const rip = clamp(rng.normal(1, 0.3 + 0.2 * (1 - skills.consistency)) * (0.85 + 0.15 * stamina), 0.3, 1.45);
    spinKick = spinDir * Math.min(2.6, 0.85 * skills.spin * ball.grip * pitch.turn * rip * turnBy);
  }
  const usualTurn = Math.min(2.6, 0.85 * skills.spin * ball.grip * pitch.turn * turnBy);
  const expectedSpinKick = spinDir * usualTurn;
  // What a batter who doesn't pick the variation expects instead.
  const decoySpinKick = type === "googly" ? usualTurn : type === "armBall" ? -usualTurn : expectedSpinKick;
  const disguised = type === "googly" || type === "armBall" || type === "slower";

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
  const hand = { x: bowlingGeometry(spinner, intent.wicketSide).releaseX, y: spinner ? 1.95 : 2.18, z: 18.7 };
  const flightTime = (hand.z - length) / speed;
  const vy = (0.5 * GRAVITY * flightTime * flightTime - hand.y) / flightTime;
  const vx = (line - hand.x - 0.5 * swingAcc * 0.85 * flightTime * flightTime) / flightTime;
  const release = { t: 0, x: hand.x, y: hand.y, z: hand.z, vx, vy, vz: -speed };
  // Aftertouch: extra movement put on after the aim was set (and unread by the batter).
  if (touch && spinner) spinKick += AFTERTOUCH_SPIN * touch;
  else if (touch) swingAcc += AFTERTOUCH_SWING * touch;

  let flight = simulateFlight(release, swingAcc, seamKick, spinKick, bounce, paceKept, []);
  // Landing in the footmarks: spin grips and rips, anything else does something odd.
  const rough = flight.pitchedAt ? pitch.roughAt(flight.pitchedAt.x, flight.pitchedAt.z) : 0;
  let inRough = false;
  if (rough > 0.05) {
    inRough = true;
    if (spinKick) spinKick *= 1 + 0.45 * rough;
    else seamKick += rng.normal(0, 0.4 * rough);
    bounce *= 1 + rng.normal(0, 0.15 * rough);
    flight = simulateFlight(release, swingAcc, seamKick, spinKick, bounce, paceKept, []);
  }
  return {
    intent,
    speed,
    release,
    swingAcc,
    expectedSwingAcc,
    seamKick,
    spinKick,
    expectedSpinKick,
    decoySpinKick,
    disguised,
    inRough,
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
    /** Where the ball passes the batter (for the batter's memory of it). */
    atCrease: crossingAtZ(flight.samples, CREASE),
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

/**
 * How much a delivery moved, for speed guns, commentary and the coach:
 * { kmh, swing, offPitch, spin } with distances in metres, positive = away
 * from the right-hander (towards the off side). `offPitch` is seam or turn.
 */
export function movementOf(d) {
  const pitchZ = d.pitchedAt?.z ?? 0;
  const tAir = Math.max(0, (d.release.z - pitchZ) / d.speed);
  const tAfter = pitchZ / Math.max(1, d.speed * d.paceKept);
  return {
    kmh: d.speed * 3.6,
    swing: 0.5 * d.swingAcc * tAir * tAir,
    offPitch: (d.spinKick + d.seamKick) * tAfter,
    spin: d.spinKick !== 0,
  };
}

/** ["SWING 18 CM AWAY", "SEAM 6 CM IN"] (empty when it went straight on). */
export function movementParts(d) {
  const m = movementOf(d);
  const part = (label, v) => `${label} ${Math.round(Math.abs(v) * 100)} CM ${v > 0 ? "AWAY" : "IN"}`;
  const parts = [];
  if (Math.abs(m.swing) > 0.03) parts.push(part(d.reversing ? "REVERSE" : "SWING", m.swing));
  if (Math.abs(m.offPitch) > 0.03) parts.push(part(m.spin ? "TURN" : "SEAM", m.offPitch));
  return parts;
}

export const movementText = (d) => movementParts(d).join("  ");

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
