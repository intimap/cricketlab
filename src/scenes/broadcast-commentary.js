import { boothCall } from "../sim/commentators.js";
import { fitsBox } from "../render/booth.js";
import { fitsHud } from "../render/call-line.js";

/** Keep narration wiring out of the match phase controller. */
export function callFromBooth(scene, done) {
  const { rec, applied } = done;
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
    commentary: scene.match.comm,
    narrative: scene.match.comm.narrative,
    light: scene.cfg.light,
    beforePressure: scene.cur?.pressureBefore,
  });
}
