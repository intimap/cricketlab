import { bowlingGeometry, armOf } from "./bowling-side.js";
import { clamp } from "../math.js";
import { GRAVITY, CREASE, STUMPS_HALF_WIDTH, STUMPS_HEIGHT, BALL_RADIUS } from "./geometry.js";
import { isSpinner, bowlingSpeed } from "./teams.js";
import { rhythmEffect } from "./rhythm.js";

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

/** A delivery's name for this bowler: a left-armer's finger-spinner is LEFT-ARM SPIN, not OFFSPIN. */
export function deliveryName(type, skills) {
  if (type === "offspin" && skills?.arm === "left") return "LEFT-ARM SPIN";
  return DELIVERY_NAMES[type] ?? "";
}

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
const AFTERTOUCH_SWING = 1.6;
const AFTERTOUCH_SPIN = 0.8;
const AFTERTOUCH_SPRAY = 0.6;

const SPEED_FACTOR = { slower: 0.78, cutter: 0.9, armBall: 1.06 };

/**
 * Swing in the air. A good swing bowler doing it well moves a new ball 30-40 cm; much more only when
 * everything lines up. SWING_REACH is how far a perfect swing bowler moves it sideways over SWING_OVER
 * metres of flight (to a good length) with a new ball, in neutral conditions, at a pace
 * that swings; the ball's age, the air (pitch and weather), his skill and his pace scale it. A fuller ball
 * is in the air longer and swings more, a shorter one less; none more than SWING_MOST.
 *
 * Pace: conventional swing needs the air over the shiny side to stay smooth while the seam side's goes
 * turbulent. Above SWING_FADE's first speed the shiny side goes turbulent too, and the swing fades fast. An
 * old, roughed-up ball turns that into reverse swing, which grows with pace from REVERSE_FROM km/h.
 */
const SWING_REACH = 0.4;
const SWING_OVER = 12;
const SWING_MOST = 0.7;
const SWING_FADE = [
  [138, 1],
  [142, 0.85],
  [146, 0.62],
  [150, 0.45],
  [155, 0.32],
  [165, 0.25],
];
const REVERSE_FROM = 128;
const REVERSE_FULL = 145;
/** How much the air helps (pitch and weather, `swingAir`): softened, so a green top under cloud adds rather than multiplies. */
const airHelp = (swingAir) => 1 + 0.45 * (swingAir - 1);

/** Conventional swing's share at this pace (km/h). */
export function conventionalAt(kmh) {
  if (kmh <= SWING_FADE[0][0]) return 1;
  for (let i = 1; i < SWING_FADE.length; i++) {
    const [k1, v1] = SWING_FADE[i];
    const [k0, v0] = SWING_FADE[i - 1];
    if (kmh <= k1) return v0 + ((v1 - v0) * (kmh - k0)) / (k1 - k0);
  }
  return SWING_FADE[SWING_FADE.length - 1][1];
}

/** Reverse swing's share at this pace (km/h), with a ball old enough to reverse. */
export const reverseAt = (kmh) => clamp((kmh - REVERSE_FROM) / (REVERSE_FULL - REVERSE_FROM));

/** The sideways acceleration (m/s^2) that moves the ball `reach` metres over SWING_OVER metres at `speed`. */
const swingAccFor = (reach, speed) => (2 * reach * speed * speed) / (SWING_OVER * SWING_OVER);

/** A mistimed release moves the line this far (m) per second of error, mostly wide of off. */
const LOOSE_LINE = 1.2;
/** Released this late (s) or later, the bowler has overstepped: a no-ball (sim/runup.js shows it in red). */
export const NO_BALL_LATE = 0.14;

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
/**
 * How far (m, + towards a right-hander's off side) a delivery of `intent` usually moves off the pitch before
 * it reaches the bat: the turn or the seam a bowler allows for in his line. No dice: what he expects.
 */
export function expectedTurnAtBat(intent, skills, ball, pitch) {
  const spinDir = { offspin: -1, legspin: 1, googly: -1 }[intent.type] ?? 0;
  if (!spinDir || !isSpinner(skills)) return 0;
  const turn = spinDir * Math.min(2.6, 0.85 * skills.spin * ball.grip * pitch.turn * SPIN_EFFORT_TURN[intent.effort]);
  const speed = bowlingSpeed(skills) * EFFORT_SPEED[intent.effort] * (SPEED_FACTOR[intent.type] ?? 1);
  const paceKept = clamp(0.86 * pitch.pace, 0.6, 0.97);
  return (turn * Math.max(0, intent.length - CREASE)) / (speed * paceKept);
}

/**
 * How far (m, striker's frame) to move a line set for a right-armer over the wicket to a right-hander, so the
 * ball still arrives where it was meant to when the angle or the turn is the other way: a left-armer, a
 * left-hander, or around the wicket. `flip` is -1 when the bowler and batter are opposite-handed (the world
 * is mirrored for him: sim/match.js), `side` "over" or "around". The keeper's advice allows for every angle
 * (`angles` "all"); the computer, so far, only for a left-armer's ("leftArm"): its right-armers have always
 * bowled their right-hander's lines to left-handers, and the game's balance is set with that (see TODO.md).
 */
export function aimAllowance(intent, skills, ball, pitch, flip, side = "over", angles = "all") {
  const spinner = isSpinner(skills);
  const turn = flip < 0 ? 2 * expectedTurnAtBat(intent, skills, ball, pitch) : 0;
  if (angles === "leftArm" && armOf(skills) > 0) return turn;
  // The angle: from a release on the other side of the stumps, a ball pitched on the same spot carries on
  // further across him. Aim straighter by as much as keeps its line at the crease.
  const usual = bowlingGeometry(spinner, "over").releaseX;
  const actual = bowlingGeometry(spinner, side).releaseX * flip;
  const pitchZ = Math.min(14, Math.max(CREASE + 0.5, intent.length));
  const r = (pitchZ - CREASE) / (18.7 - pitchZ);
  return turn + ((actual - usual) * r) / (1 + r);
}

export function bowlDelivery(intent, skills, stamina, ball, pitch, releaseError, rng) {
  const spinner = isSpinner(skills);
  const tiredness = 1 - stamina;
  const type = intent.type;
  // The player's run-up rhythm (sim/rhythm.js): his pace, his line and the aftertouch he's earned.
  const rhythm = typeof intent.rhythm === "number" ? rhythmEffect(intent.rhythm, intent.effort) : null;
  let speed = bowlingSpeed(skills) * EFFORT_SPEED[intent.effort] * (0.88 + 0.12 * stamina) * (SPEED_FACTOR[type] ?? 1);
  speed *= (1 + rng.normal(0, 0.012)) * (rhythm?.speed ?? 1);

  const touch = (intent.aftertouch ?? 0) * (rhythm?.touch ?? 1);
  const spray =
    (1.35 - skills.accuracy) *
    (1 + tiredness * 1.3) *
    EFFORT_SPRAY[intent.effort] *
    (1 + AFTERTOUCH_SPRAY * Math.abs(touch)) *
    (rhythm?.spray ?? 1);
  // A mistimed release is a loose ball rather than a wild one: it drifts wide of off (there to be hit), and
  // a badly mistimed one sprays a little more.
  const badRelease = Math.abs(releaseError) > 0.1 ? 1.5 : 1;
  const line =
    intent.line + rng.normal(0, 0.075 * spray * badRelease) + Math.abs(releaseError) * LOOSE_LINE * (rng.chance(0.8) ? 1 : -1);
  // A bouncer is banged in short; a yorker is aimed at the toes and is easy to over-pitch.
  let target = intent.length;
  if (type === "bouncer") target = Math.max(target, 11);
  if (type === "yorker") target = Math.min(target, 2.2);
  const lengthSpray = type === "yorker" ? 1.6 : 1;
  // Releasing late drags the ball fuller, early drops it shorter.
  let length = target + rng.normal(0, 0.55 * spray * badRelease * lengthSpray) - releaseError * 26;
  length = clamp(length, -1.5, 15);

  // Only a very late release oversteps; a late one is dragged full (a full toss, there to be hit).
  const noBall =
    releaseError > NO_BALL_LATE ||
    (intent.effort === "high" && releaseError > NO_BALL_LATE - 0.02 && rng.chance(0.5)) ||
    rng.chance(0.002 + tiredness * 0.004);

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
    const kmh = speed * 3.6;
    const conventional = ball.swing * airHelp(pitch.swingAir) * conventionalAt(kmh);
    const reverse = ball.reverse * reverseAt(kmh);
    // How far it moves over SWING_OVER metres (m), before his consistency (and tiredness) on the day.
    let reach;
    if (reverse > conventional * 0.8 && reverse > 0.12) {
      reversing = true;
      reach = -swingDir * SWING_REACH * skills.swing * reverse;
    } else {
      reach = swingDir * SWING_REACH * skills.swing * conventional;
    }
    const wobble = 1 + rng.normal(0, 0.12 + 0.18 * (1 - skills.consistency)) + tiredness * rng.normal(0, 0.12);
    swingAcc = swingAccFor(reach * clamp(wobble, 0.4, 1.4), speed);
  }

  // How much of the swing the batter reads out of the hand. It's the late movement that beats him, not the
  // size of it; the better the swing bowler, the more often he's fooled into playing for the other way.
  let read = rng.normal(0.5, 0.3);
  if (reversing) read = rng.normal(0.25, 0.4);
  else if (!spinner && rng.chance(0.14 + 0.1 * skills.swing)) read = -0.4;
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
  // However everything lines up, no ball swings more than SWING_MOST before it pitches.
  const mostAcc = (2 * SWING_MOST) / (flightTime * flightTime);
  if (!spinner) swingAcc = clamp(swingAcc, -mostAcc, mostAcc);
  const vy = (0.5 * GRAVITY * flightTime * flightTime - hand.y) / flightTime;
  const vx = (line - hand.x - 0.5 * swingAcc * 0.85 * flightTime * flightTime) / flightTime;
  const release = { t: 0, x: hand.x, y: hand.y, z: hand.z, vx, vy, vz: -speed };
  // Aftertouch: extra movement put on after the aim was set (and unread by the batter).
  if (touch && spinner) spinKick += AFTERTOUCH_SPIN * touch;
  else if (touch) swingAcc = clamp(swingAcc + AFTERTOUCH_SWING * touch, -mostAcc, mostAcc);

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
