import { load, save } from "../engine/storage.js";
import { lookFor, DEFAULT_EFFECTS } from "../render/lighting.js";

/**
 * The lighting effects this machine runs (render/lighting.js EFFECTS). "auto", the default, starts a match
 * on full and, if the first couple of seconds draw slowly, steps down to simple for good on this machine.
 */

/** Frames left out while the match settles, then frames timed before AUTO decides. */
const SETTLE = 30;
const SAMPLE = 120;
/** A median draw (ms) slower than this steps AUTO down: most of a 60 fps frame (16.7 ms) gone on drawing. */
const SLOW_MS = 9;

export function effectsSetting() {
  return load("effects", DEFAULT_EFFECTS);
}

/** The look a new match starts with for its time of day (`light`, from render/light.js). */
export function startLook(light) {
  const setting = effectsSetting();
  return lookFor(light, setting === "auto" ? load("effectsAuto", "full") : setting);
}

/** Draw the match (`draw`), timing it while AUTO is still deciding. */
export function drawTimed(scene, draw) {
  if (scene.effectsChecked || effectsSetting() !== "auto" || !scene.light.fx.shadows) return draw();
  const start = performance.now();
  draw();
  const times = (scene.drawTimes ??= []);
  times.push(performance.now() - start);
  if (times.length < SETTLE + SAMPLE) return;
  scene.effectsChecked = true;
  const timed = times.slice(SETTLE).sort((a, b) => a - b);
  if (timed[timed.length >> 1] <= SLOW_MS) return;
  save("effectsAuto", "simple");
  scene.light = lookFor(scene.baseLight, "simple");
  scene.buildGround();
}
