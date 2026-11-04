import { keys } from "../engine/input.js";
import * as beats from "./booth-beats.js";
import { updateLight } from "./match-light.js";

/**
 * Rain stopping play in the match scene (sim/rain.js has the rules): the covers come on, the light darkens
 * and rain falls, a panel says what it has cost, and Space carries on (or on to tomorrow). Each function
 * takes the scene (scenes/match.js).
 */

/** A stoppage from the over just finished (the sim's `applied.rain`), shown before the next ball. */
export function stopForRain(scene, rain) {
  scene.pendingRain = rain;
}

export function rainDue(scene) {
  return !!scene.pendingRain;
}

export function openRain(scene) {
  const rain = scene.pendingRain;
  scene.pendingRain = null;
  scene.rainReport = rainReport(scene, rain);
  scene.view = "close";
  scene.setPhase("rain");
  updateLight(scene);
  beats.onRain(scene, rain);
}

export function updateRain(scene) {
  if (scene.phaseT <= 1 || !(keys.pressed("Space") || keys.pressed("Enter"))) return;
  // Out of the rain before the next ball, so its light is the dry one.
  scene.setPhase("resume");
  scene.nextBall();
}

/** What the stoppage panel says (render/weather-report.js drawRainReport): { lines, prompt }. */
function rainReport(scene, rain) {
  const { match, inn } = scene;
  const lines = [];
  if (match.clock) {
    if (!rain.dayOver) lines.push(`${rain.lost} OVERS LOST`);
    else if (match.clock.finished) lines.push("NO MORE PLAY IN THE MATCH");
    else lines.push(`NO MORE PLAY TODAY (${rain.lost} OVERS LOST)`);
  } else {
    lines.push(`${rain.lost} OVERS LOST`);
    if (rain.target) lines.push(`REVISED TARGET: ${rain.target} OFF ${rain.overs} OVERS`);
    else lines.push(`NOW ${rain.overs} OVERS A SIDE`);
  }
  if (inn.isOver) lines.push("THAT'S THE END OF THE INNINGS");
  const prompt = rain.dayOver ? "SPACE FOR TOMORROW" : inn.isOver ? "SPACE TO CONTINUE" : "SPACE WHEN THE RAIN STOPS";
  return { lines, prompt };
}
