import { boothCall } from "../sim/commentators.js";
import { fitsBox } from "../render/booth.js";
import { fitsHud } from "../render/call-line.js";
import { createMatchMemory, update } from "../sim/match-memory.js";
import { memoryInput } from "../sim/memory-input.js";
import { timeNow } from "./match-light.js";

/**
 * The match memory (sim/match-memory.js), once per completed ball: what it remembers is kept on the match, and
 * the moment it picks goes to the commentary (unless `quiet`: a simulated ball, remembered but not said).
 */
export function rememberBall(scene, { rec }, { quiet = false } = {}) {
  if (scene.nets) return [];
  const match = scene.match;
  const { ball, state } = memoryInput(rec, scene.inn, match, { lostReview: !!scene.cur?.lostReview, light: timeNow(scene) });
  const { memory, moments } = update(match.memory ?? createMatchMemory(), ball, state);
  match.memory = memory;
  if (!quiet) match.comm.onMoments(moments);
  return moments;
}

/** Keep narration wiring out of the match phase controller. */
export function callFromBooth(scene, done) {
  const { rec, applied } = done;
  rememberBall(scene, done);
  const inn = scene.inn;
  const names = {
    batter: inn.bat[rec.wicket ? rec.wicket.batter : rec.striker].p.short,
    bowler: inn.bowl[rec.bowler].p.short,
    fielder: rec.dropped || rec.wicket?.fielder,
  };
  // Presentation only: never pass the match's RNG into line selection.
  const rng = {
    pick: (list) => list[Math.floor(Math.random() * list.length)],
    chance: (p) => Math.random() < p,
    random: Math.random,
  };
  return boothCall(rec, rec.call ?? "", names, rng, scene.match.comm, fitsBox, {
    inn,
    applied,
    fitsCall: fitsHud,
    match: scene.match,
    commentary: scene.match.comm,
    narrative: scene.match.comm.narrative,
    light: scene.cfg.light,
    beforePressure: scene.cur?.pressureBefore,
  });
}
