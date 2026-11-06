import { COLORS } from "../engine/screen.js";
import { keys } from "../engine/input.js";
import { clamp } from "../math.js";
import { SWING_TIME, NORMAL_CHARGE, playsBack } from "../sim/batting.js";
import { swingTimeOf } from "../sim/bats.js";
import { BACKLIFT_TIME, POWER_BACKLIFT_TIME, PLAYER_TIMING_WINDOW, POWER_CHARGE } from "../sim/shot-timing.js";
export { BACKLIFT_TIME, POWER_BACKLIFT_TIME, PLAYER_TIMING_WINDOW, POWER_CHARGE } from "../sim/shot-timing.js";
import { meterPos, releaseError, METER_FROM } from "../sim/runup.js";
import { rhythmOf } from "../sim/rhythm.js";
import { assistOf } from "./assists.js";
import { LEAVE_LIFT } from "./batter-pose.js";
import { act } from "./player-actions.js";

/**
 * The player's controls in the match scene: committing the batter's shot, defence or leave (the controls
 * themselves are in scenes/bat-controls.js), aiming the bowling crosshair and the run-up. Each takes the scene (scenes/match.js), whose methods of the
 * same names call these.
 */

// The batting controls (the feet on the arrows, four buttons): scenes/bat-controls.js.
export { updateFeet as updateFootwork, updateButtons as updateBatInput } from "./bat-controls.js";

/**
 * The feet for a shot that didn't bring its own (an older replay or test): the shot's own foot, forward or
 * back, and the step across, started as he commits (`t`). The controls send theirs (scenes/bat-controls.js).
 */
function keyFeet(scene, type, foot, t) {
  const back = playsBack(type, foot, scene.cur.delivery.pitchedAt?.z ?? 0);
  return { stride: back ? "back" : "forward", across: scene.cur.footwork ?? 0, from: t };
}

export function commitSwing(scene, t, type, power, given = null, variant = null) {
  const cur = scene.cur;
  cur.swingType = type;
  cur.backliftAt = t;
  cur.swingAt = t + (power ? POWER_BACKLIFT_TIME : BACKLIFT_TIME);
  const feet = given ?? keyFeet(scene, type, null, t);
  // A heavier bat takes longer to come down (sim/bats.js).
  const swing = SWING_TIME[type] * swingTimeOf(scene.inn?.bat?.[scene.inn.striker]?.p.blade);
  const timingError = cur.swingAt + swing - scene.arrival(type, null, feet);
  if (power) scene.flash("POWER!", COLORS.gold);
  cur.shot = {
    type,
    charge: power ? POWER_CHARGE : NORMAL_CHARGE,
    timingError,
    windowMult: PLAYER_TIMING_WINDOW * assistOf(scene).window,
    footwork: feet.across,
    feet,
    variant,
  };
  cur.play = scene.match.resolve(cur.intent, cur.delivery, cur.shot);
}

export function commitDefend(scene, t, foot, given = null) {
  const cur = scene.cur;
  const feet = given ?? keyFeet(scene, "defend", foot, t);
  const arrive = scene.arrival("defend", foot, feet);
  cur.defendAt = t;
  cur.shot = {
    type: "defend",
    foot,
    charge: 0,
    timingError: Math.max(0, t + 0.12 - arrive),
    windowMult: PLAYER_TIMING_WINDOW * assistOf(scene).window,
    footwork: feet.across,
    feet,
  };
  cur.play = scene.match.resolve(cur.intent, cur.delivery, cur.shot);
}

export function commitLeave(scene, given = null) {
  const cur = scene.cur;
  // The bat is already on its way up out of the way (see match-view.js): carry on, don't start the leave again.
  cur.leaveAt = Math.min(scene.clock(), scene.arrival("drive") - LEAVE_LIFT);
  cur.shot = {
    type: "leave",
    charge: 0,
    timingError: 0,
    footwork: given?.across ?? cur.footwork ?? 0,
    feet: given ?? { ...keyFeet(scene, "leave", null, 0), from: null },
  };
  cur.play = scene.match.resolve(cur.intent, cur.delivery, cur.shot);
}

/** Arrows move the bowling crosshair (Shift for fine steps), the way you press on screen, whichever end the camera is at. */
export function aimTarget(scene) {
  const step = keys.down("ShiftLeft") || keys.down("ShiftRight") ? 0.25 : 1;
  const turned = scene.screenTurn;
  if (keys.pressed("ArrowLeft")) scene.target.line -= 0.05 * step * turned;
  if (keys.pressed("ArrowRight")) scene.target.line += 0.05 * step * turned;
  // Up is away from the camera whichever hand the batter is (only the line turns for a left-hander).
  const end = scene.view === "close" && scene.closeEnd === "bowl" ? -1 : 1;
  if (keys.pressed("ArrowUp")) scene.target.length += 0.5 * step * end;
  if (keys.pressed("ArrowDown")) scene.target.length -= 0.5 * step * end;
  scene.target.line = clamp(scene.target.line, -0.9, 1.1);
  scene.target.length = clamp(scene.target.length, 0.5, 12.5);
}

/** Seconds of holding left/right in the run-up for full aftertouch. */
const AFTERTOUCH_BUILD = 0.5;

/** A tap this late after a beat (s) still counts for it; any later and the beat has gone by. */
const BEAT_LATE = 0.16;

/** The next beat still to tap (index), or -1 once both are tapped or gone by. Beats gone by are marked missed. */
function nextBeat(cur) {
  const beats = cur.beats ?? [];
  for (const [i, b] of beats.entries()) {
    if (b.error !== null || b.missed) continue;
    if (cur.tRun > b.at + BEAT_LATE) {
      b.missed = true;
      continue;
    }
    return i;
  }
  return -1;
}

/** The rhythm so far (sim/rhythm.js): beats tapped, missed ones counting as off the beat (or less, on EASY). */
export function runupRhythm(cur, assist) {
  return rhythmOf(
    (cur.beats ?? []).map((b) => b.error),
    cur.intent.effort,
    assist.beatWiden,
    assist.missedBeat,
  );
}

/**
 * The bowler running in: Space on his last two footfalls (the beats), then Space at the delivery stride to
 * release (or a late one if the player waits too long); arrows for aftertouch, earned by the rhythm.
 */
export function updateRunup(scene, dt) {
  const cur = scene.cur;
  cur.tRun += dt;
  if (scene.human === "bowl") {
    const beat = nextBeat(cur);
    if (keys.pressed("Space") && beat >= 0 && cur.tRun > cur.beats[beat].at - BEAT_LATE * 2) {
      act(scene, { type: "beat", index: beat, error: cur.tRun - cur.beats[beat].at });
      return;
    }
    // Aftertouch: hold left or right through the run-up for extra swing or spin that way.
    const held = (keys.down("ArrowRight") ? 1 : 0) - (keys.down("ArrowLeft") ? 1 : 0);
    if (held && cur.tRun > cur.runupDur * 0.3) {
      cur.aftertouch = clamp((cur.aftertouch ?? 0) + (held * scene.screenTurn * dt) / AFTERTOUCH_BUILD, -1, 1);
    }
    // Release on Space: early drops it short, late drags it full, very late is a no-ball.
    const r = cur.runup;
    const pos = meterPos(r, cur.tRun);
    if (keys.pressed("Space") && pos > METER_FROM) {
      const stamina = scene.inn.bowler.stamina;
      let err = releaseError(r, pos);
      cur.releaseMark = pos;
      // Inside the gold zone the release is perfect; outside it, fatigue makes it worse.
      if (Math.abs(err) <= r.zone) {
        err = 0;
        scene.flash("PERFECT RELEASE", COLORS.gold);
      } else {
        err *= 1.3 - 0.3 * stamina;
      }
      for (const b of cur.beats ?? []) if (b.error === null) b.missed = true;
      act(scene, { type: "release", error: clamp(err, -0.35, 0.3), rhythm: runupRhythm(cur, assistOf(scene)) });
    } else if (releaseError(r, pos) > 0.17) {
      cur.releaseMark = pos;
      // Held on too long: dragged full, by the match's dice.
      act(scene, { type: "release", error: scene.match.rng.range(0.17, 0.2), rhythm: runupRhythm(cur, assistOf(scene)) });
    }
  } else if (cur.tRun >= cur.runupDur + clamp(cur.aiReleaseError, -0.08, 0.08)) {
    scene.release(cur.aiReleaseError);
  }
}
