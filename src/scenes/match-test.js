import { keys } from "../engine/input.js";
import { COLORS } from "../engine/screen.js";
import { GROUNDS, DEFAULT_GROUND } from "../render/grounds.js";
import { weatherEffects } from "../sim/weather.js";
import { declareAdvised, followOnOption, aiEnforces, leadOf, testStatus } from "../sim/test-match.js";
import * as beats from "./booth-beats.js";
import { act } from "./player-actions.js";
import { updateLight } from "./match-light.js";

/**
 * Test cricket and the weather in the match scene: the weather report before play (and each morning of a
 * Test), the lunch, tea and stumps banners, the dressing room's call to declare, and the follow-on choice.
 * The rules are in sim/test-match.js; each function here takes the scene (scenes/match.js).
 */

/** Seconds the player has to press C again to confirm a declaration. */
const DECLARE_CONFIRM = 2.5;

/** Is a weather report due before the next ball (the start of the match, or a new day of a Test)? */
export function forecastDue(scene) {
  const match = scene.match;
  return !!match.weather && !scene.nets && match.reportedDay !== (match.clock?.day ?? 1);
}

export function openForecast(scene) {
  const match = scene.match;
  match.reportedDay = match.clock?.day ?? 1;
  scene.report = forecastReport(scene);
  scene.view = "close";
  scene.setPhase("forecast");
  updateLight(scene);
  beats.onForecast(scene);
}

export function updateForecast(scene) {
  if (scene.phaseT <= 0.5 || !(keys.pressed("Space") || keys.pressed("Enter"))) return;
  // Off the report before the next ball, so a delayed start's rain stops falling.
  scene.setPhase("resume");
  scene.nextBall();
}

/** What the weather report shows (render/weather-report.js). */
function forecastReport(scene) {
  const { match, inn } = scene;
  const w = match.weather;
  const clock = match.clock;
  const ground = (GROUNDS[scene.cfg.ground] ?? GROUNDS[DEFAULT_GROUND]).name;
  let rain = "";
  if (clock?.lostToday) rain = `RAIN DELAYS THE START: ${clock.lostToday} OVERS LOST TODAY`;
  else if (match.oversLost) rain = `RAIN BEFORE THE START: ${match.overs} OVERS A SIDE (${match.oversLost} LOST)`;
  const status =
    clock && inn.legal + match.innings.length > 1 ? `${inn.batTeam.abbr} ${inn.runs}/${inn.wkts}  ${testStatus(match)}` : "";
  return {
    title: clock ? `DAY ${clock.day}: WEATHER REPORT` : "WEATHER REPORT",
    ground,
    id: w.id,
    name: w.name,
    sky: w.sky,
    temp: w.temp,
    effects: weatherEffects(w),
    rain,
    status,
  };
}

/** The score bar's lower line in a Test (sim/test-match.js testStatus), else null for the usual chase line. */
export function statusLine(scene) {
  return scene.match.clock ? testStatus(scene.match) : null;
}

/** An over has ended: in a Test the interval it brings (lunch, tea, stumps) takes the end-of-over banner's place. */
export function overEndBanner(scene, applied) {
  const brk = applied.testBreak;
  if (!brk) return scene.big("END OF OVER", COLORS.cream, "CHANGE OF ENDS", 2.3);
  const { inn, match } = scene;
  // Stumps has already turned the clock to tomorrow.
  const day = brk === "stumps" ? match.clock.day - 1 : match.clock.day;
  const score = `${inn.batTeam.abbr} ${inn.runs}/${inn.wkts}`;
  scene.big(brk === "stumps" ? `STUMPS: DAY ${day}` : brk.toUpperCase(), COLORS.gold, score, 3);
  beats.onBreak(scene, brk, day);
}

/** Batting in a Test: is it time to declare, by the dressing room's reckoning? (Said once by the box.) */
export function declareAdvice(scene) {
  const match = scene.match;
  if (!match.clock || scene.human !== "bat" || !declareAdvised(match)) return false;
  if (scene.declareSaid !== match.inn) {
    scene.declareSaid = match.inn;
    beats.onDeclareAdvice(scene);
  }
  return true;
}

/** Batting in a Test, between balls: C, pressed twice, declares. True if the key was taken. */
export function updateDeclareKey(scene) {
  if (!scene.match.clock || scene.human !== "bat" || !keys.pressed("KeyC")) return false;
  if (scene.declareArmed !== undefined && scene.now - scene.declareArmed < DECLARE_CONFIRM) {
    scene.declareArmed = undefined;
    act(scene, { type: "declare" });
  } else {
    scene.declareArmed = scene.now;
    scene.flash("PRESS C AGAIN TO DECLARE", COLORS.gold);
  }
  return true;
}

/** The player's side declares (the "declare" action). */
export function declare(scene) {
  const inn = scene.inn;
  scene.match.declare();
  scene.big("DECLARED", COLORS.gold, `${inn.batTeam.abbr} ${inn.runs}/${inn.wkts}`, 2.4);
  scene.endInnings();
}

/** Simulating: stop at the end of an over when the dressing room first says it's time to declare. */
export function simShouldStop(scene, applied) {
  if (!applied.overEnded) return false;
  const fresh = scene.declareSaid !== scene.inn;
  return declareAdvice(scene) && fresh;
}

/** The follow-on, once the first two innings are done: { lead, mine (the player's call), advice, enforce }, or null. */
export function followOnChoice(scene) {
  const match = scene.match;
  const option = match.clock && followOnOption(match);
  if (!option) return null;
  const advice = aiEnforces(match, option);
  return { lead: option.lead, mine: option.captain === match.humanTeam, advice, enforce: advice };
}

/** The end screen with the follow-on to decide: arrows choose, Enter goes. True while it has the keys. */
export function updateFollowOn(scene) {
  const choice = scene.followOn;
  if (!choice?.mine) return false;
  if (keys.pressed("ArrowLeft") || keys.pressed("ArrowRight") || keys.pressed("ArrowUp") || keys.pressed("ArrowDown")) {
    choice.enforce = !choice.enforce;
  }
  if (scene.phaseT > 0.8 && (keys.pressed("Enter") || keys.pressed("Space")))
    act(scene, { type: "followOn", enforce: choice.enforce });
  return true;
}

/** A Test's end screen between innings: { title, sub, next, prompt }. */
export function testBreakEnding(scene) {
  const { match, inn } = scene;
  const n = match.innings.length;
  const title = inn.declared ? "DECLARED" : inn.wkts >= 10 ? "ALL OUT" : "INNINGS BREAK";
  const other = inn.bowlTeam.name.toUpperCase();
  if (n === 1) return { title, sub: `${other} REPLY TO ${inn.runs}`, next: true, prompt: "ENTER = NEXT INNINGS" };
  if (n === 3) {
    const need = Math.max(1, -leadOf(match, inn.bowlTeam) + 1);
    return { title, sub: `${other} NEED ${need} TO WIN`, next: true, prompt: "ENTER = START THE CHASE" };
  }
  const first = match.innings[0].batTeam;
  const lead = leadOf(match, first);
  const choice = scene.followOn;
  const leads = lead >= 0 ? `${first.abbr} LEAD BY ${lead}` : `${first.abbr} TRAIL BY ${-lead}`;
  if (!choice) return { title, sub: leads, next: true, prompt: "ENTER = NEXT INNINGS" };
  if (choice.mine) {
    const advice = choice.advice ? "ENFORCE IT" : "BAT AGAIN";
    return { title, sub: `${leads}. THE DRESSING ROOM SAYS: ${advice}`, next: true, followOn: true };
  }
  const call = choice.advice ? `${first.name.toUpperCase()} ENFORCE THE FOLLOW-ON` : `${first.name.toUpperCase()} WILL BAT AGAIN`;
  return { title, sub: `${leads}. ${call}`, next: true, prompt: "ENTER = NEXT INNINGS" };
}
