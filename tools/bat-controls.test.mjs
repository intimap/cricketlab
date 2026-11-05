import test from "node:test";
import assert from "node:assert/strict";
import { pressKey, releaseKey, keys, endFrame } from "../src/engine/input.js";
import { pollGamepads, MENU_PAD } from "../src/engine/gamepad.js";
import { strokeFor } from "../src/sim/strokes.js";
const controlShot = (button, feet) => strokeFor(button, feet);
import { PLAYER_ACROSS } from "../src/sim/feet.js";
import { updateFeet, updateButtons, feetSoFar } from "../src/scenes/bat-controls.js";
import { BAT_PAD, bowlPad, matchPad } from "../src/scenes/pad-bindings.js";

/** Just enough of a match scene for the batting controls: a ball on its way, the camera behind him. */
function fakeScene({ closeEnd = "bat", turn = 1 } = {}) {
  const actions = [];
  const scene = {
    human: "bat",
    view: "close",
    closeEnd,
    screenTurn: turn,
    now: 0,
    inn: { legal: 0 },
    cur: { delivery: { samples: [] }, t: 0 },
    clock: () => scene.cur.t,
    flash: () => {},
    arrival: () => 0.6,
    // As the real scene does, a committed shot ends the controls for the ball.
    commitSwing: (t, shot, power, feet) => actions.push((scene.cur.shot = { type: "swing", t, shot, power, feet })),
    commitDefend: (t, foot, feet) => actions.push((scene.cur.shot = { type: "defend", t, foot, feet })),
    commitLeave: (feet) => actions.push((scene.cur.shot = { type: "leave", feet })),
  };
  scene.commits = actions;
  return scene;
}

/** Run the controls for `frames` frames of `dt` ball time. */
function run(scene, frames = 1, dt = 0.02) {
  for (let i = 0; i < frames; i++) {
    updateFeet(scene);
    updateButtons(scene);
    endFrame();
    scene.cur.t += dt;
    scene.now += dt;
  }
}

const tap = (code) => {
  pressKey(code);
  return () => releaseKey(code);
};

test("buttons and feet make the shot: attack drives forward, pulls back; improvise sweeps, reverse-sweeps across, ramps back", () => {
  assert.deepEqual(controlShot("defend", { stride: "back" }), { type: "defend", foot: "back" });
  assert.deepEqual(controlShot("defend", { stride: "crease" }), { type: "defend", foot: "front" });
  assert.equal(controlShot("attack", { stride: "forward" }).type, "drive");
  assert.equal(controlShot("attack", { stride: "down" }).type, "drive");
  assert.equal(controlShot("attack", { stride: "back" }).type, "cutpull");
  assert.deepEqual(controlShot("loft", { stride: "back" }), { type: "cutpull", variant: "aerial" });
  assert.equal(controlShot("improvise", { stride: "forward", across: 0 }).type, "sweep");
  assert.equal(controlShot("improvise", { stride: "forward", across: 0.2 }).type, "reverseSweep");
  assert.equal(controlShot("improvise", { stride: "back", across: 0.2 }).type, "ramp");
});

test("a push forward sets the stride going from then; the shot carries the feet", () => {
  const scene = fakeScene();
  run(scene, 5);
  const up = tap("ArrowUp");
  run(scene, 3);
  up();
  run(scene, 2);
  const s = tap("KeyS");
  run(scene, 1);
  s();
  const [swing] = scene.commits;
  assert.equal(swing.shot, "drive");
  assert.equal(swing.feet.stride, "forward");
  assert.ok(Math.abs(swing.feet.from - 0.1) < 1e-9, `${swing.feet.from}`);
});

test("up is away from the camera: from behind the bowler it takes him back", () => {
  const scene = fakeScene({ closeEnd: "bowl", turn: -1 });
  const up = tap("ArrowUp");
  run(scene, 2);
  up();
  assert.equal(feetSoFar(scene.cur).stride, "back");
});

test("held through the run-up, the push is the trigger: he goes as the ball is let go", () => {
  const scene = fakeScene();
  scene.cur.delivery = null;
  scene.cur.t = -0.4;
  const down = tap("ArrowDown");
  run(scene, 10);
  assert.equal(feetSoFar(scene.cur).from, null);
  scene.cur.delivery = { samples: [] };
  scene.cur.t = 0;
  run(scene, 1);
  down();
  assert.equal(feetSoFar(scene.cur).stride, "back");
  assert.equal(feetSoFar(scene.cur).from, 0);
});

test("two quick pushes forward take him down the pitch; a slow second one doesn't", () => {
  const quick = fakeScene();
  let up = tap("ArrowUp");
  run(quick, 2);
  up();
  run(quick, 3);
  up = tap("ArrowUp");
  run(quick, 1);
  up();
  assert.equal(feetSoFar(quick.cur).stride, "down");
  const slow = fakeScene();
  up = tap("ArrowUp");
  run(slow, 2);
  up();
  run(slow, 20);
  up = tap("ArrowUp");
  run(slow, 1);
  up();
  assert.equal(feetSoFar(slow.cur).stride, "forward");
});

test("left and right take him across while held, as far as the crease allows, and he stays there", () => {
  const scene = fakeScene();
  const right = tap("ArrowRight");
  run(scene, 5);
  const part = feetSoFar(scene.cur).across;
  assert.ok(part > 0.1 && part < PLAYER_ACROSS.off, `${part}`);
  run(scene, 30);
  right();
  run(scene, 10);
  assert.equal(feetSoFar(scene.cur).across, PLAYER_ACROSS.off);
  assert.equal(feetSoFar(scene.cur).stride, "crease");
});

test("Shift tapped arms power for the ball (tap again to disarm); held, it's power for that shot", () => {
  const scene = fakeScene();
  let shift = tap("ShiftLeft");
  run(scene, 2);
  shift();
  run(scene, 1);
  assert.equal(scene.cur.powerArmed, true);
  shift = tap("ShiftLeft");
  run(scene, 2);
  shift();
  run(scene, 1);
  assert.equal(scene.cur.powerArmed, false);
  shift = tap("ShiftLeft");
  run(scene, 20);
  const s = tap("KeyS");
  run(scene, 1);
  s();
  shift();
  assert.equal(scene.commits[0].power, true);
  assert.notEqual(scene.cur.powerArmed, true);
});

test("no button by the time the ball's there: he leaves it, with his feet", () => {
  const scene = fakeScene();
  const down = tap("ArrowDown");
  run(scene, 2);
  down();
  run(scene, 40);
  assert.equal(scene.commits.length, 1);
  assert.equal(scene.commits[0].type, "leave");
  assert.equal(scene.commits[0].feet.stride, "back");
});

test("a gamepad presses the keys its screen gives it, and lets go of them", () => {
  const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
  Object.defineProperty(globalThis, "navigator", { value: { getGamepads: () => [pad] }, configurable: true });
  pad.axes = [0, -0.9];
  pad.buttons[0].pressed = true;
  pollGamepads(BAT_PAD);
  assert.ok(keys.down("ArrowUp") && keys.down("KeyS") && keys.down("Space"));
  // The screen changes under a held button: the old keys go, the new ones press.
  pollGamepads(MENU_PAD);
  assert.ok(!keys.down("KeyS") && keys.down("Enter"));
  pad.axes = [0, 0];
  pad.buttons[0].pressed = false;
  pollGamepads(MENU_PAD);
  assert.ok(!keys.down("ArrowUp") && !keys.down("Enter"));
  endFrame();
});

test("bowling, RB steps to the next delivery; the pause menu takes start as carry on", () => {
  const scene = {
    phase: "setup",
    human: "bowl",
    deliveryType: "yorker",
    inn: { bowler: { p: { bowl: { repertoire: ["stock", "yorker", "bouncer"] } } } },
  };
  assert.equal(bowlPad(scene)[5], "Digit3");
  scene.deliveryType = "bouncer";
  assert.equal(bowlPad(scene)[5], "Digit1");
  assert.equal(matchPad({ ...scene, phase: "pause" })[9], "Escape");
  assert.equal(matchPad({ ...scene, human: "bat" }), BAT_PAD);
});
