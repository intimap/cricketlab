import { pressKey, releaseKey } from "./input.js";

/**
 * On-screen buttons for phones and tablets: each one presses a key the game
 * already reads, so the scenes don't know the difference. Only built on a
 * touch screen. The buttons shown follow what the player is doing (the
 * scene's `touchMode`: "menu", "entry" (typing a name), "bat" or "bowl").
 *
 * Buttons: [label, key code, modes they show in (all if omitted), hold?]
 */
const PAD = [
  ["▲", "ArrowUp", "up"],
  ["◀", "ArrowLeft", "left"],
  ["▶", "ArrowRight", "right"],
  ["▼", "ArrowDown", "down"],
];

// Small buttons along the top, for what the keyboard's letter keys do.
const TOP = [
  ["MENU", "Escape", ["bat", "bowl"]],
  ["CAMERA", "KeyC", ["bat", "bowl"]],
  ["END", "KeyB", ["bat", "bowl"]],
  ["FIELD", "KeyV", ["bat", "bowl"]],
  ["SIM", "KeyO", ["bat", "bowl"]],
  ["REVIEW", "KeyR", ["bat", "bowl"]],
  ["SOUND", "KeyM"],
];

const ACTIONS = {
  menu: [
    ["OK", "Enter", "big"],
    ["BACK", "Escape"],
  ],
  entry: [
    // Not a real key: the name entry opens the phone's own keyboard when it sees this.
    ["KEYBOARD", "OpenKeyboard"],
    ["DELETE", "ArrowLeft"],
    ["OK", "Enter", "big"],
  ],
  bat: [
    ["DRIVE", "KeyS"],
    ["LOFT", "KeyW"],
    ["CUT/PULL", "KeyQ"],
    ["DEFEND", "KeyA"],
    ["POWER", "ShiftLeft", "hold"],
    ["GO", "Space", "big"],
  ],
  bowl: [
    ["1", "Digit1", "small"],
    ["2", "Digit2", "small"],
    ["3", "Digit3", "small"],
    ["4", "Digit4", "small"],
    ["5", "Digit5", "small"],
    ["EFFORT", "KeyE"],
    ["FIELD SET", "KeyF"],
    ["APPEAL", "KeyH"],
    ["OK", "Enter"],
    ["GO", "Space", "big"],
  ],
};

// The game shrinks to leave a column either side for thumbs: menu keys and the d-pad on the left, actions on the right.
const SIDE = 116;
const CSS = `
.touch-device #game { margin: 0 calc(${SIDE}px + env(safe-area-inset-right)) 0 calc(${SIDE}px + env(safe-area-inset-left)); }
.tc { position: fixed; inset: 0; pointer-events: none; z-index: 10; font: 600 10px/1.1 ui-monospace, "SF Mono", Menlo, monospace;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.tc button { pointer-events: auto; touch-action: none; font: inherit; color: #f4ecd0; background: #12321f;
  border: 1px solid #b8862a; border-radius: 8px; padding: 0 2px; -webkit-tap-highlight-color: transparent; }
.tc button.on { background: #e8b931; color: #0f2a1c; }
.tc-left, .tc-act { position: absolute; top: max(6px, env(safe-area-inset-top)); bottom: max(6px, env(safe-area-inset-bottom));
  width: ${SIDE - 10}px; display: flex; flex-direction: column; justify-content: space-between; }
.tc-left { left: calc(5px + env(safe-area-inset-left)); }
.tc-act { right: calc(5px + env(safe-area-inset-right)); justify-content: flex-end; }
.tc-top, .tc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.tc-top button { height: 26px; font-size: 9px; }
.tc-pad { display: grid; grid-template: "a up b" 34px "left c right" 34px "d down e" 34px / 1fr 1fr 1fr; gap: 2px; }
.tc-pad button { font-size: 16px; }
.tc-grid button { height: 40px; }
.tc-grid button.big { grid-column: span 2; height: 54px; font-size: 15px; }
.tc-grid .row { grid-column: span 2; display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; }
.tc-grid .row button { height: 32px; font-size: 12px; }
.tc-rotate { position: fixed; inset: 0; z-index: 20; display: none; align-items: center; justify-content: center; text-align: center;
  background: #07140c; color: #e8b931; font: 600 18px/1.5 ui-monospace, Menlo, monospace; padding: 24px; }
@media (orientation: portrait) { .tc-rotate { display: flex; } }
`;

/** Build the buttons if this is a touch screen; returns update(mode), called each frame. */
export function initTouch() {
  if (!matchMedia("(pointer: coarse)").matches) return () => {};
  document.documentElement.classList.add("touch-device");
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "tc";
  const rotate = document.createElement("div");
  rotate.className = "tc-rotate";
  rotate.textContent = "TURN YOUR PHONE SIDEWAYS TO PLAY";
  document.body.append(root, rotate);
  // Long-presses and double-taps shouldn't select, zoom or open menus.
  for (const type of ["contextmenu", "gesturestart", "dblclick"]) document.addEventListener(type, (e) => e.preventDefault());

  const shown = [];
  const button = (parent, [label, code, extra], modes) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (extra === "big") b.classList.add("big");
    if (parent.className === "tc-pad") b.style.gridArea = extra;
    const down = (e) => {
      e.preventDefault();
      b.setPointerCapture?.(e.pointerId);
      b.classList.add("on");
      pressKey(code);
    };
    const up = (e) => {
      e.preventDefault();
      b.classList.remove("on");
      releaseKey(code);
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    parent.appendChild(b);
    shown.push({ el: b, modes });
    return b;
  };
  const box = (cls) => {
    const d = document.createElement("div");
    d.className = cls;
    root.appendChild(d);
    return d;
  };

  const left = box("tc-left");
  const top = document.createElement("div");
  top.className = "tc-top";
  const pad = document.createElement("div");
  pad.className = "tc-pad";
  left.append(top, pad);
  for (const t of TOP) button(top, t, t[2]);
  for (const p of PAD) button(pad, p, null);
  const act = document.createElement("div");
  act.className = "tc-grid";
  box("tc-act").appendChild(act);
  for (const [mode, list] of Object.entries(ACTIONS)) {
    // Small buttons (the numbered balls) share a row along the top.
    if (list.some((a) => a[2] === "small")) {
      const row = document.createElement("div");
      row.className = "row";
      act.appendChild(row);
      shown.push({ el: row, modes: [mode] });
      for (const a of list) if (a[2] === "small") button(row, a, [mode]);
    }
    for (const a of list) if (a[2] !== "small") button(act, a, [mode]);
  }

  // The game's column has narrowed: let it fit itself again.
  window.dispatchEvent(new Event("resize"));

  let current = null;
  return (mode) => {
    if (mode === current) return;
    current = mode;
    for (const s of shown) s.el.style.display = !s.modes || s.modes.includes(mode) ? "" : "none";
  };
}
