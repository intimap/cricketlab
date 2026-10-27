import { clamp, angleDiff } from "../math.js";
import { bearingOf } from "./geometry.js";
import { isSpinner, bowlingSpeed } from "./teams.js";
import { simulateFlight, crossingAtZ } from "./delivery.js";
import { reactionTime } from "./batting.js";
import { describeBall, readAgainst, exploits, difficulty } from "./plans.js";

// How much pressure makes computer batters impatient (tuned against simulated innings).
const PRESSURE_AGGRESSION = 0.25;
const SLOG_FROM = 0.45;
const SLOG_RATE = 0.5;

/** Pick the best available bowler for the next over, given conditions and fatigue. */
export function pickBowler(inn) {
  const ball = inn.ball;
  let best = -1;
  let bestScore = -1e9;
  // Whoever bowled the over before last can carry on their spell from this end.
  const thisEnd = inn.bowl.findIndex((b) => b.lastOver === inn.overNo - 2);
  inn.bowl.forEach((b, i) => {
    if (!inn.canBowl(i)) return;
    const skills = b.p.bowl;
    const spinner = isSpinner(skills);
    let suits = 0.5;
    if (spinner) suits = 0.25 + 0.55 * ball.rough + 0.6 * (inn.pitch.turn - 0.6) + 0.15 * inn.pitch.wear;
    else if (skills.style === "swing") suits = 0.5 + 0.45 * ball.swing + 0.6 * ball.reverse;
    else if (skills.style === "fast")
      suits = 0.55 + 0.35 * ball.hardness + 0.2 * inn.pitch.type.bounce - 0.25 + 0.4 * ball.reverse;
    else suits = 0.42 + 0.1 * ball.seam;
    const quality = (skills.accuracy + Math.max(skills.swing, skills.seam, skills.spin)) / 2;
    let score = suits * 0.8 + quality * 0.6 + b.stamina * 0.9;
    if (b.stamina < 0.45) score -= 0.6;
    if (i === thisEnd && b.stamina > 0.62 && b.spell < (spinner ? 14 : 7)) score += 0.45;
    if (b.spell >= (spinner ? 16 : 8)) score -= 0.6;
    score += inn.rng.normal(0, 0.05);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best < 0 ? inn.bowl.findIndex((_, i) => inn.canBowl(i)) : best;
}

/**
 * The computer captain's plan for the over, from the bowler's type, the
 * conditions, the pressure, and what he knows of the batter's weakness
 * (scouted, or worked out once the batter has been in a while).
 *   short    - bouncer barrage with a yorker to finish
 *   setup    - three or four going away, then one back in
 *   corridor - outside off, good length, all over
 *   squeeze  - straight, tight, ring field: build pressure
 *   rough    - spinner into the footmarks
 *   flight   - spinner tossing it up to a nervous starter
 */
export function pickOverPlan(inn, rng) {
  const skills = inn.bowler.p.bowl;
  const batter = inn.bat[inn.striker];
  const knows = batter.balls > 24 || rng.chance(0.25);
  const weakness = knows ? batter.p.weakness : null;
  if (isSpinner(skills)) {
    if (weakness === "earlySpin" && inn.batterState(inn.striker).settled < 0.5) return "flight";
    const rough = inn.pitch.roughPatches[0]?.strength ?? 0;
    return rough > 0.25 && rng.chance(0.4) ? "rough" : inn.pressure > 0.4 ? "squeeze" : "stock";
  }
  if ((weakness === "hook" || weakness === "bouncer") && skills.style === "fast" && inn.bowler.stamina > 0.45) return "short";
  if (weakness === "offStump") return "corridor";
  const swinging = (inn.ball.swing > 0.18 || inn.ball.reverse > 0.25) && skills.repertoire.includes("inswing");
  if (weakness === "inswingYorker" && swinging) return "setup";
  if (inn.pressure > 0.45 && rng.chance(0.6)) return "squeeze";
  return swinging ? "setup" : "corridor";
}

export function pickFieldPreset(inn) {
  const bowler = inn.bowler;
  if (bowler && isSpinner(bowler.p.bowl)) return inn.overPlan === "squeeze" ? "ring" : "spin";
  if (inn.overPlan === "short") return "bouncer";
  if (inn.overPlan === "squeeze") return "ring";
  const batter = inn.bat[inn.striker];
  const state = inn.batterState(inn.striker);
  if (inn.ball.overs < 25 || state.settled < 0.25 || inn.ball.reverse > 0.3) return "attacking";
  if (batter.runs > 60 && inn.ball.hardness < 0.7) return "defensive";
  return "balanced";
}

/** What the computer bowler tries to bowl next, and how cleanly it's released. */
export function pickDeliveryPlan(inn, rng) {
  const bowler = inn.bowler;
  const skills = bowler.p.bowl;
  const batter = inn.bat[inn.striker];
  const state = inn.batterState(inn.striker);
  const ball = inn.ball;
  const greenTop = inn.pitch.type.id === "green";
  let effort = "med";
  if (bowler.stamina > 0.7 && (state.settled < 0.3 || ball.overs < 12)) effort = "high";
  if (bowler.stamina < 0.42) effort = "low";

  let type = skills.repertoire[0];
  let line = 0.2;
  let length = 6.5;
  const ballOfOver = bowler.seq % 6;
  const plan = inn.overPlan;
  const has = (t) => skills.repertoire.includes(t);
  if (isSpinner(skills)) {
    const offspin = skills.style === "offspin";
    type = offspin ? "offspin" : "legspin";
    length = 5.4 + rng.normal(0, 0.3);
    // Aim so the expected turn brings it back onto (or just outside) off stump.
    const turn = Math.min(2.6, 0.85 * skills.spin * ball.grip * inn.pitch.turn) * (offspin ? -1 : 1);
    const timeAfterBounce = length / (bowlingSpeed(skills) * 0.86 * inn.pitch.pace);
    line = (offspin ? 0.12 : 0.16) - turn * timeAfterBounce * 0.8;
    if (plan === "rough") {
      // Leg-spinner into the rough outside leg; off-spinner into the patch outside off.
      line = offspin ? 0.5 : -0.55;
      length = 4.6 + rng.normal(0, 0.4);
    }
    effort = plan === "flight" ? "low" : plan === "squeeze" ? "high" : rng.chance(0.15) ? "low" : "med";
    if (has("googly") && rng.chance(0.09)) {
      type = "googly";
      line = 0.1;
    } else if (has("armBall") && rng.chance(0.1)) {
      type = "armBall";
      line = 0.05;
    } else if (rng.chance(0.06)) {
      type = "seam";
      line = 0.05;
    }
    if (batter.p.bat.vsSpin < 0.45 && rng.chance(0.15)) length -= 0.6;
    if (rng.chance(0.06)) length = 7.5;
    if (bowler.stamina < 0.35) effort = "low";
  } else {
    const swinging = ball.swing > 0.18 && ball.reverse < 0.25;
    const reversing = ball.reverse > 0.25;
    const stockSwing = reversing ? "inswing" : "outswing";
    const otherSwing = reversing ? "outswing" : "inswing";
    type = has("outswing") && (swinging || reversing) ? stockSwing : "seam";
    line = 0.22 + rng.normal(0, 0.04);
    length = (greenTop ? 6.1 : 6.7) + rng.normal(0, 0.35);
    if (plan === "squeeze") {
      line = 0.04 + rng.normal(0, 0.03);
      type = "seam";
    }
    if (plan === "short" && (ballOfOver === 1 || ballOfOver === 3) && inn.overBouncers < 2) {
      type = "bouncer";
      line = -0.05 + rng.normal(0, 0.1);
      length = 11;
      effort = "high";
    } else if (plan === "short" && ballOfOver === 5 && has("yorker")) {
      type = "yorker";
      line = 0.02;
      length = 1.9;
    } else if (
      (plan === "setup" || plan === "corridor") &&
      (ballOfOver === 4 || (ballOfOver === 5 && rng.chance(0.4))) &&
      (swinging || reversing) &&
      has("inswing")
    ) {
      // Set them up outside off, then a full one swinging back in.
      type = otherSwing;
      line = 0.02;
      length = plan === "setup" && has("yorker") && rng.chance(0.5) ? 2 : 4.4;
    } else if (state.settled < 0.2 && rng.chance(0.07)) {
      // Yorker for the new batter.
      type = has("yorker") ? "yorker" : "seam";
      line = 0;
      length = 1.9;
      effort = bowler.stamina > 0.5 ? "high" : effort;
    } else if (
      has("bouncer") &&
      inn.overBouncers < 2 &&
      bowler.stamina > 0.5 &&
      rng.chance(batter.p.bat.vsPace < 0.5 ? 0.05 : 0.025)
    ) {
      type = "bouncer";
      line = -0.05;
      length = 11;
      effort = "high";
    } else if (has("slower") && rng.chance(0.05)) {
      type = "slower";
      length = 5.5;
    } else if (has("cutter") && inn.pitch.type.id !== "dust" && rng.chance(0.1)) {
      type = "cutter";
    }
    if (inn.preset === "defensive") {
      line = 0.32;
      length += 0.4;
    }
  }
  const releaseSd = 0.012 + 0.024 * (1 - skills.accuracy) + 0.02 * (1 - bowler.stamina);
  return { intent: { type, line, length, effort }, releaseError: rng.normal(0, releaseSd) };
}

/** 0..1: how attacking a batter is right now. */
export function battingAggression(inn, index) {
  const b = inn.bat[index];
  const state = inn.batterState(index);
  let a = b.p.bat.aggression * (0.6 + 0.5 * state.settled);
  a += clamp(b.dotStreak / 25) * 0.25 * (1 - b.p.bat.temperament);
  if (inn.wkts >= 7) a += 0.15;
  if (inn.oversLimit * 6 - inn.legal < 30) a += 0.15;
  if (inn.ball.hardness > 0.85 && inn.ball.overs < 10) a -= 0.12;
  // Pressure gets to the impatient ones.
  a += inn.pressure * PRESSURE_AGGRESSION * (1.1 - b.p.bat.temperament);
  if (inn.freeHit) a += 0.5;
  return clamp(a, 0.05, 0.98);
}

/** The computer batter's shot to delivery `d`, judged from an early read of it. */
export function pickShot(d, inn, rng) {
  const index = inn.striker;
  const skills = inn.bat[index].p.bat;
  const state = inn.batterState(index);
  const spinner = isSpinner(inn.bowler.p.bowl);
  const aggression = battingAggression(inn, index);
  const react = reactionTime(skills, state, spinner, d.speed);

  const readFrom = d.samples[Math.min(d.samples.length - 1, Math.floor((0.33 + react * 0.5) * 240 * (spinner ? 1.3 : 1)))];
  const read = simulateFlight(
    readFrom,
    d.expectedSwingAcc,
    0,
    d.expectedSpinKick * (0.7 + 0.3 * skills.vsSpin),
    d.expectedBounce,
    d.paceKept,
    [],
    d.bounceIndex >= 0 && readFrom.t >= d.samples[d.bounceIndex].t,
    -0.2,
  );
  const misjudge = 0.07 * (1.25 - skills.technique) * (1.3 - 0.3 * state.settled);
  const atBat = crossingAtZ(read.samples, 1.4) ?? readFrom;
  const line = atBat.x + rng.normal(0, misjudge);
  const height = atBat.y + rng.normal(0, misjudge);
  const pitchZ = (read.pitchedAt?.z ?? 0) + rng.normal(0, misjudge * 6);
  const onStumps = Math.abs(line) < 0.2 && height < 0.85;

  // The battle: does this ball go at his weakness, repeat itself, or spring a surprise?
  const batter = inn.bat[index];
  const seenBall = describeBall(d);
  const weak = exploits(batter.p.weakness, seenBall, { spinner, settled: state.settled });
  const { familiar, surprise } = readAgainst(batter.seen, seenBall);
  const hard = difficulty({ weak, surprise, familiar });

  let type = "defend";
  const roll = rng.next();
  if (line > (spinner ? 0.62 : 0.42)) {
    // Wide outside off.
    if (pitchZ > 7.5 && roll < 0.25 + aggression * 0.5) type = "cutpull";
    else if (pitchZ < 4.5 && roll < aggression * 0.6) type = "drive";
    else type = roll < 0.08 + 0.35 * aggression * (1 - skills.temperament) ? "drive" : "leave";
  } else if (line < -0.32) {
    // Down leg.
    type =
      pitchZ > 8 ? (roll < 0.4 + aggression * 0.4 ? "cutpull" : "leave") : roll < 0.55 + aggression * 0.3 ? "drive" : "leave";
  } else if (height > 1.25) {
    // Short: take it on, or (more often when it's really up there) sway out of the way.
    const hooker = batter.p.weakness === "hook";
    const takeOn = (aggression * 0.6 + skills.vsPace * 0.2) * (hooker ? 1 : height > 1.6 ? 0.3 : height > 1.35 ? 0.5 : 1);
    type = roll < takeOn ? "cutpull" : "leave";
  } else if (!spinner && pitchZ < 2.6 && pitchZ > 1.3 && onStumps) {
    // Yorker on the stumps: dig it out, unless he's going for broke.
    type = roll < aggression * 0.3 ? "drive" : "defend";
  } else if (pitchZ < 4.2 && pitchZ > 1.3) {
    type = roll < 0.5 + aggression * 0.45 ? (spinner && rng.chance(aggression * 0.35) ? "loft" : "drive") : "defend";
  } else if (pitchZ > 8 && onStumps) {
    type = roll < 0.25 + aggression * 0.45 ? "cutpull" : "defend";
  } else if (onStumps) {
    type = roll < 0.3 + aggression * 0.4 ? "drive" : "defend";
  } else {
    let leaveOdds = 0.18 + 0.4 * skills.temperament - 0.3 * aggression + (inn.ball.overs < 15 ? 0.12 : 0);
    if (spinner) leaveOdds = line < 0.45 ? 0 : leaveOdds * 0.25;
    type = roll < leaveOdds ? "leave" : rng.chance(0.4) ? "defend" : "drive";
  }
  // Weaknesses pull the bat towards the wrong shot.
  if (batter.p.weakness === "offStump" && weak > 0 && type === "leave" && rng.chance(0.25 * weak)) type = "drive";
  if (batter.p.weakness === "hook" && seenBall.length === "short" && height > 1.1) type = "cutpull";
  if (batter.p.weakness === "bouncer" && weak > 0 && height > 1.1 && rng.chance(0.7)) type = "defend";
  // Under pressure (or on a free hit) the impatient ones go for it.
  const slogOdds = inn.freeHit ? 0.7 : Math.max(0, inn.pressure - SLOG_FROM) * SLOG_RATE * (1.1 - skills.temperament);
  let slog = false;
  if (type !== "leave" && Math.abs(line) < 0.6 && rng.chance(slogOdds)) {
    type = pitchZ > 8 ? "cutpull" : "loft";
    slog = true;
  }
  // Nobody drives a ball at chest height.
  if ((type === "drive" || type === "loft") && height > 1.2) type = height > 1.5 ? "leave" : "defend";
  let softPush = false;
  if (type === "defend" && height < 1.1 && rng.chance(0.25 + 0.3 * aggression)) {
    type = "drive";
    softPush = true;
  }
  if (spinner && type === "drive" && rng.chance(aggression * 0.25)) type = "loft";
  // Sweep the spinner when it's pitched up.
  if (
    spinner &&
    (type === "drive" || type === "defend") &&
    pitchZ > 1.5 &&
    pitchZ < 6 &&
    height < 0.8 &&
    rng.chance(aggression * 0.2)
  ) {
    type = rng.chance(0.15) ? "reverseSweep" : "sweep";
  }

  let charge =
    type === "defend" || type === "leave"
      ? 0
      : softPush
        ? rng.range(0, 0.12)
        : clamp(0.15 + aggression * 0.6 + rng.normal(0, 0.15) + (type === "loft" ? 0.15 : 0), 0.05, 1);
  if (slog) charge = Math.max(charge, rng.range(0.8, 1));
  else if (batter.p.weakness === "hook" && type === "cutpull" && height > 1.1) charge = Math.max(charge, rng.range(0.5, 0.8));
  // He's seen this one before: he's lined it up.
  if (familiar >= 3 && charge > 0) charge = Math.min(1, charge + 0.1);
  const vsType = spinner ? skills.vsSpin : skills.vsPace;
  const timingSd = (0.03 - 0.012 * skills.timing - 0.006 * state.settled) * (1.25 - 0.4 * vsType) * (1 + charge * 0.4) + 0.006;
  // A slower ball he hasn't picked: through the shot too early.
  const timingError = rng.normal(d.paceMisread ? -0.035 : 0, Math.max(0.006, timingSd) * Math.sqrt(hard));
  return {
    type,
    charge,
    timingError,
    aim: type === "leave" || type === "defend" ? null : pickGap(inn, type, line),
    difficulty: hard,
    battle: { seenBall, weak, familiar, surprise },
  };
}

/** Bearing within the shot's natural arc that is furthest from any fielder. */
function pickGap(inn, type, line) {
  const arc = {
    drive: line > 0.1 ? [-10, 85] : [-55, 40],
    loft: [-60, 50],
    cutpull: line > 0.2 ? [70, 135] : [-120, -50],
    sweep: [-135, -70],
    reverseSweep: [70, 135],
  }[type];
  if (!arc) return null;
  const fielders = inn.placements.map((p) => bearingOf(p.pos.x, p.pos.z));
  let best = (arc[0] + arc[1]) / 2;
  let bestGap = -1;
  for (let b = arc[0]; b <= arc[1]; b += 5) {
    const gap = Math.min(...fielders.map((f) => Math.abs(angleDiff(b, f))), 90);
    if (gap > bestGap) {
      bestGap = gap;
      best = b;
    }
  }
  return best;
}
