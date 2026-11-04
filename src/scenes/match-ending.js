import { sfx } from "../engine/audio.js";
import { load, save } from "../engine/storage.js";
import { boardFor } from "../sim/leaderboard.js";
import * as beats from "./booth-beats.js";
import { followOnChoice, testBreakEnding } from "./match-test.js";

/**
 * The end of an innings in the match scene: the end screen's words, the box's wrap-up, a Classic Match
 * won, the crowd. Each takes the scene (scenes/match.js), whose methods of the same names call these.
 */

export function endInnings(scene) {
  scene.setPhase("inningsEnd");
  scene.followOn = followOnChoice(scene);
  beats.onInningsEnd(scene);
  const ending = scene.ending;
  if (ending.good === true && scene.cfg.format === "classic") {
    save("classicsWon", { ...load("classicsWon", {}), [scene.cfg.classic]: true });
  }
  if (ending.good === true) sfx.cheer(1);
  else if (ending.good === false) sfx.groan();
}

/** How the innings (or match) ended, for the end screen: { title, sub, good?, next, prompt, followOn }. */
export function endingOf(scene) {
  const match = scene.match;
  const inn = scene.inn;
  if (match.hasNextInnings) {
    if (match.clock) return testBreakEnding(scene);
    const sub = `${inn.bowlTeam.name.toUpperCase()} NEED ${inn.runs + 1} TO WIN`;
    return { title: "INNINGS BREAK", sub, next: true, prompt: "ENTER = START THE CHASE" };
  }
  const result = match.result;
  if (!result) return { title: inn.wkts >= 10 ? "ALL OUT" : "INNINGS OVER", sub: `${inn.runs}/${inn.wkts}` };
  const good = result.winner === match.humanTeam ? true : result.winner === null ? null : false;
  if (scene.cfg.format === "classic") {
    return { title: good ? "CHALLENGE COMPLETE!" : "CHALLENGE FAILED", sub: result.text.toUpperCase(), good };
  }
  const level = result.draw ? "HONOURS EVEN" : "WHAT A FINISH!";
  return {
    title: result.text.toUpperCase(),
    sub: good ? "WELL PLAYED!" : good === null ? level : "BETTER LUCK NEXT TIME",
    good,
  };
}

/** Does this game's result go on a high-score table (a finished match or Classic Match)? */
export function hasScoreboard(scene) {
  return !scene.match.hasNextInnings && !!scene.match.result && !!boardFor(scene.cfg);
}
