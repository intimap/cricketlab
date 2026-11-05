import { batImpact, bladeAngle } from "./bat-impact.js";
import { strike, faceTilt, FACE_TURN } from "./bat-ball.js";
import { clamp, toRad } from "../math.js";
import { CREASE, STUMPS_HALF_WIDTH, BALL_RADIUS } from "./geometry.js";
import { simulateFlight, crossingAtZ, sampleAtTime, hitsStumps, isWide } from "./delivery.js";
import { isSweep, playsBack, shotSuitability, backFootShot } from "./shot-choice.js";
import { STRIDES, REACH, STANCE_X, feetOf, contactFor, batRange, padDepth, weightInto, batDescent } from "./feet.js";
import { driveBearing, shotBearing, shotName, intoGap } from "./shot-direction.js";

// Shot choice and direction live in their own modules; older callers import them from here.
export { playsBack, shotSuitability, backFootShot, driveBearing };
// The feet and reach moved to sim/feet.js.
export { STANCE_X, FOOTWORK_MIN, FOOTWORK_MAX } from "./feet.js";

/** Depth (z) at which the bat meets the ball, front and back foot, the stride made (sim/feet.js). */
export const CONTACT_Z_FRONT = STRIDES.forward.z;
export const CONTACT_Z_BACK = STRIDES.back.z;

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

/** The most timing error (s) that turns the face: beyond it the shot is barely made anyway. */
const TURN_ERROR = 0.12;
/** How much timing error (s) moves where the ball is when the bat gets there. */
const TIMING_REACH = 0.1;
/** A block's push at the ball (m/s): enough that it doesn't die at his feet. */
const BLOCK_PUSH = 2.5;

/** Extra vertical bat error (m) when hooking a ball above the shoulder: top edges and gloves. */
const HOOK_ERROR = 0.11;

/**
 * Degrees a perfectly middled shot by a top batter can be worked towards a gap
 * (wrists and bat face, not a choice the player makes); less for a scratchier
 * hit or a lesser batter.
 */
export const MAX_PLACEMENT = 22;

/** Extra bat error (times) from a stride he hadn't finished: off balance. */
const OFF_BALANCE = 0.8;

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
  const feet = feetOf(shot, pitchZ);
  const footBack = feet.stride === "back";
  const meet = contactFor(d, feet, bat.footwork);
  const contact = meet.at ? batContact(d, shot, bat, state, ball, spinner, meet, feet, pitchZ, rng, field) : noContact("beaten");
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
    /** Where his feet met it: the stride, how far across, how much of the stride he'd made, the ball's line there. */
    feet: { stride: feet.stride, across: feet.across ?? 0, made: meet.made, z: meet.z, line: meet.at?.x ?? null },
  };

  if (contact.kind !== "none" && contact.at && contact.exit) {
    if ((contact.kind === "insideEdge" || contact.kind === "bottomEdge") && hitsStumps(d.samples) && rng.chance(0.4)) {
      res.playedOn = true;
      res.bowled = true;
    }
    if (contact.kind === "padPop") res.touchedBat = true;
    res.start = {
      t: contact.at.t,
      pos: { x: contact.at.x, y: contact.at.y, z: contact.at.z },
      vel: contact.exit,
      spin: contact.spin,
    };
    return res;
  }

  res.wide = isWide(d.samples);

  // Pad: does the ball hit the front (or back) leg?
  const padZ = padDepth(meet.z);
  const atPad = crossingAtZ(d.samples, padZ);
  // His pads go where his feet have gone.
  const moved = feet.across ?? 0;
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
      else if (padZ > 2.5 && rng.chance(0.7)) res.lbwNote = "too far down the pitch";
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

  // Beaten down the pitch, out of his ground: a stumping, likelier with the keeper standing up to spin.
  // Beaten playing forward to a spinner, he may overbalance.
  if (feet.stride === "down" && meet.made > 0.3 && contact.missReason !== "leave") {
    res.stumpingChance = rng.chance(spinner ? 0.85 : 0.25);
  } else if (spinner && (shot.type === "drive" || shot.type === "loft") && contact.missReason !== "leave") {
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
function batContact(d, shot, bat, state, ball, spinner, meet, feet, pitchZ, rng, field) {
  const at = meet.at;
  const footBack = feet.stride === "back";
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
  // `difficulty` (from plans.js): above 1 when the ball targets a weakness or springs a surprise.
  const jitter =
    0.013 *
    (1.25 - bat.technique) *
    (1 + (1 - state.settled) * 0.6) *
    (shot.difficulty ?? 1) *
    (1 + OFF_BALANCE * (1 - meet.made));
  // Hooking a ball up around the head is a gamble: hard to get on top of.
  const hooking = shot.type === "cutpull" && at.x <= 0.2 && at.y > 1.35;
  const height = at.y;
  const line = at.x;
  const back = shot.type === "cutpull" ? backFootShot(line, height) : null;
  const batX = aimX + rng.normal(0, jitter);
  // Cuts, pulls and sweeps swing the bat across the body; drives and blocks come down straight.
  const crossBat = Math.abs(Math.sin(bladeAngle(shot.type, back))) > 0.9;
  // From how he stands the bat only gets so high and so low: past that it meets the ball off the middle.
  const [low, high] = batRange(feet, meet.made, shot.type, crossBat);
  const batY = clamp(aimY + rng.normal(0, jitter * 1.5) + (hooking ? rng.normal(0, HOOK_ERROR) : 0), low, high);
  // Early or late, the bat meets the ball where it has got to by then. A straight bat swung through the line
  // follows most of the ball's climb and angle (the better his technique, the more); a cross bat can't
  // follow the climb, so a mistimed pull or cut finds an edge.
  const off = clamp(shot.timingError ?? 0, -TIMING_REACH, TIMING_REACH);
  const follow = 0.5 + 0.4 * bat.technique;
  const latErr = at.x + at.vx * off * (1 - follow) - batX;
  // Played late, a bat coming down steeply is still above where he meant it: a low ball goes under it.
  const descent = batDescent(feet, meet.made, crossBat) * Math.max(0, off);
  const vErr = at.y + at.vy * off * (crossBat ? 1 - 0.3 * bat.technique : 1 - follow) - batY - descent;
  // How well the shot suits the ball; the feet's part comes from where they meet it (sim/feet.js).
  const suit = shotSuitability(shot.type, height, pitchZ, line, spinner);
  const defending = shot.type === "defend";
  // Out of reach from where he's standing: a block lets it go by, an attacking shot swings and misses.
  const reach = defending ? REACH.defend : REACH.attack;
  const fromBody = line - (STANCE_X + (feet.across ?? 0));
  if (fromBody > reach.off || fromBody < -reach.leg) return { ...noContact(defending ? "wide" : "beaten"), outOfReach: true };

  // Timing window (seconds); timing is the error expressed in windows.
  const window = defending
    ? 0.2 * (0.8 + 0.4 * bat.defence)
    : (0.088 - 0.062 * shot.charge) *
      (0.75 + 0.5 * bat.timing) *
      (0.82 + 0.25 * state.settled) *
      (0.6 + 0.4 * suit) *
      (spinner ? 1.25 : 1) *
      (shot.type === "ramp" || (isSweep(shot.type) && !spinner) ? 0.7 : 1);
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
  // The bat's speed at the sweet spot (m/s): up to about 27 for a full-blooded swing with his weight in it.
  const swing = (6.4 + 20.8 * shot.charge * (0.55 + 0.45 * bat.power)) * eye * weightInto(shot.type, feet, meet.made);
  const natural = shotBearing(shot.type, line, height, back);
  // Struck off the face or an edge: the collision decides it. A pad, a glove or the toe are their own.
  const struck = kind !== "padPop" && kind !== "gloved" && (kind !== "bottomEdge" || impact.horizontal);
  let exit;
  let spin = 0;
  let bearing;
  if (struck) {
    // Mistimed, the bat meets the ball before or after its fastest point; a cramped hook slower still.
    // A block is pushed gently at the ball, softer for a good defender.
    const batSpeed = defending
      ? BLOCK_PUSH * (1.2 - 0.5 * bat.defence)
      : swing * (0.5 + 0.5 * quality) * (mistimed ? 0.8 : 1) * (hooking ? 0.75 : 1);
    // Timing turns the face (late goes finer, early squarer) and a scratchy hit strays; a good batter's
    // wrists still work it towards a gap. A block goes where it's pushed.
    const finer = natural < -45 ? -1 : 1;
    const turn = finer * FACE_TURN * clamp(shot.timingError, -TURN_ERROR, TURN_ERROR) + rng.normal(0, 5 + 18 * (1 - quality));
    const meant = natural + turn * (isSweep(shot.type) ? 0.5 : 1);
    const aim = defending ? meant : intoGap(meant, field, MAX_PLACEMENT * quality * (0.4 + 0.6 * bat.technique));
    const tilt = faceTilt(shot.type, back, height, shot.charge, Math.max(0, -timing)) + rng.normal(0, 0.9 + 1.5 * (1 - quality));
    // The edge the ball meets, across the blade.
    const blade = bladeAngle(shot.type, back);
    const hit = strike({
      ball: { x: at.vx, y: at.vy, z: at.vz },
      bearing: aim,
      tilt,
      speed: batSpeed,
      hardness: ball.hardness ?? 1,
      soft: defending ? 0.3 + 0.35 * bat.defence : 0,
      impact,
      offset: { x: impact.across * Math.cos(blade), y: -impact.across * Math.sin(blade) },
      aimed: shot.type === "ramp" ? "tilt" : "face",
    });
    exit = hit.vel;
    spin = hit.spin;
    bearing = (Math.atan2(exit.x, exit.z) * 180) / Math.PI;
  } else {
    let speed, elevation;
    if (kind === "padPop") {
      speed = rng.range(2.5, 5);
      bearing = rng.normal(-95, 50);
      elevation = rng.range(25, 60);
    } else if (kind === "gloved") {
      speed = 0.3 * ballSpeed;
      bearing = 172 + rng.normal(0, 22);
      elevation = rng.range(15, 35);
    } else {
      // Off the toe, under the bat: down into the ground behind.
      speed = 0.25 * ballSpeed * impact.energy;
      bearing = 180 + rng.normal(0, 35);
      elevation = -rng.range(15, 40);
    }
    const el = toRad(elevation);
    const br = toRad(bearing);
    const flat = speed * Math.cos(el);
    exit = { x: Math.sin(br) * flat, y: speed * Math.sin(el), z: Math.cos(br) * flat };
  }

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
    exit,
    /** Off the bat (rad/s, + topspin), which the bounce feels. */
    spin,
  };
}
