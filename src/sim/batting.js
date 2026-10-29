import { clamp, toRad, angleDiff } from "../math.js";
import { CREASE, STUMPS_HALF_WIDTH, BALL_RADIUS } from "./geometry.js";
import { simulateFlight, crossingAtZ, sampleAtTime, hitsStumps, isWide } from "./delivery.js";

/** Depth (z) at which the bat meets the ball, front and back foot. */
export const CONTACT_Z_FRONT = 1.95;
export const CONTACT_Z_BACK = 0.85;

/** Seconds from starting the downswing to the bat reaching the ball. */
export const SWING_TIME = {
  drive: 0.085,
  cutpull: 0.075,
  loft: 0.1,
  ramp: 0.07,
  sweep: 0.09,
  reverseSweep: 0.1,
  defend: 0.12,
  leave: 0,
};

const isSweep = (type) => type === "sweep" || type === "reverseSweep";
/** Extra vertical bat error (m) when hooking a ball above the shoulder: top edges and gloves. */
const HOOK_ERROR = 0.11;

/**
 * Degrees a perfectly middled shot by a top batter can be worked towards a gap
 * (wrists and bat face, not a choice the player makes); less for a scratchier
 * hit or a lesser batter.
 */
export const MAX_PLACEMENT = 22;

/**
 * The wrong foot for the length. Forward to a short ball: it climbs into the
 * bat higher than expected (top edges, gloves). Back to a full one: it skids
 * under the bat (bottom edges, bowled, LBW). Both tighten the timing.
 * `wrongFoot` is 0..1 from how wrong the choice was, eased by footwork.
 */
const WRONG_FOOT_RISE = 0.14;
const WRONG_FOOT_SKID = 0.09;
const WRONG_FOOT_JITTER = 1.5;
const WRONG_FOOT_WINDOW = 0.35;

export function wrongFoot(type, footBack, pitchZ, footwork) {
  if (type === "leave" || type === "ramp" || isSweep(type)) return { forward: 0, back: 0 };
  const ease = 1.2 - 0.5 * footwork;
  return {
    forward: footBack ? 0 : clamp((pitchZ - 6.5) / 2.5) * ease,
    back: footBack ? clamp((5.5 - pitchZ) / 2.5) * ease : 0,
  };
}

/** Shot power (0..1) of a normal, non-power player shot. */
export const NORMAL_CHARGE = 0.35;

const noContact = (missReason) => ({ kind: "none", quality: 0, missReason, shotName: "", at: null, exit: null });

/** How long before contact the batter stops tracking the ball (seconds). */
export function reactionTime(bat, state, spinner, speed) {
  const vsType = spinner ? 1.15 - 0.3 * bat.vsSpin : 1.15 - 0.3 * bat.vsPace;
  return clamp(
    (0.2 - 0.06 * bat.technique - 0.035 * state.settled + 0.05 * (1 - state.concentration) + 0.025 * state.fatigue) *
      vsType *
      Math.sqrt(Math.max(speed, 18) / 36),
    0.07,
    0.3,
  );
}

/** Where the batter expects the ball at depth z, judged from its state at `readTime`. */
function expectedAt(d, readTime, z, bat) {
  const from = sampleAtTime(d.samples, Math.max(0, readTime));
  const bounced = d.bounceIndex >= 0 && from.t >= d.samples[d.bounceIndex].t;
  const spinRead = d.expectedSpinKick * (0.45 + 0.45 * bat.vsSpin);
  const flight = simulateFlight(
    from,
    bounced ? 0 : d.expectedSwingAcc,
    0,
    bounced ? 0 : spinRead,
    d.expectedBounce,
    d.paceKept,
    [],
    bounced,
    z - 0.5,
  );
  return crossingAtZ(flight.samples, z);
}

/**
 * Does this shot go back (true) or forward? The attacking shots carry their
 * foot; defence follows the player's choice (`foot`), or the length for the
 * computer when it hasn't said; leaves follow the length.
 */
export function playsBack(type, foot, pitchZ) {
  if (type === "cutpull" || type === "ramp") return true;
  if (type === "defend") return foot ? foot === "back" : pitchZ > 6.8;
  if (type === "leave") return pitchZ > 7;
  return false;
}

/**
 * 0..1: how well the chosen shot suits the ball (height at contact, pitching
 * length, line). `foot` is the defence's foot ("front"/"back").
 */
export function shotSuitability(type, height, pitchZ, line, spinner, foot = null) {
  let s = 1;
  // A yorker at the toes can be dug out, but it's very hard to hit.
  if (pitchZ > 1.2 && pitchZ < 2.6 && !spinner && type !== "defend" && type !== "leave") s -= 0.5;
  if (type === "drive") {
    if (height > 0.95) s -= (height - 0.95) * 1.3;
    if (pitchZ > 8) s -= 0.35;
    if (line > 0.6) s -= 0.3;
    if (line < -0.3) s -= 0.15;
  } else if (type === "cutpull") {
    if (pitchZ < 6 && pitchZ > 1.3) s -= 0.5;
    if (height < 0.45) s -= 0.35;
    if (line > 0.2 && line < 0.32) s -= 0.15;
    // No width and not much bounce: only a punch down the ground, and that's a risk.
    if (line <= 0.2 && line > -0.1 && height < 0.8) s -= 0.2;
    // Above the shoulder it's very hard to keep down.
    if (height > 1.55) s -= 0.45;
  } else if (type === "loft") {
    if (pitchZ > 6.5) s -= 0.4;
    if (height > 1) s -= 0.3;
    if (spinner) s += 0.1;
  } else if (type === "ramp") {
    // Needs pace to work with, and a ball short enough to get under.
    s -= 0.25;
    if (spinner) s -= 0.45;
    if (pitchZ < 4.5) s -= 0.4;
    if (height < 0.5) s -= 0.3;
    if (height > 1.4) s -= 0.2;
  } else if (isSweep(type)) {
    // A spinner's shot: full and low. Against pace or bounce it's a gamble.
    if (!spinner) s -= 0.55;
    if (pitchZ > 7) s -= 0.45;
    if (height > 0.9) s -= 0.4;
    if (type === "reverseSweep") s -= 0.1;
  } else if (type === "defend") {
    if (height > 1.35) s = 0.5;
    if (line > 0.6) s = Math.min(s, 0.8);
    // The wrong foot: forward to a short one (it climbs at the splice), back to a full one (stuck on the crease).
    const back = playsBack(type, foot, pitchZ);
    if (!back && pitchZ > 7.5) s -= 0.3 + (height > 1 ? 0.2 : 0);
    if (back && pitchZ < 5) s -= 0.45;
  }
  return clamp(s, 0.15, 1);
}

/**
 * Which back-foot shot a ball calls for, from its line and height at the bat:
 * "cut" with width outside off, "punch" (back-foot drive) with no width and
 * not much bounce, "glance" off the hip down leg, otherwise "pull" (a hook
 * when it's up around the head).
 */
export function backFootShot(line, height) {
  if (line > 0.24) return "cut";
  if (line > -0.12 && height < 1) return "punch";
  if (line < -0.3 && height < 0.95) return "glance";
  return "pull";
}

/**
 * A front-foot drive's direction from the line it's played to: straight,
 * through the covers, square when wide; on leg stump it's worked through
 * midwicket, and off the pads it's glanced fine.
 */
export function driveBearing(line) {
  if (line >= -0.15) return clamp(line * 75, -11, 70);
  return Math.max(-140, -11 + (line + 0.15) * 350);
}

/** Natural direction of a shot (degrees, 0 = straight back past the bowler, + = off side). */
function shotBearing(type, line, height, back) {
  switch (type) {
    case "drive":
    case "loft":
      return driveBearing(line);
    case "cutpull":
      if (back === "cut") return 92 + line * 15;
      if (back === "punch") return 8 + line * 70;
      if (back === "glance") return -125;
      return -72 - clamp(height - 0.8, 0, 1) * 30;
    case "ramp":
      return line > 0.15 ? 160 : -165;
    case "sweep":
      return -115;
    case "reverseSweep":
      return 110;
    case "defend":
      return clamp(line * 40, -30, 40);
    default:
      return 0;
  }
}

function shotName(type, bearing, height, footBack, back) {
  if (type === "defend") return footBack ? "back-foot defence" : "forward defence";
  if (type === "cutpull") {
    if (back === "cut") return bearing > 115 ? "late cut" : "cut";
    if (back === "punch") return "back-foot drive";
    if (back === "glance") return "leg glance";
    return height > 1.35 ? "hook" : "pull";
  }
  if (type === "ramp")
    return Math.abs(bearing) > 168 ? "ramp over the keeper" : bearing > 0 ? "ramp over the slips" : "scoop over fine leg";
  if (type === "sweep") return bearing < -125 ? "paddle sweep" : "sweep";
  if (type === "reverseSweep") return "reverse sweep";
  const lofted = type === "loft" ? "lofted " : "";
  if (bearing > 80) return "square drive";
  if (bearing > 45) return lofted + "cover drive";
  if (bearing > 12) return lofted + "off drive";
  if (bearing > -12) return lofted + "straight drive";
  if (bearing > -40) return lofted + "on drive";
  if (bearing > -100) return type === "loft" ? "slog over midwicket" : "clip off the pads";
  return type === "loft" ? "slog over midwicket" : "leg glance";
}

/** The direction within `reach` degrees of `bearing` furthest from any fielder (bearings in `field`). */
function intoGap(bearing, field, reach) {
  if (!field.length || reach < 1) return bearing;
  let best = bearing;
  let bestGap = -1;
  for (let b = bearing - reach; b <= bearing + reach; b += 2) {
    const gap = Math.min(...field.map((f) => Math.abs(angleDiff(b, f))));
    // Ties go to the smaller change of direction.
    if (gap > bestGap + 0.5 || (Math.abs(gap - bestGap) <= 0.5 && Math.abs(b - bearing) < Math.abs(best - bearing))) {
      bestGap = gap;
      best = b;
    }
  }
  return best;
}

/**
 * Decide what happens when delivery `d` meets `shot`: bat contact, pad
 * (with an LBW verdict), bowled, wide, or through to the keeper. Returns the
 * result plus the ball's starting state for the live play that follows.
 * `field`: the fielders' bearings, for a well-struck ball to find the gaps.
 *
 * shot: { type: drive|cutpull|loft|defend|leave (or ramp/sweep/reverseSweep), charge, timingError,
 *         foot? ("front"/"back", for defence), windowMult?, eyeMult? (the player's eye, see eye.js) }
 */
export function resolveDelivery(d, shot, bat, state, ball, spinner, rng, field = []) {
  const pitchZ = d.pitchedAt ? d.pitchedAt.z : 0;
  const footBack = playsBack(shot.type, shot.foot, pitchZ);
  const at = crossingAtZ(d.samples, footBack ? CONTACT_Z_BACK : CONTACT_Z_FRONT);
  const contact = at ? batContact(d, shot, bat, state, ball, spinner, at, footBack, pitchZ, rng, field) : noContact("beaten");
  const res = {
    contact,
    touchedBat: contact.kind !== "none" && contact.kind !== "padPop",
    padHit: false,
    lbw: false,
    lbwNote: "",
    bowled: false,
    playedOn: false,
    wide: false,
    legByesAllowed: false,
    stumpingChance: false,
    start: { t: 0, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } },
  };

  if (contact.kind !== "none" && contact.at && contact.exit) {
    if ((contact.kind === "insideEdge" || contact.kind === "bottomEdge") && hitsStumps(d.samples) && rng.chance(0.4)) {
      res.playedOn = true;
      res.bowled = true;
    }
    if (contact.kind === "padPop") res.touchedBat = true;
    res.start = { t: contact.at.t, pos: { x: contact.at.x, y: contact.at.y, z: contact.at.z }, vel: contact.exit };
    return res;
  }

  res.wide = isWide(d.samples);

  // Pad: does the ball hit the front (or back) leg?
  const padZ = footBack ? 0.7 : 1.55;
  const atPad = crossingAtZ(d.samples, padZ);
  let padMin = footBack ? -0.24 : -0.26;
  let padMax = footBack ? 0.05 : 0.07;
  if (contact.batX !== undefined) {
    padMin = Math.min(padMin, contact.batX - 0.3);
    padMax = Math.max(-0.05, Math.min(0.2, contact.batX - 0.03));
  }
  if (atPad && atPad.x > padMin && atPad.x < padMax && atPad.y < 0.62 && !res.wide) {
    res.padHit = true;
    const offeredShot = shot.type !== "leave";
    res.legByesAllowed = offeredShot;
    const pitchedOutsideLeg = !!d.pitchedAt && d.pitchedAt.x < -(STUMPS_HALF_WIDTH + BALL_RADIUS);
    const impactOutsideOff = atPad.x > STUMPS_HALF_WIDTH + BALL_RADIUS * 0.5;
    const wouldHit = hitsStumps(d.samples);
    const atStumps = crossingAtZ(d.samples, 0);
    const clipping = atStumps ? Math.abs(atStumps.x) > STUMPS_HALF_WIDTH - 0.01 || atStumps.y > 0.68 : true;
    if (wouldHit) {
      if (pitchedOutsideLeg) res.lbwNote = "pitched outside leg";
      else if (impactOutsideOff && offeredShot) res.lbwNote = "outside the line";
      else if (clipping && padZ > 1.4 && rng.chance(0.35)) res.lbwNote = "umpire's call, not out";
      else res.lbw = true;
    } else {
      res.lbwNote = atStumps && atStumps.y > 0.72 ? "going over the top" : "missing";
    }
    const dir = toRad(rng.normal(-70, 45));
    const speed = rng.range(2, 6);
    res.start = {
      t: atPad.t,
      pos: { x: atPad.x, y: atPad.y, z: atPad.z },
      vel: { x: Math.sin(dir) * speed, y: rng.range(0, 1.5), z: Math.cos(dir) * speed },
    };
    return res;
  }

  if (hitsStumps(d.samples)) {
    res.bowled = true;
    const p = crossingAtZ(d.samples, 0);
    res.start = { t: p.t, pos: { x: p.x, y: p.y, z: 0 }, vel: { x: p.vx, y: p.vy, z: p.vz } };
    return res;
  }

  // Beaten playing forward to a spinner: the keeper may have a stumping.
  if (spinner && (shot.type === "drive" || shot.type === "loft") && contact.missReason !== "leave") {
    res.stumpingChance = rng.chance(0.18 + 0.4 * (1 - bat.footwork));
  }
  const p = crossingAtZ(d.samples, CREASE) ?? d.samples[d.samples.length - 1];
  res.start = { t: p.t, pos: { x: p.x, y: p.y, z: p.z }, vel: { x: p.vx, y: p.vy, z: p.vz } };
  return res;
}

/**
 * Where the bat actually goes (the batter's read of the ball plus error),
 * whether it connects, which part of the bat it hits, and the ball's exit
 * velocity. `at` is the true ball state at the contact depth.
 */
function batContact(d, shot, bat, state, ball, spinner, at, footBack, pitchZ, rng, field) {
  if (shot.type === "leave") return noContact("leave");

  // The batter commits from an early read and adjusts with a later one.
  const react = reactionTime(bat, state, spinner, d.speed);
  const earlyRead = clamp(react + 0.13 + (spinner ? 0.05 * (1 - bat.footwork) : 0), 0.15, 0.42);
  const late = expectedAt(d, at.t - react, at.z, bat) ?? at;
  const early = expectedAt(d, at.t - earlyRead, at.z, bat) ?? late;
  const adjust = spinner
    ? clamp(0.42 + 0.25 * bat.technique + 0.1 * state.settled + 0.15 * bat.vsSpin + 0.05 * bat.footwork, 0, 0.95)
    : clamp(0.55 + 0.3 * bat.technique + 0.1 * state.settled + 0.05 * bat.vsPace, 0, 0.95);
  const aimX = late.x + (early.x - late.x) * (1 - adjust);
  const aimY = late.y + (early.y - late.y) * (1 - adjust);
  // The player's eye: a bigger timing window and sweet spot, and more bat speed.
  const eye = shot.eyeMult ?? 1;
  const eyeEase = 1 + (eye - 1) / 2;
  const wrong = wrongFoot(shot.type, footBack, pitchZ, bat.footwork);
  const misfooted = Math.max(wrong.forward, wrong.back);
  // `difficulty` (from plans.js): above 1 when the ball targets a weakness or springs a surprise.
  const jitter =
    0.013 *
    (1.25 - bat.technique) *
    (1 + (1 - state.settled) * 0.6) *
    (shot.difficulty ?? 1) *
    (1 + WRONG_FOOT_JITTER * misfooted);
  // Hooking a ball up around the head is a gamble: hard to get on top of.
  const hooking = shot.type === "cutpull" && at.x <= 0.2 && at.y > 1.35;
  const batX = aimX + rng.normal(0, jitter);
  const batY =
    aimY +
    rng.normal(0, jitter * 1.5) +
    (hooking ? rng.normal(0, HOOK_ERROR) : 0) -
    WRONG_FOOT_RISE * wrong.forward +
    WRONG_FOOT_SKID * wrong.back;
  const latErr = at.x - batX;
  const vErr = at.y - batY;
  const height = at.y;
  const line = at.x;
  const back = shot.type === "cutpull" ? backFootShot(line, height) : null;
  const suit = shotSuitability(shot.type, height, pitchZ, line, spinner, shot.foot);
  const defending = shot.type === "defend";

  // Timing window (seconds); timing is the error expressed in windows.
  const window = defending
    ? 0.2 * (0.8 + 0.4 * bat.defence)
    : (0.088 - 0.062 * shot.charge) *
      (0.75 + 0.5 * bat.timing) *
      (0.82 + 0.25 * state.settled) *
      (0.6 + 0.4 * suit) *
      (spinner ? 1.25 : 1) *
      (shot.type === "ramp" || (isSweep(shot.type) && !spinner) ? 0.7 : 1) *
      (1 - WRONG_FOOT_WINDOW * misfooted);
  const timing = shot.timingError / (window * (shot.windowMult ?? 1) * eyeEase);
  if (Math.abs(timing) > 2.4) return noContact(timing < 0 ? "early" : "late");

  const reach = defending ? 0.1 : 0.09;
  const lat = Math.abs(latErr);
  if (lat > reach + 0.004 || Math.abs(vErr) > 0.32) {
    // The pad sits just inside wherever the bat went.
    return { ...noContact("beaten"), batX };
  }

  const sweetSpot = (defending ? 0.052 : 0.033) * (0.6 + 0.4 * suit) * eyeEase;
  let kind;
  if (lat <= sweetSpot && Math.abs(vErr) < 0.12) kind = "middle";
  else if (Math.abs(vErr) >= 0.12) kind = vErr > 0 ? (height > 1.15 ? "gloved" : "topEdge") : "bottomEdge";
  else if (lat <= 0.062) kind = latErr > 0 ? "thickEdge" : "insideEdge";
  else kind = latErr > 0 ? "thinEdge" : "insideEdge";
  if (kind === "insideEdge" && rng.chance(0.4)) kind = "padPop";

  const mistimed = Math.abs(timing) > 1;
  const timingQuality = mistimed ? Math.max(0.12, 0.55 - 0.32 * (Math.abs(timing) - 1)) : 1 - 0.45 * timing * timing;
  const contactQuality = kind === "middle" ? 1 - (0.35 * lat) / sweetSpot : 0.4;
  const quality = clamp(contactQuality * timingQuality * (0.7 + 0.3 * suit));
  const ballSpeed = Math.abs(at.vz);
  const batSpeed = defending ? 0 : (8 + 26 * shot.charge * (0.55 + 0.45 * bat.power)) * eye;
  const natural = shotBearing(shot.type, line, height, back);

  let speed, bearing, elevation;
  switch (kind) {
    case "middle": {
      if (defending) {
        speed = (2.2 + 0.12 * ballSpeed) * (1.25 - 0.5 * bat.defence) * (mistimed ? 1.3 : 1);
      } else if (shot.type === "ramp") {
        // Mostly the bowler's pace, redirected.
        speed = (0.55 * ballSpeed + 4 + 6 * shot.charge) * (0.5 + 0.5 * quality) * ball.batPace;
      } else if (isSweep(shot.type)) {
        speed = (batSpeed + 0.25 * ballSpeed + 4) * (0.5 + 0.5 * quality) * ball.batPace;
      } else {
        speed = (batSpeed + 0.42 * ballSpeed) * (0.5 + 0.5 * quality) * ball.batPace * (hooking ? 0.7 : 1);
      }
      if (mistimed && !defending) speed *= 0.7;
      // The ball and the shot set the direction; timing moves it. Played late it goes finer
      // (towards third man, or fine leg for shots already going behind square on the leg side),
      // early it goes squarer / across the line. A sweep's bat angle fixes it more.
      const finer = natural < -45 ? -1 : 1;
      const drift = finer * clamp(timing, -2, 2) * 16 + rng.normal(0, 5 + 18 * (1 - quality));
      bearing = natural + drift * (isSweep(shot.type) ? 0.5 : 1);
      if (!defending) bearing = intoGap(bearing, field, MAX_PLACEMENT * quality * (0.4 + 0.6 * bat.technique));
      if (defending) elevation = height > 1.25 ? rng.range(15, 40) : rng.range(-25, -5);
      else if (shot.type === "loft") elevation = 20 + 15 * shot.charge + rng.normal(0, 5);
      else if (shot.type === "ramp") elevation = 28 + 12 * shot.charge + rng.normal(0, 6);
      else if (isSweep(shot.type)) elevation = -2 + rng.normal(0, 2) + (height > 0.7 ? 12 : 0);
      else if (shot.type === "cutpull")
        // A pull is rolled down; only a hook off a really high ball tends to go in the air.
        elevation =
          back === "cut"
            ? 4 + rng.normal(0, 4) + (height > 1 ? 7 : 0)
            : back === "punch" || back === "glance"
              ? 1.5 + rng.normal(0, 3) + (height > 0.8 ? 6 : 0)
              : 2 + Math.max(0, height - 1.2) * 20 + rng.normal(0, 5);
      else elevation = 1.5 + rng.normal(0, 3) + (height > 0.8 ? 7 : 0) + (timing < -1 ? rng.range(10, 30) : 0);
      if (mistimed && !defending) elevation += rng.range(0, isSweep(shot.type) ? 8 : 22);
      break;
    }
    case "thinEdge":
      speed = 0.62 * ballSpeed * (defending ? 0.55 : 1) + rng.normal(0, 1.5);
      bearing = 166 + rng.normal(0, 8);
      elevation = 6 + rng.normal(0, 4) - (defending ? 4 : 0);
      break;
    case "thickEdge":
      speed = 0.42 * ballSpeed + 0.35 * batSpeed;
      bearing = 122 + rng.normal(0, 22);
      elevation = 7 + rng.normal(0, 8) - (defending ? 6 : 0);
      break;
    case "insideEdge":
      speed = 0.35 * ballSpeed + 0.15 * batSpeed;
      bearing = -158 + rng.normal(0, 18);
      elevation = 2 + rng.normal(0, 5);
      break;
    case "padPop":
      speed = rng.range(2.5, 5);
      bearing = rng.normal(-95, 50);
      elevation = rng.range(25, 60);
      break;
    case "topEdge":
      speed = 0.3 * ballSpeed + 0.25 * batSpeed + 2;
      if (shot.type === "ramp") bearing = 180 + rng.normal(0, 20);
      else if (shot.type === "sweep") bearing = -150 + rng.normal(0, 25);
      else if (shot.type === "reverseSweep") bearing = 150 + rng.normal(0, 25);
      else bearing = back === "pull" || back === "glance" ? -140 + rng.normal(0, 25) : natural + 150 + rng.normal(0, 30);
      elevation = shot.type === "ramp" ? rng.range(55, 80) : rng.range(42, 72);
      break;
    case "gloved":
      speed = 0.3 * ballSpeed;
      bearing = 172 + rng.normal(0, 22);
      elevation = rng.range(15, 35);
      break;
    default: // bottomEdge
      speed = 0.25 * ballSpeed;
      bearing = 180 + rng.normal(0, 35);
      elevation = -rng.range(15, 40);
  }

  const el = toRad(elevation);
  const br = toRad(bearing);
  const flat = speed * Math.cos(el);
  return {
    kind,
    quality,
    timed: !mistimed,
    missReason: "",
    shotName: shotName(shot.type, bearing, height, footBack, back),
    at,
    exit: { x: Math.sin(br) * flat, y: speed * Math.sin(el), z: Math.cos(br) * flat },
  };
}
