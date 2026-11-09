import { load, save } from "../engine/storage.js";

/**
 * How much the commentators say, from the pause menu: FULL, QUIET (the notable moments, the finishes and
 * the day's events) or CALLS ONLY (just the caller on the HUD line). Remembered in this browser.
 */
export const COMMENTARY_LEVELS = ["FULL", "QUIET", "CALLS ONLY"];
/** In QUIET, the box only speaks to remarks this important (sim/booth-context.js priorities) and events. */
export const QUIET_FROM = 65;

let level = COMMENTARY_LEVELS.includes(load("commentary", "FULL")) ? load("commentary", "FULL") : "FULL";

export const commentaryLevel = () => level;

/** Move on to the next level and remember it. */
export function cycleCommentary() {
  level = COMMENTARY_LEVELS[(COMMENTARY_LEVELS.indexOf(level) + 1) % COMMENTARY_LEVELS.length];
  save("commentary", level);
  return level;
}

/** Whether the box says this call at the current level: { event } calls are the day's events, kept in QUIET. */
export function boxAllows(call) {
  if (level === "FULL") return true;
  if (level === "CALLS ONLY") return false;
  return !!call.event || (call.priority ?? 0) >= QUIET_FROM;
}
