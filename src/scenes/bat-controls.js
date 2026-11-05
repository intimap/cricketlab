import { COLORS } from "../engine/screen.js";
import { keys } from "../engine/input.js";
import { clamp } from "../math.js";
import { strokeFor } from "../sim/strokes.js";
import { PLAYER_ACROSS, contactFor } from "../sim/feet.js";
import { assistOf } from "./assists.js";
import { act } from "./player-actions.js";

/**
 * The batter's controls (TODO.md, Batting): the arrows (a gamepad's stick or d-pad, the touch stick) are his
 * feet, four buttons what he does with the bat. Up is away from the camera, so forward from behind him and
 * back from behind the bowler; left and right as on screen.
 *
 * - Feet: push forward or back and he strides that way from then (a stride takes time: push late and he's
 *   caught part of the way), push again quickly forward to go down the pitch. Left or right takes him across
 *   the crease towards the off side or away to leg while held, and he stays there. Pushed through the
 *   bowler's run-up it's the trigger: he goes that way as the ball is let go. Nothing pushed, he stays on
 *   the crease.
 * - Buttons: A defend, S attack, W loft, D improvise. The feet and the ball make the stroke (sim/strokes.js).
 *   Shift held for power, or tapped to arm it for this ball (tap again to disarm). No button: he leaves it.
 *
 * What the feet set travels in the swing, defend or leave action that commits the shot.
 */

/** Button key → what it does with the bat. */
export const BAT_BUTTONS = Object.freeze({ KeyA: "defend", KeyS: "attack", KeyW: "loft", KeyD: "improvise" });
/** A second push forward this soon after the first (s) takes him down the pitch. */
const DOUBLE_PUSH = 0.3;
/** How fast he moves across his crease (m/s of ball time). */
const ACROSS_SPEED = 1.6;
/** EASY goes back to a ball pitched shorter than this (m from his stumps), as the computer's batters do. */
const EASY_BACK_FROM = 6.8;
/** Shift let go within this long (s) is a tap: it arms (or disarms) power for the ball. */
const POWER_TAP = 0.25;

/** +1 when up on screen is forward for the batter (the camera behind him), -1 from behind the bowler. */
const upIsForward = (scene) => (scene.view === "close" && scene.closeEnd === "bowl" ? -1 : 1);

/** The stick: forward (+1) or back (-1), off side (+1) or leg side (-1), as the screen shows it. */
function stick(scene) {
  const up = (keys.down("ArrowUp") ? 1 : 0) - (keys.down("ArrowDown") ? 1 : 0);
  const right = (keys.down("ArrowRight") ? 1 : 0) - (keys.down("ArrowLeft") ? 1 : 0);
  return { forward: up * upIsForward(scene), off: right * scene.screenTurn };
}

/** This ball's feet as the player has set them so far. */
export function feetSoFar(cur) {
  return (cur.feet ??= { stride: "crease", across: 0, from: null, pushedAt: null, letGo: false });
}

/** The feet to send with the shot: where he's going, how far across, and when he set off. */
export const feetToSend = (feet) => ({ stride: feet.stride, across: feet.across, from: feet.from });

/**
 * EASY's feet: to the length, in good time (forward to a pitched-up or good-length ball, back to a short
 * one), across the crease as the player took him.
 */
export function easyFeet(d, across) {
  const pitchZ = d.pitchedAt?.z ?? 0;
  return { stride: pitchZ > EASY_BACK_FROM ? "back" : "forward", across, from: null };
}

/** Shift: held, it's power for the shot; a quick tap arms or disarms it for the ball. */
function updatePower(scene) {
  const cur = scene.cur;
  const down = keys.down("ShiftLeft") || keys.down("ShiftRight");
  const now = scene.now;
  if (down && !cur.shiftDown) cur.shiftDown = now;
  if (!down && cur.shiftDown) {
    if (now - cur.shiftDown < POWER_TAP) {
      cur.powerArmed = !cur.powerArmed;
      scene.flash(cur.powerArmed ? "POWER ARMED" : "POWER OFF", cur.powerArmed ? COLORS.gold : COLORS.white);
    }
    cur.shiftDown = null;
  }
}

/** Whether this shot gets power: armed for the ball, or Shift held. */
const powered = (cur) => !!cur.powerArmed || !!cur.shiftDown;

/**
 * The feet, every frame he's waiting on the ball: through the run-up nothing moves (what's held is the
 * trigger); from release, the first push forward or back sets the stride going, a second quick one forward
 * takes him down the pitch, and left or right moves him across while held.
 */
export function updateFeet(scene) {
  if (scene.human !== "bat" || !scene.cur || scene.cur.shot) return;
  const cur = scene.cur;
  updatePower(scene);
  const feet = feetSoFar(cur);
  cur.footwork = feet.across;
  if (!cur.delivery) return;
  const t = Math.max(0, scene.clock());
  const dt = Math.max(0, t - (cur.feetT ?? t));
  cur.feetT = t;
  const s = stick(scene);
  if (feet.from === null && s.forward !== 0) {
    feet.stride = s.forward > 0 ? "forward" : "back";
    feet.from = t;
    feet.pushedAt = t;
  } else if (feet.stride === "forward") {
    if (s.forward <= 0) feet.letGo = true;
    else if (feet.letGo && t - feet.pushedAt < DOUBLE_PUSH) feet.stride = "down";
  }
  if (s.off !== 0) feet.across = clamp(feet.across + s.off * ACROSS_SPEED * dt, PLAYER_ACROSS.leg, PLAYER_ACROSS.off);
  cur.footwork = feet.across;
}

/** The buttons once the ball's on its way, and the leave if none is pressed in time. */
export function updateButtons(scene) {
  if (scene.human !== "bat" || !scene.cur || scene.cur.shot || !scene.cur.delivery) return;
  const cur = scene.cur;
  const t = scene.clock();
  const own = feetSoFar(cur);
  const feet = assistOf(scene).feet === "auto" ? easyFeet(cur.delivery, own.across) : feetToSend(own);
  for (const [code, button] of Object.entries(BAT_BUTTONS)) {
    if (!keys.pressed(code)) continue;
    // The ball where his feet will meet it picks the stroke too (a pull at one up around the waist).
    const footwork = scene.inn.bat?.[scene.inn.striker]?.p.bat.footwork;
    const ball = contactFor(cur.delivery, feet, footwork).at;
    const power = powered(cur);
    const shot = strokeFor(button, feet, ball, power);
    if (shot.type === "defend") act(scene, { type: "defend", t, foot: shot.foot, feet });
    else act(scene, { type: "swing", t, shot: shot.type, power, feet, variant: shot.variant ?? null });
    return;
  }
  if (t > scene.arrival("drive", null, feet) + 0.05) act(scene, { type: "leave", feet });
}
