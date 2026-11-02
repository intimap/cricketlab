import { keys, mouse } from "../engine/input.js";

/** A wicket or boundary's celebration can be skipped with Space, Enter or a tap: on to the next ball. */
export function skipCelebration(scene) {
  const rec = scene.cur?.done?.rec;
  if (!(rec?.wicket || rec?.boundary) || !(keys.pressed("Space") || keys.pressed("Enter") || mouse.pressed)) return false;
  scene.banners = [];
  scene.sledges = [];
  scene.walkOff = null;
  scene.chirp = null;
  scene.setPhase("return");
  return true;
}
