import { selectedWicketSide, updateBowlingSide } from "./bowling-side.js";
import { keys, mouse } from "../engine/input.js";
import { EFFORTS } from "../sim/delivery.js";
import { PRESET_ORDER, clampFieldPosition } from "../sim/field.js";
import { projectWide, unprojectWide } from "../render/camera.js";
import * as input from "./match-input.js";
import { act } from "./player-actions.js";

/**
 * Between balls in the match scene: the keys there (sim an over, view the field), the bowling setup
 * (delivery, effort, field), choosing a bowler and dragging fielders about. Each takes the scene
 * (scenes/match.js), whose methods of the same names call these.
 */

/** Keys available between balls: simulate, or look at the field. */
export function betweenBalls(scene) {
  if (keys.pressed("KeyO")) {
    act(scene, { type: "simulate", overs: 1 });
    return true;
  }
  if (keys.pressed("KeyP")) {
    act(scene, { type: "simulate", overs: 5 });
    return true;
  }
  if (keys.pressed("KeyV")) {
    scene.setPhase("fieldEdit");
    scene.view = "wide";
    return true;
  }
  return false;
}

export function updateReady(scene) {
  if (scene.betweenBalls()) return;
  if (scene.phaseT > 0.25 && keys.pressed("Space")) scene.setPhase("runup");
}

export function updateSetup(scene) {
  if (scene.betweenBalls()) return;
  const skills = scene.inn.bowler.p.bowl;
  input.aimTarget(scene);
  updateBowlingSide(scene);
  for (let i = 0; i < skills.repertoire.length; i++) {
    if (keys.pressed(`Digit${i + 1}`)) act(scene, { type: "delivery", delivery: skills.repertoire[i] });
  }
  if (keys.pressed("KeyE")) act(scene, { type: "effort", effort: EFFORTS[(EFFORTS.indexOf(scene.effort) + 1) % 3] });
  if (keys.pressed("KeyF")) scene.cyclePreset();
  if (keys.pressed("KeyN") && scene.inn.newBallAvailable) act(scene, { type: "newBall" });
  if (keys.pressed("Space")) {
    const plan = {
      type: scene.deliveryType,
      line: scene.target.line,
      length: scene.target.length,
      effort: scene.effort,
      wicketSide: selectedWicketSide(scene),
    };
    act(scene, { type: "bowl", plan });
  }
}

/** The next field setting in the cycle. */
export function cyclePreset(scene) {
  const i = PRESET_ORDER.indexOf(scene.inn.preset);
  act(scene, { type: "field", preset: PRESET_ORDER[(i + 1) % PRESET_ORDER.length] });
}

export function updateChooseBowler(scene) {
  const inn = scene.inn;
  const count = inn.bowl.length;
  if (keys.pressed("ArrowUp")) scene.selBowler = (scene.selBowler + count - 1) % count;
  if (keys.pressed("ArrowDown")) scene.selBowler = (scene.selBowler + 1) % count;
  for (let i = 0; i < count; i++) {
    if (keys.pressed(`Digit${i + 1}`)) scene.selBowler = i;
  }
  if ((keys.pressed("Enter") || keys.pressed("Space")) && inn.canBowl(scene.selBowler))
    act(scene, { type: "chooseBowler", bowler: scene.selBowler });
}

export function updateFieldEdit(scene) {
  const inn = scene.inn;
  if (keys.pressed("KeyF") && scene.human === "bowl") scene.cyclePreset();
  if (scene.human === "bowl") {
    if (mouse.pressed) {
      // Grab the nearest fielder within 12px.
      let nearest = -1;
      let best = 12;
      inn.placements.forEach((place, i) => {
        const p = projectWide(place.pos.x, 0, place.pos.z);
        const dist = Math.hypot(p.x - mouse.x, p.y - 4 - mouse.y);
        if (dist < best) {
          best = dist;
          nearest = i;
        }
      });
      scene.dragIdx = nearest;
    }
    if (mouse.down && scene.dragIdx >= 0) {
      act(scene, { type: "placeFielder", idx: scene.dragIdx, pos: clampFieldPosition(unprojectWide(mouse.x, mouse.y)) });
    }
    if (mouse.released) scene.dragIdx = -1;
  }
  if (keys.pressed("KeyV") || keys.pressed("Enter") || keys.pressed("Escape")) {
    scene.view = scene.cam === "wide" ? "wide" : "close";
    scene.setPhase(scene.human === "bowl" ? "setup" : "ready");
  }
}
