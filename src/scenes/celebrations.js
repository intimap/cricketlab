import { keys, mouse } from "../engine/input.js";
import { CELEBRATION_HOLD } from "../render/match-broadcast.js";

/**
 * A wicket or boundary's celebration can be skipped with Space, Enter or a tap, once it has been up for
 * CELEBRATION_HOLD seconds: on to the next ball.
 */
export function skipCelebration(scene) {
  const rec = scene.cur?.done?.rec;
  if (!(rec?.wicket || rec?.boundary) || scene.phaseT < CELEBRATION_HOLD) return false;
  if (!(keys.pressed("Space") || keys.pressed("Enter") || mouse.pressed)) return false;
  scene.banners = [];
  scene.sledges = [];
  scene.walkOff = null;
  scene.chirp = null;
  scene.setPhase("return");
  return true;
}
