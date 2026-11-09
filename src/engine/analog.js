/**
 * A second analog stick, for a scene that wants how far as well as which way: a gamepad's right stick
 * (engine/gamepad.js) or the touch screen's second stick (engine/touch.js). Unlike the arrows it isn't
 * turned into keys. x is right and y is down, each -1..1; the source pushed furthest wins.
 */

const sources = new Map();
const present = new Set();

/** A source's stick, as it is now. */
export function setStick(source, x, y) {
  sources.set(source, { x, y });
}

/** A source let go (or gone). */
export function clearStick(source) {
  sources.delete(source);
}

/** Whether a source with a second stick is there (a pad with a right stick, the touch stick). */
export function setStickPresent(source, on) {
  if (on) present.add(source);
  else present.delete(source);
}

export const hasSecondStick = () => present.size > 0;

/** The second stick now: { x, y }, centred when nothing's pushing it. */
export function secondStick() {
  let best = { x: 0, y: 0 };
  for (const s of sources.values()) if (Math.hypot(s.x, s.y) > Math.hypot(best.x, best.y)) best = s;
  return best;
}
