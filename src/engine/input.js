// Keyboard and mouse state, polled once per frame. "Pressed" flags last for
// the frame in which the key/button went down; call endFrame() after update.

const held = new Set();
const pressedThisFrame = new Set();
const CAPTURED_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"]);

/** Mouse position in frame-buffer coordinates plus button state. */
export const mouse = { x: 0, y: 0, down: false, pressed: false, released: false };

export const keys = {
  down: (code) => held.has(code),
  pressed: (code) => pressedThisFrame.has(code),
};

/**
 * @param target element receiving mouse events
 * @param toGameCoords maps a mouse event to frame-buffer coordinates
 * @param onGesture called on every key/mouse press (used to unlock audio)
 */
export function initInput(target, toGameCoords, onGesture) {
  window.addEventListener("keydown", (e) => {
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    onGesture();
    if (!held.has(e.code)) pressedThisFrame.add(e.code);
    held.add(e.code);
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
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
}

export function endFrame() {
  pressedThisFrame.clear();
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
