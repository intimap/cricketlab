import { MENU_PAD } from "../engine/gamepad.js";
import { batWithStick } from "./bat-stick.js";

/**
 * What a gamepad's buttons press in a match (engine/gamepad.js; standard layout 0 A, 1 B, 2 X, 3 Y, 4 LB,
 * 5 RB, 6 LT, 7 RT, 8 back, 9 start). The stick and d-pad are always the arrows: the feet when batting.
 */

/** Batting: A attack (and Space: face up, skip, accept), X defend, Y loft, B improvise, RB or RT power. */
export const BAT_PAD = Object.freeze({
  0: ["KeyS", "Space"],
  1: "KeyD",
  2: "KeyA",
  3: "KeyW",
  4: "KeyR",
  5: "ShiftLeft",
  7: "ShiftRight",
  8: "KeyV",
  9: "Escape",
});

/**
 * Batting with the bat on the right stick (CONTROLS: STICK): the shot and power buttons do nothing, so a
 * stray press can't play a shot; A still faces up, skips and dives.
 */
export const BAT_STICK_PAD = Object.freeze({ 0: "Space", 4: "KeyR", 8: "KeyV", 9: "Escape" });

/** The pause menu: A to choose, B or start to carry on. */
export const PAUSE_PAD = Object.freeze({ ...MENU_PAD, 9: "Escape" });

/**
 * Bowling: A runs in, taps the beats and lets go (and calls for the catch), B takes the keeper's ball, X
 * effort, Y the field, RB the next delivery, back over or around, LB appeal, LT/RT the throw's end.
 */
export function bowlPad(scene) {
  const repertoire = scene.inn?.bowler?.p.bowl.repertoire ?? [];
  const next = repertoire.length ? (repertoire.indexOf(scene.deliveryType) + 1) % repertoire.length : 0;
  return {
    0: "Space",
    1: "Enter",
    2: "KeyE",
    3: "KeyF",
    4: "KeyH",
    5: `Digit${next + 1}`,
    6: "KeyZ",
    7: "KeyX",
    8: "KeyT",
    9: "Escape",
  };
}

/** The binding for the match scene as it is now. */
export function matchPad(scene) {
  if (scene.phase === "pause") return PAUSE_PAD;
  if (scene.human !== "bat") return bowlPad(scene);
  return batWithStick() ? BAT_STICK_PAD : BAT_PAD;
}
