// Keyboard and mouse state, polled once per frame. "Pressed" flags last for
// the frame in which the key/button went down; call endFrame() after update.
// On-screen touch buttons press the same keys (pressKey/releaseKey), and a finger on the game acts as the mouse.

const held = new Set();
const pressedThisFrame = new Set();
/** Characters typed this frame (outside a text field), in order. */
const typedThisFrame = [];
/** Called the moment a key goes down, inside the event (for things only a user gesture may do). */
const keyListeners = new Set();
const CAPTURED_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"]);

/** Mouse position in frame-buffer coordinates plus button state. */
export const mouse = { x: 0, y: 0, down: false, pressed: false, released: false };

export const keys = {
  down: (code) => held.has(code),
  pressed: (code) => pressedThisFrame.has(code),
  typed: () => typedThisFrame,
};

/** Listen for keys going down, synchronously; returns a function that stops listening. */
export function onKeyDown(fn) {
  keyListeners.add(fn);
  return () => keyListeners.delete(fn);
}

/**
 * @param target element receiving mouse events
 * @param toGameCoords maps a mouse event to frame-buffer coordinates
 * @param onGesture called on every key/mouse press (used to unlock audio)
 */
export function initInput(target, toGameCoords, onGesture) {
  gesture = onGesture;
  window.addEventListener("keydown", (e) => {
    // A focused text field (name entry) types its own characters, Space included.
    const typing = e.target instanceof HTMLInputElement;
    if (CAPTURED_KEYS.has(e.code) && !(typing && e.code === "Space")) e.preventDefault();
    if (!typing && e.key.length === 1 && !e.ctrlKey && !e.metaKey) typedThisFrame.push(e.key);
    pressKey(e.code);
  });
  window.addEventListener("keyup", (e) => releaseKey(e.code));
  window.addEventListener("blur", () => held.clear());
  target.addEventListener("mousemove", (e) => {
    const p = toGameCoords(e);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  target.addEventListener("mousedown", (e) => {
    const p = toGameCoords(e);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.pressed = true;
    onGesture();
  });
  window.addEventListener("mouseup", () => {
    if (mouse.down) mouse.released = true;
    mouse.down = false;
  });
  // One finger on the game is the mouse (dragging fielders); no scrolling or zooming the page.
  const touchAt = (e) => {
    e.preventDefault();
    const p = toGameCoords(e.changedTouches[0]);
    mouse.x = p.x;
    mouse.y = p.y;
  };
  target.addEventListener(
    "touchstart",
    (e) => {
      touchAt(e);
      mouse.down = true;
      mouse.pressed = true;
      onGesture();
    },
    { passive: false },
  );
  target.addEventListener("touchmove", touchAt, { passive: false });
  const touchEnd = (e) => {
    touchAt(e);
    if (mouse.down) mouse.released = true;
    mouse.down = false;
  };
  target.addEventListener("touchend", touchEnd, { passive: false });
  target.addEventListener("touchcancel", touchEnd, { passive: false });
}

let gesture = () => {};

/** A key goes down - from the keyboard or an on-screen button. */
export function pressKey(code) {
  gesture();
  if (!held.has(code)) pressedThisFrame.add(code);
  held.add(code);
  for (const fn of keyListeners) fn(code);
}

export function releaseKey(code) {
  held.delete(code);
}

export function endFrame() {
  pressedThisFrame.clear();
  typedThisFrame.length = 0;
  mouse.pressed = false;
  mouse.released = false;
}

/** Compass bearing in degrees of the held arrow keys (0 = up), or null if none. */
export function arrowBearing() {
  const dx = (held.has("ArrowRight") ? 1 : 0) - (held.has("ArrowLeft") ? 1 : 0);
  const dy = (held.has("ArrowUp") ? 1 : 0) - (held.has("ArrowDown") ? 1 : 0);
  if (!dx && !dy) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}
