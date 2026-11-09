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
 */

export const CONTROLS = ["buttons", "stick"];
export const CONTROL_NAMES = { buttons: "BUTTONS", stick: "STICK" };

let setting = CONTROLS.includes(load("controls", "buttons")) ? load("controls", "buttons") : "buttons";
export const controlsSetting = () => setting;
export function setControls(value) {
  setting = CONTROLS.includes(value) ? value : "buttons";
  save("controls", setting);
}
export const cycleControls = (dir = 1) => setControls(CONTROLS[(CONTROLS.indexOf(setting) + dir + 2) % 2]);

/** Batting with the stick: the setting, and a stick to bat with (a pad with no right stick keeps the buttons). */
export const batWithStick = () => setting === "stick" && hasSecondStick();

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
  const shot = readSwing(track, { x, y, t: scene.now }, !!cur.delivery);
  cur.stickLift = track.lift ?? 0;
  cur.stickDepth = track.depth ?? 0;
  if (!shot) return null;
  if (shot.power) scene.flash("POWER!", COLORS.gold);
  track.played = { label: labelOf(shot.button, shot.side, scene), power: shot.power, at: scene.now };
  // Off side or leg side, as the batter stands to the camera.
  const side = shot.side * (scene.screenTurn ?? 1) > 0 ? "off" : shot.side ? "leg" : null;
  return { ...shot, side, t: scene.clock() };
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
  const side = Math.abs(x) > Math.max(0, y) && Math.hypot(x, y) >= BACK ? Math.sign(x) : 0;
  const ready =
    depth >= BACK ? labelOf(side || track.side ? "improvise" : depth >= FULL ? "loft" : "attack", side || track.side, scene) : "";
  return {
    y: played ? -1 : y,
    depth,
    back: BACK,
    full: FULL,
    label: played ? `${played.label}${played.power ? " + POWER" : ""}` : ready,
    colour: played ? COLORS.gold : COLORS.cream,
  };
}
