import { batImpact, edgeExit } from "./bat-impact.js";
import { clamp, toRad } from "../math.js";
import { CREASE, STUMPS_HALF_WIDTH, BALL_RADIUS } from "./geometry.js";
import { simulateFlight, crossingAtZ, sampleAtTime, hitsStumps, isWide } from "./delivery.js";
import { isSweep, playsBack, shotSuitability, backFootShot } from "./shot-choice.js";
import { driveBearing, shotBearing, shotName, intoGap } from "./shot-direction.js";

// Shot choice and direction live in their own modules; older callers import them from here.
export { playsBack, shotSuitability, backFootShot, driveBearing };

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

/**
 * Footwork and reach. The batter takes guard at STANCE_X (m, just leg side of middle) and can step
 * across the crease before playing, as far as FOOTWORK_MIN (leg side) or FOOTWORK_MAX (off side). His
 * arms and bat reach so far either side of where he stands: less for a block than for an attacking
 * shot. A ball beyond his reach goes past the bat without touching it.
 */
export const STANCE_X = -0.14;
export const FOOTWORK_MIN = -0.1;
export const FOOTWORK_MAX = 0.1;
const REACH = { defend: 0.42, attack: 0.65 };

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
 * Decide what happens when delivery `d` meets `shot`: bat contact, pad
 * (with an LBW verdict), bowled, wide, or through to the keeper. Returns the
 * result plus the ball's starting state for the live play that follows.
 * `field`: the fielders' bearings, for a well-struck ball to find the gaps.
 *
 * shot: { type: drive|cutpull|loft|defend|leave (or ramp/sweep/reverseSweep), charge, timingError, footwork? (m),
 *         foot? ("front"/"back", for defence), windowMult?, eyeMult? (the batter's eye, see eye.js) }
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
  // His pads go where his feet have gone.
  const moved = shot.footwork ?? 0;
  let padMin = (footBack ? -0.24 : -0.26) + moved;
  let padMax = (footBack ? 0.05 : 0.07) + moved;
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
  // The batter's eye: a bigger timing window and sweet spot, and more bat speed.
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
  // Out of reach from where he's standing: a block lets it go by, an attacking shot swings and misses.
  if (Math.abs(line - (STANCE_X + (shot.footwork ?? 0))) > (defending ? REACH.defend : REACH.attack))
    return noContact(defending ? "wide" : "beaten");

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
  if (Math.abs(timing) > 2.4) return { ...noContact(timing < 0 ? "early" : "late"), timing };

  const sweetSpot = (defending ? 0.052 : 0.033) * (0.6 + 0.4 * suit) * eyeEase;
  const impact = batImpact({ dx: latErr, dy: vErr, timing, type: shot.type, back, sweetWidth: sweetSpot });
  if (impact.missed) return { ...noContact("beaten"), batX, impact };

  let kind;
  if (impact.region === "handle") kind = "gloved";
  else if (impact.along < 0) kind = "bottomEdge";
  else if (impact.edge && impact.horizontal) kind = vErr > 0 ? "topEdge" : "bottomEdge";
  else if (!impact.edge) kind = "middle";
  else if (impact.across < 0) kind = "insideEdge";
  else kind = Math.abs(impact.across) <= 0.062 ? "thickEdge" : "thinEdge";
  if (kind === "insideEdge" && rng.chance(0.4)) kind = "padPop";

  const mistimed = Math.abs(timing) > 1;
  const timingQuality = mistimed ? Math.max(0.12, 0.55 - 0.32 * (Math.abs(timing) - 1)) : 1 - 0.45 * timing * timing;
  const contactQuality = (kind === "middle" ? impact.faceQuality : 0.4) * impact.energy;
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
    case "thickEdge":
    case "insideEdge": {
      const edge = edgeExit(impact, ballSpeed, batSpeed, defending, kind === "insideEdge" ? -1 : 1);
      speed = edge.speed;
      bearing = edge.bearing + rng.normal(0, edge.spread);
      elevation = edge.elevation + rng.normal(0, kind === "insideEdge" ? 5 : 4 + 4 * impact.thickness);
      break;
    }
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

  // Toe and splice hits return less energy, including otherwise clean face hits.
  if (kind !== "gloved" && kind !== "padPop") speed *= impact.energy;
  speed = Math.max(0, speed);
  const el = toRad(elevation);
  const br = toRad(bearing);
  const flat = speed * Math.cos(el);
  return {
    kind,
    impact,
    quality,
    timed: !mistimed,
    /** The timing error in windows (negative early), for the player's timing meter. */
    timing,
    missReason: "",
    shotName: shotName(shot.type, bearing, height, footBack, back),
    at,
    exit: { x: Math.sin(br) * flat, y: speed * Math.sin(el), z: Math.cos(br) * flat },
  };
}
