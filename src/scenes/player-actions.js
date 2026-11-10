import { COLORS } from "../engine/screen.js";
import { sfx } from "../engine/audio.js";
import { isSpinner } from "../sim/teams.js";
import { PRESET_LABELS, positionName } from "../sim/field.js";
import { pickFieldPreset } from "../sim/ai.js";
import { takeAdvice } from "./bowling-advice.js";

/**
 * Every player decision that can change the match, as a plain message: { type, ...details }. The scene's
 * input code turns keys, taps and clicks into these and hands them to act(), and nothing else changes the
 * match on the player's behalf, so a replay, a test or a network layer can carry the same messages.
 * (A delivery's "intent" is the bowling plan inside a "bowl" action, as sim/match.js uses the word.)
 * Held controls (the batter's feet, aftertouch, the aiming crosshair) are read where they're used, and what
 * they set travels in the action that commits them (a shot's `feet`: sim/feet.js).
 *
 *   swing { t, shot, power, feet, variant, lifted, aim }   defend { t, foot, feet, aim }   leave { feet }
 *   (aim: STICK PLUS's follow-through, -1..1, + his off side; sim/shot-direction.js)
 *   run { end } (the way he's already going: keep running)   dive {}
 *   bowl { plan }                beat { index, error }    release { error, rhythm }        appeal {}         review { side }   accept {}
 *   chooseBowler { bowler }      delivery { delivery }    effort { effort } field { preset }
 *   newBall {}                   wicketSide { side }      placeFielder { idx, pos }
 *   simulate { overs }           catchPress {}            throwCall { end }
 *   declare {}                   followOn { enforce }     (a Test: scenes/match-test.js)
 *   takeAdvice { plan }          (the keeper's suggested ball: scenes/bowling-advice.js)
 */
export function act(scene, action) {
  (scene.actions ??= []).push({ ...action, at: scene.now, ball: scene.inn.legal });
  const inn = scene.inn;
  switch (action.type) {
    case "swing":
      return scene.commitSwing(action.t, action.shot, action.power, action.feet, action.variant, action.lifted, action.aim);
    case "defend":
      return scene.commitDefend(action.t, action.foot, action.feet, action.aim);
    case "leave":
      return scene.commitLeave(action.feet);
    case "run":
      return scene.runCommand(scene.cur.play.live, action.end);
    case "dive":
      if (scene.cur.play.live.dive()) scene.flash("DIVE!", COLORS.gold);
      return;
    case "bowl":
      scene.cur = scene.newBall(action.plan, 0);
      return scene.setPhase("runup");
    case "takeAdvice":
      takeAdvice(scene, action.plan);
      return scene.flash("THE KEEPER'S BALL", "#9fd0ff");
    case "beat":
      scene.cur.beats[action.index].error = action.error;
      return sfx.click();
    case "release":
      return scene.release(action.error, action.rhythm);
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
    case "catchPress":
      scene.cur.play.live.catchPressAt = scene.cur.play.live.t;
      return;
    case "throwCall":
      scene.cur.play.live.calledEnd = action.end;
      return scene.flash(action.end === 0 ? "THROW: KEEPER'S END" : "THROW: BOWLER'S END");
    case "declare":
      return scene.declare();
    case "followOn":
      return scene.leaveInnings(action.enforce);
    default:
      throw new Error(`Unknown player action: ${action.type}`);
  }
}

/**
 * A new over from `bowler`: his first delivery and a crosshair to suit his style, and the field the captain
 * would set for him (unless the player has placed his own).
 */
function chooseBowler(scene, bowler) {
  const inn = scene.inn;
  scene.match.startOver(bowler);
  const skills = inn.bowler.p.bowl;
  scene.deliveryType = skills.repertoire[0];
  scene.target = isSpinner(skills) ? { line: 0.25, length: 5.4 } : { line: 0.22, length: 6.4 };
  if (!inn.customField) inn.setPreset(pickFieldPreset(inn));
  scene.nextBall();
}
