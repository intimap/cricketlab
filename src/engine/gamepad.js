import { pressKey, releaseKey } from "./input.js";
import { setStick, clearStick, setStickPresent } from "./analog.js";

/**
 * The browser's gamepads (and arcade sticks that show up as one), read once a frame. Like the touch
 * buttons, they press keys the game already reads, so the scenes don't know the difference. The left stick
 * and d-pad are the arrows; each button presses whatever keys the current screen gives it (a binding:
 * button index → key code or codes, standard layout: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 back,
 * 9 start). A button changing meaning while it's held lets go of the old keys first. The right stick, where a
 * pad has one, is the second analog stick (engine/analog.js).
 */

/** How far the stick must lean to count as pushed. */
const LEAN = 0.5;
/** The right stick's rest: less than this from the middle is the middle. */
const REST = 0.15;
const rested = (v) => (Math.abs(v) < REST ? 0 : v);
const DPAD = { 12: "ArrowUp", 13: "ArrowDown", 14: "ArrowLeft", 15: "ArrowRight" };

/** Menus: A to choose, B or back to go back, start to choose. */
export const MENU_PAD = Object.freeze({ 0: "Enter", 1: "Escape", 8: "Escape", 9: "Enter" });

/** What each held control is pressing now: "ArrowUp" or "b3" → key codes. */
const holding = new Map();

/** Read the pads and press or let go of keys to match, with `binding` for the buttons. */
export function pollGamepads(binding = MENU_PAD) {
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  const want = new Map();
  let right = null;
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    const [x = 0, y = 0] = pad.axes;
    if (pad.axes.length >= 4) {
      const [rx, ry] = [rested(pad.axes[2]), rested(pad.axes[3])];
      if (!right || Math.hypot(rx, ry) > Math.hypot(right.x, right.y)) right = { x: rx, y: ry };
    }
    const dirs = { ArrowUp: y < -LEAN, ArrowDown: y > LEAN, ArrowLeft: x < -LEAN, ArrowRight: x > LEAN };
    for (const [i, code] of Object.entries(DPAD)) if (pad.buttons[i]?.pressed) dirs[code] = true;
    for (const [code, on] of Object.entries(dirs)) if (on) want.set(code, [code]);
    pad.buttons.forEach((button, i) => {
      const bound = binding[i];
      if (DPAD[i] || !button?.pressed || !bound) return;
      want.set(`b${i}`, [].concat(bound));
    });
  }
  setStickPresent("pad", !!right);
  if (right) setStick("pad", right.x, right.y);
  else clearStick("pad");
  for (const [id, codes] of holding) {
    const next = want.get(id);
    if (next && next.join() === codes.join()) continue;
    for (const code of codes) releaseKey(code);
    holding.delete(id);
  }
  for (const [id, codes] of want) {
    if (holding.has(id)) continue;
    for (const code of codes) pressKey(code);
    holding.set(id, codes);
  }
}
