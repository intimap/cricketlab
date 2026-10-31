import { keys, mouse } from "../engine/input.js";

export const ON_FIELD_TIME = 0.9;
export const TRACKING_TIME = 3.4;
export const REVIEW_END = 6.4;

/** Presentation only: the rules still resolve the review in match-decisions. */
export function reviewResult(cur) {
  const verdict = cur.tracking.verdict;
  const out = verdict === "out" ? true : verdict === "notOut" ? false : cur.onField;
  return { out, changed: out !== cur.onField };
}

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
