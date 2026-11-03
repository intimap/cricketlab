import { activeWicketSide } from "./bowling-side.js";
import { bowlingGeometry } from "../sim/bowling-side.js";
import { playBroadcast } from "./match-audio.js";
import { COLORS } from "../engine/screen.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { clamp } from "../math.js";
import { crossingAtZ } from "../sim/delivery.js";
import { planRunup, releaseError } from "../sim/runup.js";
import { battingFeedback, bowlingFeedback } from "../sim/coach.js";
import { CONTACT_Z_FRONT, SWING_TIME } from "../sim/batting.js";
import { eyeMultiplier } from "../sim/eye.js";
import { pickSledges, pickChirp } from "../sim/field-chatter.js";
import * as beats from "./booth-beats.js";
import { onBallDone } from "./match-feedback.js";
import { BACKLIFT_TIME, POWER_BACKLIFT_TIME } from "../sim/shot-timing.js";

/**
 * A ball's life in the match scene, around the delivery itself: setting up the next ball, the
 * release, the ball going dead and being completed (the scorebook, the commentary box, the coach),
 * the walk back, and simulating overs. Each takes the scene (scenes/match.js), whose methods of the
 * same names call these.
 */

/** The pitch is redrawn each time its wear moves on by 1/GROUND_WEAR_STEPS. */
export const GROUND_WEAR_STEPS = 40;
/** How long the scene lingers after a wicket. */
const WICKET_PAUSE = 6.5;
const MAX_SLEDGES = 3;
const SLEDGE_GAP = 1.5;

export function nextBall(scene) {
  const inn = scene.inn;
  scene.touchEpoch++;
  if (Math.floor(inn.pitch.wear * GROUND_WEAR_STEPS) !== scene.groundWear) scene.buildGround();
  if (inn.isOver) {
    scene.endInnings();
    return;
  }
  if (scene.match.needOver) {
    if (scene.human === "bowl") {
      scene.toChooseBowler();
      return;
    }
    scene.match.startOver();
  }
  scene.particles = [];
  scene.feedback = null;
  scene.walkOff = null;
  scene.sledges = [];
  scene.timeScale = 1;
  if (scene.cam === "auto") scene.view = "close";
  if (inn.freeHit) scene.big("FREE HIT", COLORS.gold, "THE BATTER CAN ONLY BE RUN OUT", 1.6);
  if (scene.human === "bat") {
    const { intent, releaseError } = scene.match.aiPlan();
    scene.cur = scene.newBall(intent, releaseError);
    scene.setPhase("ready");
  } else {
    const skills = inn.bowler.p.bowl;
    if (!skills.repertoire.includes(scene.deliveryType)) scene.deliveryType = skills.repertoire[0];
    scene.cur = null;
    scene.setPhase("setup");
  }
  beats.onNextBall(scene);
}

export function newBall(scene, intent, aiReleaseError) {
  const spinner = scene.spinner;
  const style = scene.inn.bowler.p.bowl.style;
  // The player's run-up varies ball to ball (see runup.js); the AI's is steady.
  const runup = scene.human === "bowl" ? planRunup(style, intent.effort, scene.inn.bowler.stamina) : null;
  return {
    intent,
    aiReleaseError,
    runup,
    runupDur: runup ? runup.dur : spinner ? 1.5 : style === "fast" ? 2.5 : 2.2,
    runupStartZ: spinner ? 25.5 : 33,
    /** Time since the run-up started. */
    tRun: 0,
    delivery: null,
    /** Ball time since release. */
    t: 0,
    shot: null,
    play: null,
    // Striker animation timeline (ball time).
    swingType: null,
    backliftAt: 0,
    swingAt: null,
    defendAt: null,
    leaveAt: null,
    contactDone: false,
    bounceDone: false,
    strikeAt: null,
    done: null,
    /** Index of the next live-ball event to handle. */
    lastEv: 0,
    lineAtBat: 0,
    /** The pressure as the ball was bowled, for the feedback's +/-PRESSURE tag. */
    pressureBefore: scene.inn.pressure,
  };
}

export function release(scene, releaseError) {
  const cur = scene.cur;
  if (cur.aftertouch) cur.intent = { ...cur.intent, aftertouch: cur.aftertouch };
  cur.delivery = scene.match.deliver(cur.intent, releaseError);
  cur.t = 0;
  const atBat = crossingAtZ(cur.delivery.samples, CONTACT_Z_FRONT);
  cur.lineAtBat = atBat ? atBat.x : 0;
  if (scene.human === "bowl") {
    // The AI batter's shot is decided now; schedule its animation.
    const shot = scene.match.aiShot(cur.delivery);
    cur.shot = shot;
    cur.play = scene.match.resolve(cur.intent, cur.delivery, shot);
    const arrive = scene.arrival(shot.type, shot.foot);
    if (shot.type === "defend") cur.defendAt = arrive - 0.25;
    else if (shot.type === "leave") cur.leaveAt = arrive - 0.28;
    else {
      cur.swingAt = arrive - SWING_TIME[shot.type] + shot.timingError;
      cur.swingType = shot.type;
      cur.backliftAt = cur.swingAt - (shot.charge > 0.7 ? POWER_BACKLIFT_TIME : BACKLIFT_TIME);
    }
  }
  if (cur.delivery.noBall) scene.banner("NO BALL", COLORS.gold, 1.2, 3, 50, scene.now + 0.25);
  scene.setPhase("flight");
}

export function ballDead(scene) {
  const cur = scene.cur;
  // A pad hit that might be LBW: appeal first, then the umpire, then perhaps DRS.
  if (!cur.lbwChecked && scene.match.lbwAppeal(cur.play)) {
    cur.lbwChecked = true;
    if (scene.human === "bowl") {
      if (cur.appealed) scene.decideLbw();
      else scene.setPhase("appeal");
    } else {
      // The computer's fielders always go up.
      cur.appealed = true;
      sfx.appeal();
      scene.banner("HOWZAT?", COLORS.cream, 0.9, 3, 60);
      scene.decideLbw();
    }
    return;
  }
  scene.completeBall();
}

export function completeBall(scene) {
  const cur = scene.cur;
  const done = scene.match.finish(cur.play);
  cur.done = done;
  onBallDone(scene.juice, scene.now, scene.human === "bat" ? done.rec.eye : null, {
    before: cur.pressureBefore,
    after: scene.inn.pressure,
  });
  if (scene.human === "bat") scene.flashEye(done.rec.eye);
  // Bowling, and he's given his weakness away: say so on screen too (the box says it in words).
  if (scene.human === "bowl" && done.rec.scout?.tag)
    scene.banner(`WEAKNESS: ${done.rec.scout.tag}`, COLORS.gold, 2.2, 2, 150, scene.now + 0.6);
  if (scene.nets) {
    scene.feedback = scene.coachFeedback(done.rec);
    scene.netsTally.balls++;
    if (scene.feedback.grade === "good") scene.netsTally.good++;
    if (done.rec.wicket) scene.big("OUT!", COLORS.red, done.rec.wicket.how.toUpperCase(), 1.6);
    scene.setPhase("after");
    return;
  }
  // The score bar gets the plain call; the commentary box (below) adds the colour.
  scene.commentary = done.rec.call ?? "";
  scene.commT = 0;
  const { calls } = scene.callFromBooth(done);
  beats.onResult(scene, calls, done.rec);
  const wicket = done.rec.wicket;
  if (wicket) {
    playBroadcast("wicket");
    const batter = scene.inn.bat[wicket.batter].p;
    // The broadcast renderer reads the completed dismissal and score.

    const live = cur.play.live;
    for (const f of live.fielders) {
      if (Math.hypot(f.pos.x - live.ball.pos.x, f.pos.z - live.ball.pos.z) < 25 || f.role !== "field") {
        f.state = "celebrate";
        f.stateAt = live.t;
      }
    }
    const runner = live.runners.find((r) => r.bat === wicket.batter);
    const from = live.runnerPos(runner);
    scene.walkOff = { x: from.x, z: from.z, t0: scene.now + 0.8 };

    // A few fielders near the departing batter get a word in.
    const nearby = live.fielders
      .filter((f) => f.role === "field")
      .sort((a, b) => Math.hypot(a.pos.x - from.x, a.pos.z - from.z) - Math.hypot(b.pos.x - from.x, b.pos.z - from.z));
    const talkers = [
      live.fielders.find((f) => f.role === "keeper"),
      live.fielders.find((f) => f.role === "bowler"),
      nearby[0],
      nearby[1],
    ]
      .filter((f) => !!f)
      .sort(() => Math.random() - 0.5)
      .slice(0, MAX_SLEDGES);
    const lines = pickSledges(scene.inn.bowlTeam.abbr, batter.short, talkers.length);
    scene.sledges = talkers.map((f, i) => ({ fielder: f.idx, text: lines[i], t0: scene.now + 1.1 + i * SLEDGE_GAP }));

    if (!done.applied.inningsOver && scene.inn.wkts < 10) {
      const inn = scene.inn;
      const fresh = inn.bat[inn.striker].balls === 0 && inn.bat[inn.striker].batted ? inn.striker : inn.nonStriker;
      scene.banner(`NEW BATTER: ${inn.bat[fresh].p.name.toUpperCase()}`, COLORS.cream, 2.2, 1, 160, scene.now + WICKET_PAUSE - 2);
    }
  }
  for (const m of done.applied.milestones) scene.banner(m, COLORS.gold, 2.2, 2, 150, scene.now + 0.4);
  // Beat the bat and the close fielders let him know about it, which gets under his skin.
  if (done.rec.beatBat && Math.random() < 0.35) {
    scene.chirp = { text: pickChirp(scene.inn.bowlTeam.abbr), t0: scene.now + 0.3 };
    scene.inn.pressure = clamp(scene.inn.pressure + 0.06);
  }
  scene.setPhase("after");
}

/** Tell the player how his eye went on that ball (the match keeps every batter's: see eye.js). */
export function flashEye(scene, { before, after }) {
  if (after >= 1 && before < 1) scene.banner("EYE IN!", COLORS.gold, 1.4, 3, 40);
  else if (after === 0 && before >= 0.25) scene.flash("EYE LOST", COLORS.red);
  else if (after > before) scene.flash(`EYE x${eyeMultiplier(after).toFixed(2)}`, COLORS.gold);
}

export function afterDuration(scene) {
  const rec = scene.cur?.done?.rec;
  if (!rec) return 1;
  return rec.wicket ? WICKET_PAUSE : rec.boundary ? 2 : 1;
}

/** Fielders walk back to their marks, then on to the next ball (or over/innings end). */
export function updateReturn(scene, dt) {
  const live = scene.cur.play.live;
  live.t += dt;
  let moving = false;
  for (const f of live.fielders) {
    if (f.state === "celebrate" && scene.phaseT < 0.6) continue;
    f.state = "idle";
    const home =
      f.role === "bowler" ? { x: bowlingGeometry(scene.spinner, activeWicketSide(scene)).startX * 0.8, z: 24 } : f.home;
    const dx = home.x - f.pos.x;
    const dz = home.z - f.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.2) {
      moving = true;
      const step = Math.min(dist, 11 * dt);
      f.pos.x += (dx / dist) * step;
      f.pos.z += (dz / dist) * step;
    }
  }
  if ((!moving && scene.phaseT > 0.5) || scene.phaseT > (scene.view === "wide" ? 1.8 : 0.6) || keys.pressed("Space")) {
    const applied = scene.cur.done.applied;
    if (applied.inningsOver) {
      scene.endInnings();
      return;
    }
    if (applied.overEnded) {
      scene.big("END OF OVER", COLORS.cream, "CHANGE OF ENDS", 2.3);
      scene.setPhase("overEnd");
      return;
    }
    scene.nextBall();
  }
}

/** Simulate `overs` overs on the AI and list the highlights. */
export function simulate(scene, overs) {
  const inn = scene.inn;
  const until = Math.min(inn.oversLimit, inn.overNo + overs);
  scene.booth = null;
  scene.simLines = [];
  for (let i = 0; !inn.isOver && inn.overNo < until && i++ < 2000; ) {
    const { rec, applied } = scene.match.simBall();
    if (rec.wicket || rec.boundary || applied.milestones.length || applied.overEnded) {
      const result = rec.wicket ? "OUT! " + rec.wicket.text : rec.boundary ? rec.boundary + "!" : rec.total;
      let line = `${rec.over}.${rec.ball} ${inn.bowl[rec.bowler].p.short} to ${inn.bat[rec.striker].p.short}: ${result}`;
      if (applied.milestones.length) line += "  " + applied.milestones.join(", ");
      if (applied.overEnded) line += `  | END OF OVER ${inn.overNo}: ${inn.runs}/${inn.wkts}`;
      scene.simLines.push(line);
    }
  }
  scene.commentary = scene.simLines.length ? "Simulated. " + scene.match.overCommentary.overSummary(inn) : "";
  scene.setPhase("simSummary");
}

/** The nets coach's verdict on the ball just finished. */
export function coachFeedback(scene, rec) {
  const cur = scene.cur;
  const spinner = scene.spinner;
  if (scene.human === "bat") return battingFeedback({ delivery: cur.delivery, shot: cur.shot, rec, spinner });
  const r = cur.runup;
  const err = r && cur.releaseMark != null ? releaseError(r, cur.releaseMark) : 0;
  const perfect = !!r && Math.abs(err) <= r.zone;
  return bowlingFeedback({ delivery: cur.delivery, intent: cur.intent, releaseError: err, perfect, rec, spinner });
}
