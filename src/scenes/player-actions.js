import { COLORS } from "../engine/screen.js";
import { sfx } from "../engine/audio.js";
import { isSpinner } from "../sim/teams.js";
import { PRESET_LABELS, positionName } from "../sim/field.js";

/**
 * Every player decision that can change the match, as a plain message: { type, ...details }. The scene's
 * input code turns keys, taps and clicks into these and hands them to act(), and nothing else changes the
 * match on the player's behalf, so a replay, a test or a network layer can carry the same messages.
 * (A delivery's "intent" is the bowling plan inside a "bowl" action, as sim/match.js uses the word.)
 * Held controls (stepping across, aftertouch, the aiming crosshair) are read where they're used, and what
 * they set travels in the action that commits them.
 *
 *   swing { t, shot, power }     defend { t, foot }       leave {}          run { end }
 *   bowl { plan }                release { error }        appeal {}         review { side }   accept {}
 *   chooseBowler { bowler }      delivery { delivery }    effort { effort } field { preset }
 *   newBall {}                   wicketSide { side }      placeFielder { idx, pos }
 *   simulate { overs }
 */
export function act(scene, action) {
  (scene.actions ??= []).push({ ...action, at: scene.now, ball: scene.inn.legal });
  const inn = scene.inn;
  switch (action.type) {
    case "swing":
      return scene.commitSwing(action.t, action.shot, action.power);
    case "defend":
      return scene.commitDefend(action.t, action.foot);
    case "leave":
      return scene.commitLeave();
    case "run":
      return scene.runCommand(scene.cur.play.live, action.end);
    case "bowl":
      scene.cur = scene.newBall(action.plan, 0);
      return scene.setPhase("runup");
    case "release":
      return scene.release(action.error);
    case "appeal":
      return scene.appeal();
    case "review":
      return scene.startReview(action.side);
    case "accept":
      return scene.endDecision();
    case "chooseBowler":
      return chooseBowler(scene, action.bowler);
    case "delivery":
      scene.deliveryType = action.delivery;
      return sfx.click();
    case "effort":
      scene.effort = action.effort;
      return sfx.click();
    case "field":
      inn.setPreset(action.preset);
      return scene.flash(`FIELD: ${PRESET_LABELS[inn.preset]}`);
    case "newBall":
      inn.takeNewBall();
      return scene.big("NEW BALL", COLORS.red, undefined, 1.2);
    case "wicketSide":
      (scene.bowlingSides ??= new Map()).set(inn.currentBowler, action.side);
      return sfx.click();
    case "placeFielder":
      inn.placements[action.idx] = { name: positionName(action.pos), pos: action.pos };
      inn.customField = true;
      return;
    case "simulate":
      return scene.simulate(action.overs);
    default:
      throw new Error(`Unknown player action: ${action.type}`);
  }
}

/** A new over from `bowler`: his first delivery and a crosshair (and field) to suit his style. */
function chooseBowler(scene, bowler) {
  const inn = scene.inn;
  scene.match.startOver(bowler);
  const skills = inn.bowler.p.bowl;
  scene.deliveryType = skills.repertoire[0];
  if (isSpinner(skills)) {
    scene.target = { line: 0.25, length: 5.4 };
    if (!inn.customField) inn.setPreset("spin");
  } else {
    scene.target = { line: 0.22, length: 6.4 };
    if (inn.preset === "spin" && !inn.customField) inn.setPreset("attacking");
  }
  scene.nextBall();
}
