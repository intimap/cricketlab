import { keys, mouse } from "../engine/input.js";
import { BOWLING_SIDE_CONTROL } from "../render/bowling-setup.js";
import { act } from "./player-actions.js";

export function selectedWicketSide(scene) {
  return scene.bowlingSides?.get(scene.inn.currentBowler) ?? "over";
}

/** A run-up keeps its original selection even if a button is pressed after it starts. */
export function activeWicketSide(scene) {
  return scene.cur?.intent.wicketSide ?? selectedWicketSide(scene);
}

export function updateBowlingSide(scene) {
  const { x, y, w, h } = BOWLING_SIDE_CONTROL;
  const clicked = mouse.pressed && mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
  if (scene.phase !== "setup" || (!keys.pressed("KeyT") && !clicked)) return;
  act(scene, { type: "wicketSide", side: selectedWicketSide(scene) === "over" ? "around" : "over" });
}
