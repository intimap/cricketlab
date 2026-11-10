import { COLORS } from "../engine/screen.js";
import { load, save } from "../engine/storage.js";
import { secondStick, hasSecondStick } from "../engine/analog.js";
import { clamp } from "../math.js";
import { assistOf } from "./assists.js";

/**
 * Batting with the bat on one stick (CONTROLS: STICK): a gamepad's right stick, or the touch screen's second
 * stick. Pull back and the bat goes up; push forward and it comes down, timed from the moment the stick goes
 * forward past the middle. How you pulled back is the shot:
 *
 * - no backswing (just push forward): a block;
 * - pulled back part way: an attacking shot; all the way to the stop: the shot in the air (loft);
 * - pulled out to the side instead: the sweep to leg, the reverse sweep to the off side (the ramp off the
 *   back foot);
 * - a flick forward, from well back to forward in a blink: power, on whichever shot it is.
 *
 * Pull back and let go (the stick springs back to the middle) and the bat comes down: no shot. The feet stay
 * on the other stick (scenes/bat-controls.js), and the feet and the ball pick the stroke as they do for the
 * buttons (sim/strokes.js); where it goes still comes from the timing. The keyboard always has the buttons.
 *
 * CONTROLS: STICK PLUS is the same bat with two changes (readSwingPlus):
 *
 * - the sweeps are a roll: out at one side, round through the back, up at the other side. The ball goes the way
 *   the stick finishes, so from leg round to off is the reverse sweep, from off round to leg the sweep;
 * - the follow-through aims: the way the stick travels as it's pushed through the middle (from straight back
 *   up is the shot's own line; pulled round to a corner first and pushed across, it goes that way).
 */

export const CONTROLS = ["buttons", "stick", "stickplus"];
export const CONTROL_NAMES = { buttons: "BUTTONS", stick: "STICK", stickplus: "STICK PLUS" };

/** A new player bats with the stick (a pad with no right stick, and the keyboard, still have buttons). */
export const DEFAULT_CONTROLS = "stick";
let setting = CONTROLS.includes(load("controls", DEFAULT_CONTROLS)) ? load("controls", DEFAULT_CONTROLS) : DEFAULT_CONTROLS;
export const controlsSetting = () => setting;
export function setControls(value) {
  setting = CONTROLS.includes(value) ? value : "buttons";
  save("controls", setting);
}
export const cycleControls = (dir = 1) =>
  setControls(CONTROLS[(CONTROLS.indexOf(setting) + dir + CONTROLS.length) % CONTROLS.length]);

/** The setting puts the bat on a stick (STICK or STICK PLUS). */
export const stickSetting = () => setting !== "buttons";
/** STICK PLUS: rolled sweeps and an aimed follow-through. */
export const stickPlus = () => setting === "stickplus";

/** Batting with the stick: the setting, and a stick to bat with (a pad with no right stick keeps the buttons). */
export const batWithStick = () => stickSetting() && hasSecondStick();

/** Pulled this far from the middle (not forward), the bat is up: the backswing. */
export const BACK = 0.3;
/** Pulled this far, to the stop: the full backswing, the shot in the air. */
export const FULL = 0.88;
/** This far forward of the middle: the swing. */
export const FORWARD = 0.3;
/** Back in the middle this long (s), the backswing's let go and the bat comes down. */
export const DROP = 0.15;
/** From well back to forward in this long (s) or less: a flick, power. */
export const FLICK = 0.07;

/** STICK PLUS. A roll's ends: this far out to a side, and no further back than SIDE_LEVEL of that (near level). */
export const SIDE = 0.6;
const SIDE_LEVEL = 0.5;
/** Its middle: this far back, round the bottom of the stick. */
export const ROLL_BACK = 0.6;
/** From leaving one side to reaching the other in this long (s) or less: a flicked roll, power (the slog-sweep). */
export const ROLL_FLICK = 0.15;
/** A follow-through within this many degrees of straight up is the shot's own line... */
export const AIM_DEAD = 10;
/** ...and this many or more is aimed all the way (the diagonal from a corner). */
export const AIM_FULL = 45;

/**
 * Read the swing, one sample of the stick at a time: `track` is this ball's memory, the sample { x, y, t }
 * (x right as the screen shows it, y down = back, t seconds). Returns null, or the shot once, as the stick
 * goes forward past the middle: { button, power, side (+1 the screen's right, -1 its left, 0 straight), t }.
 * Not `armed` (the bowler still running in), a push forward plays nothing: it just lets the backswing go.
 * Also keeps track.lift (0..1), how high the bat is, for the batter's pose and the gauge.
 */
export function readSwing(track, { x, y, t }, armed = true) {
  if (track.done) return null;
  const pulled = Math.hypot(x, y);
  if (y <= -FORWARD && !armed) {
    track.depth = 0;
    track.side = 0;
    track.lift = 0;
    return null;
  }
  if (y <= -FORWARD) {
    track.done = true;
    const depth = track.depth ?? 0;
    const side = track.side ?? 0;
    const button = depth < BACK ? "defend" : side ? "improvise" : depth >= FULL ? "loft" : "attack";
    const power = button !== "defend" && track.lastBack !== undefined && t - track.lastBack <= FLICK;
    track.lift = 0;
    return { button, power, side, t };
  }
  if (pulled >= BACK) {
    // The backswing: how far (the deepest this time), and which way at its deepest: more out to the side
    // than back is the side.
    if (pulled >= (track.depth ?? 0)) track.side = Math.abs(x) > Math.max(0, y) ? Math.sign(x) : 0;
    track.depth = Math.max(track.depth ?? 0, pulled);
    track.lastBack = t;
    track.backSince ??= t;
    track.idleSince = null;
    track.lift = clamp(pulled);
    return null;
  }
  // In the middle: a backswing held a moment here is let go.
  track.idleSince ??= t;
  if (track.depth && t - track.idleSince > DROP) {
    track.depth = 0;
    track.side = 0;
    track.backSince = null;
  }
  track.lift = Math.max(0, (track.lift ?? 0) - 0.12);
  return null;
}

/** Out at a side, near level: a roll's end (-1 the screen's left, +1 its right, 0 not). */
const sideOf = (x, y) => (Math.abs(x) >= SIDE && y <= SIDE_LEVEL * Math.abs(x) ? Math.sign(x) : 0);

/** The follow-through's angle (degrees, + the screen's right) as aim, -1..1: 0 within AIM_DEAD of straight. */
export function aimOf(degrees) {
  const off = Math.abs(degrees) - AIM_DEAD;
  return off <= 0 ? 0 : Math.sign(degrees) * clamp(off / (AIM_FULL - AIM_DEAD));
}

/** Let the backswing go: the bat comes down, nothing's held. */
function letGo(track) {
  track.depth = 0;
  track.lift = 0;
  track.from = null;
  track.rollFrom = 0;
  track.rollBack = false;
}

/**
 * STICK PLUS's swing (as readSwing): the shot once, { button, power, side, aim, t }. How far back is the
 * straight-back part only, so moving round to a corner doesn't make it a loft. A roll from one side round the
 * back to the other is the sweep, played (and timed) as it reaches the far side: `side` is that side, and the
 * ball goes that way. Pushed forward, `aim` (-1..1, + the screen's right) is the way the stick travelled, from
 * where it last was out at the edge in the back half (or the middle, for a block) to where it crossed forward.
 */
export function readSwingPlus(track, { x, y, t }, armed = true) {
  if (track.done) return null;
  const pulled = Math.hypot(x, y);
  if (y <= -FORWARD) {
    if (!armed) {
      letGo(track);
      return null;
    }
    track.done = true;
    const depth = track.depth ?? 0;
    const button = depth < BACK ? "defend" : depth >= FULL ? "loft" : "attack";
    const power = button !== "defend" && track.lastBack !== undefined && t - track.lastBack <= FLICK;
    const from = track.from ?? { x: 0, y: 0 };
    const aim = aimOf((Math.atan2(x - from.x, from.y - y) * 180) / Math.PI);
    track.lift = 0;
    return { button, power, side: 0, aim, t };
  }
  if (pulled >= BACK) {
    track.depth = Math.max(track.depth ?? 0, y);
    // Where the follow-through starts: the last place out at the edge in the back half (a push that
    // curves round the edge on its way forward still aims the way it set off).
    if (y >= 0) track.from = { x, y };
    if (y >= BACK) track.lastBack = t;
    track.idleSince = null;
    track.lift = clamp(Math.max(y, pulled * 0.6));
    // The roll: a side, round the back, the other side.
    const side = sideOf(x, y);
    if (side && side === -track.rollFrom && track.rollBack) {
      const power = t - track.sideLeft <= ROLL_FLICK;
      if (!armed) {
        // Rolled before the ball's let go: nothing played, but he can roll back again.
        track.rollFrom = side;
        track.rollBack = false;
        track.sideLeft = t;
        return null;
      }
      track.done = true;
      track.lift = 0;
      return { button: "improvise", power, side, aim: 0, t };
    }
    if (side) {
      track.rollFrom = side;
      track.rollBack = false;
      track.sideLeft = t;
    } else if (track.rollFrom && y >= ROLL_BACK) track.rollBack = true;
    return null;
  }
  // In the middle: the roll's broken, and a backswing held a moment here is let go.
  track.rollFrom = 0;
  track.rollBack = false;
  track.idleSince ??= t;
  if (track.depth && t - track.idleSince > DROP) letGo(track);
  track.lift = Math.max(0, (track.lift ?? 0) - 0.12);
  return null;
}

/** This ball's swing so far (reset each ball with `cur`). */
export const swingTrack = (cur) => (cur.stickSwing ??= {});

/**
 * Read the stick this frame while he waits on the ball, from the run-up on (the bat can go up early):
 * returns the shot once it's played (after the ball's let go), else null. The shot's t is ball time; the
 * screen's left and right become his off and leg side by `screenTurn` (as for the feet).
 */
export function stickShot(scene) {
  const cur = scene.cur;
  const track = swingTrack(cur);
  const { x, y } = secondStick();
  const read = stickPlus() ? readSwingPlus : readSwing;
  const shot = read(track, { x, y, t: scene.now }, !!cur.delivery);
  cur.stickLift = track.lift ?? 0;
  cur.stickDepth = track.depth ?? 0;
  if (!shot) return null;
  if (shot.power) scene.flash("POWER!", COLORS.gold);
  track.played = { label: labelOf(shot.button, shot.side, scene), power: shot.power, aim: shot.aim ?? null, at: scene.now };
  // Off side or leg side, as the batter stands to the camera (the aim too: + is his off side).
  const turn = scene.screenTurn ?? 1;
  const side = shot.side * turn > 0 ? "off" : shot.side ? "leg" : null;
  const aim = shot.aim ? shot.aim * turn : null;
  return { ...shot, side, aim, t: scene.clock() };
}

/** What a backswing will play, as the gauge names it. */
function labelOf(button, side, scene) {
  if (button === "improvise") return side * (scene.screenTurn ?? 1) > 0 ? "REVERSE SWEEP" : "SWEEP";
  return { defend: "BLOCK", attack: "ATTACK", loft: "LOFT" }[button];
}

/** How long the gauge stays up after the shot (s), showing what was played. */
const GAUGE_AFTER = 0.7;

/**
 * The swing gauge's reading (render/swing-gauge.js), or null when it isn't shown: batting on the stick, on
 * an assist level that shows it (not HARD), from facing up until just after the shot.
 */
export function swingGauge(scene) {
  const cur = scene.cur;
  if (scene.human !== "bat" || !cur || !batWithStick() || !assistOf(scene).gauge) return null;
  if (!["ready", "runup", "flight"].includes(scene.phase)) return null;
  const track = swingTrack(cur);
  const played = track.played;
  if (cur.shot && (!played || scene.now - played.at > GAUGE_AFTER)) return null;
  const { x, y } = secondStick();
  const depth = played ? 0 : (track.depth ?? 0);
  const plus = stickPlus();
  const ready = plus ? plusReady(track, x, y, depth, scene) : sideReady(track, x, y, depth, scene);
  return {
    y: played ? -1 : y,
    depth,
    back: BACK,
    full: FULL,
    label: played ? `${played.label}${played.power ? " + POWER" : ""}` : ready.label,
    colour: played ? COLORS.gold : COLORS.cream,
    // STICK PLUS: where it'll go (-1..1 as the screen shows it): pushed now through the middle, or as played.
    aim: plus ? (played ? played.aim : ready.aim) : null,
  };
}

/** STICK: what the backswing will play, a sweep if it's out to the side. */
function sideReady(track, x, y, depth, scene) {
  const side = Math.abs(x) > Math.max(0, y) && Math.hypot(x, y) >= BACK ? Math.sign(x) : 0;
  if (depth < BACK) return { label: "" };
  return { label: labelOf(side || track.side ? "improvise" : depth >= FULL ? "loft" : "attack", side || track.side, scene) };
}

/** STICK PLUS: rolling round the back, the sweep it'll be; else what a push from here plays, and its aim. */
function plusReady(track, x, y, depth, scene) {
  if (track.rollFrom && track.rollBack) return { label: labelOf("improvise", -track.rollFrom, scene), aim: null };
  const out = Math.hypot(x, y) >= BACK;
  // Pushed from here straight through the middle, it travels from where the stick is to the centre.
  const aim = out ? aimOf((Math.atan2(-x, y) * 180) / Math.PI) : null;
  if (depth < BACK) return { label: "", aim };
  return { label: labelOf(depth >= FULL ? "loft" : "attack", 0, scene), aim };
}
