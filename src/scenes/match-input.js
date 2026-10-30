import { COLORS } from "../engine/screen.js";
import { keys } from "../engine/input.js";
import { clamp } from "../math.js";
import { crossingAtZ } from "../sim/delivery.js";
import { CONTACT_Z_FRONT, SWING_TIME, NORMAL_CHARGE, FOOTWORK_MIN, FOOTWORK_MAX } from "../sim/batting.js";
import { LEAVE_LIFT } from "./batter-pose.js";

/**
 * The player's controls in the match scene: batting (shots, defence, leaving it, stepping across the
 * crease) and aiming the bowling crosshair. Each takes the scene (scenes/match.js), whose methods of the
 * same names call these.
 */

/** Backlift before the downswing, normal and power shots. */
export const BACKLIFT_TIME = 0.07;
export const POWER_BACKLIFT_TIME = 0.2;
const POWER_CHARGE = 0.95;
/** The player's timing window is wider than the AI's. */
const PLAYER_TIMING_WINDOW = 1.35;
/** Front foot: S drive, W loft. Back foot: Q (cut, punch, pull, hook or glance, as the ball dictates). */
const SHOT_KEYS = { KeyS: "drive", KeyQ: "cutpull", KeyW: "loft" };
/** Defence: A forward, D back. */
const DEFEND_KEYS = { KeyA: "front", KeyD: "back" };
/** How fast the batter steps across his crease, and back to his guard (m/s). */
const FOOTWORK_SPEED = 1.6;

export function updateBatInput(scene) {
  if (scene.human !== "bat" || !scene.cur) return;
  const cur = scene.cur;
  if (cur.shot) return;
  const t = scene.clock();
  if (!cur.delivery) return;
  const power = keys.down("ShiftLeft") || keys.down("ShiftRight");
  for (const [key, type] of Object.entries(SHOT_KEYS)) {
    if (keys.pressed(key) && !cur.shot) scene.commitSwing(t, scene.shotVariant(type), power);
  }
  for (const [key, foot] of Object.entries(DEFEND_KEYS)) {
    if (keys.pressed(key) && !cur.shot) scene.commitDefend(t, foot);
  }
  if (cur.delivery && !cur.shot) {
    const arrive = crossingAtZ(cur.delivery.samples, CONTACT_Z_FRONT)?.t ?? 0.6;
    if (t > arrive + 0.05) scene.commitLeave();
  }
}

/** Down + W is a ramp; down + left/right + Q is a sweep / reverse sweep. */
export function shotVariant(scene, type) {
  if (!keys.down("ArrowDown")) return type;
  const left = keys.down("ArrowLeft");
  const right = keys.down("ArrowRight");
  if (type === "loft") return "ramp";
  if (type === "cutpull" && left !== right) return left ? "sweep" : "reverseSweep";
  return type;
}

/**
 * Hold Left or Right and the batter steps across his crease that way (the way you press on screen),
 * as far as FOOTWORK_MIN/MAX; let go and he steps back to his guard. Once he plays a shot his feet are
 * set. Down (for the sweeps and the ramp) brings him back to his guard too.
 */
export function updateFootwork(scene, dt) {
  if (scene.human !== "bat" || !scene.cur || scene.cur.shot) return;
  const way = keys.down("ArrowDown") ? 0 : (keys.down("ArrowRight") ? 1 : 0) - (keys.down("ArrowLeft") ? 1 : 0);
  const target = way * scene.screenTurn > 0 ? FOOTWORK_MAX : way * scene.screenTurn < 0 ? FOOTWORK_MIN : 0;
  const now = scene.cur.footwork ?? 0;
  const step = FOOTWORK_SPEED * dt;
  scene.cur.footwork = Math.abs(target - now) <= step ? target : now + Math.sign(target - now) * step;
}

export function commitSwing(scene, t, type, power) {
  const cur = scene.cur;
  cur.swingType = type;
  cur.backliftAt = t;
  cur.swingAt = t + (power ? POWER_BACKLIFT_TIME : BACKLIFT_TIME);
  const timingError = cur.swingAt + SWING_TIME[type] - scene.arrival(type);
  if (power) scene.flash("POWER!", COLORS.gold);
  cur.shot = {
    type,
    charge: power ? POWER_CHARGE : NORMAL_CHARGE,
    timingError,
    windowMult: PLAYER_TIMING_WINDOW,
    footwork: cur.footwork ?? 0,
  };
  cur.play = scene.match.resolve(cur.intent, cur.delivery, cur.shot);
}

export function commitDefend(scene, t, foot) {
  const cur = scene.cur;
  const arrive = scene.arrival("defend", foot);
  cur.defendAt = t;
  cur.shot = {
    type: "defend",
    foot,
    charge: 0,
    timingError: Math.max(0, t + 0.12 - arrive),
    windowMult: PLAYER_TIMING_WINDOW,
    footwork: cur.footwork ?? 0,
  };
  cur.play = scene.match.resolve(cur.intent, cur.delivery, cur.shot);
}

export function commitLeave(scene) {
  const cur = scene.cur;
  // The bat is already on its way up out of the way (see match-view.js): carry on, don't start the leave again.
  cur.leaveAt = Math.min(scene.clock(), scene.arrival("drive") - LEAVE_LIFT);
  cur.shot = { type: "leave", charge: 0, timingError: 0, footwork: cur.footwork ?? 0 };
  cur.play = scene.match.resolve(cur.intent, cur.delivery, cur.shot);
}

/** Arrows move the bowling crosshair (Shift for fine steps), the way you press on screen, whichever end the camera is at. */
export function aimTarget(scene) {
  const step = keys.down("ShiftLeft") || keys.down("ShiftRight") ? 0.25 : 1;
  const turned = scene.screenTurn;
  if (keys.pressed("ArrowLeft")) scene.target.line -= 0.05 * step * turned;
  if (keys.pressed("ArrowRight")) scene.target.line += 0.05 * step * turned;
  if (keys.pressed("ArrowUp")) scene.target.length += 0.5 * step * turned;
  if (keys.pressed("ArrowDown")) scene.target.length -= 0.5 * step * turned;
  scene.target.line = clamp(scene.target.line, -0.9, 1.1);
  scene.target.length = clamp(scene.target.length, 0.5, 12.5);
}
