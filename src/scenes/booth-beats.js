import { scheduleCalls, callDuration, fitsBox } from "../render/booth.js";
import { fitsHud, shownOf } from "../render/call-line.js";
import { GROUNDS } from "../render/grounds.js";
import { TRACKING_TIME } from "../render/match-broadcast.js";
import { setupCall, deliveryCall, shotCall, outcomeCall, overIntroParts, fieldCall, PLAN_READS } from "../sim/booth-beats.js";
import { COLORS } from "../engine/screen.js";
import { venueCall } from "../sim/booth-venue-lines.js";
import { wrapUpCall } from "../sim/booth-wrap-lines.js";
import { weatherCall, breakCall, declareCall, rainStopCall, rainCostCall } from "../sim/booth-weather-lines.js";
import { leadOf } from "../sim/test-match.js";
import { warningCall } from "../sim/booth-law-lines.js";
import { onFieldCall, reviewCall, trackingCall, verdictCall } from "../sim/booth-drs-lines.js";
import { activeWicketSide } from "./bowling-side.js";
import { boxAllows } from "./commentary-level.js";

/**
 * The commentary through each ball, on the broadcast's beats. The over's caller calls the ball on the HUD's
 * bottom line (`scene.callLine`): who's bowling at the start of the over, the run-up, the delivery and the
 * shot as it reaches the bat, then how it ended, as one sentence. The box (`scene.booth`) carries the other
 * two voices' remarks: the ground and the day, why the bowler's on and his plan, the moments after the ball.
 * The words come from sim/booth-*.js; this decides when and where they're said. Presentation only.
 */

// Presentation randomness: never the match's dice. Never the same option from a list twice running.
const lastPick = new WeakMap();
function pick(list) {
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastPick.get(list)) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  lastPick.set(list, i);
  return list[i];
}

/** The scene's presentation dice for the booth editor (sim/booth-editor.js). */
const presentation = { random: Math.random };
const editorOf = (scene) => scene.match.comm?.booth ?? null;

function state(scene) {
  scene.beats ??= { innings: null, fieldSaid: new Set(), field: null, shotSaid: false };
  return scene.beats;
}

/** The voice calling this over (the one who calls each ball, as booth-caller.js does). */
const lead = (scene) => scene.inn.overNo % 3;
/** The box speaks with the voices not calling: the caller is on the HUD line. */
const boxVoice = (scene, who) => (who === lead(scene) ? (who + 1) % 3 : who);
const live = (scene) => !scene.nets && !!scene.inn.bowler;
const fieldSignature = (inn) => `${inn.preset}:${inn.customField ? JSON.stringify(inn.placements) : ""}`;

/** Remarks on after whatever the box is still saying, if the commentary setting allows them. */
function queue(scene, calls, at = scene.now + 0.2) {
  calls = calls.filter(boxAllows);
  if (!calls.length) return;
  const after = scene.booth?.length ? Math.max(at, scene.boothEndsAt()) : at;
  scene.booth = [...(scene.booth ?? []).filter((c) => scene.now - c.t0 <= callDuration(c)), ...scheduleCalls(calls, after)];
}

/** An event the box speaks to at once, cutting off what it was saying. */
function interrupt(scene, call, at = scene.now) {
  scene.booth = boxAllows(call) ? scheduleCalls([call], at) : [];
}

/** Trim a call to the HUD line, at a word, if it's too long. */
function fitted(text) {
  if (fitsHud(text)) return text;
  const words = text.split(" ");
  while (words.length > 1 && !fitsHud(`${words.join(" ")}..`)) words.pop();
  return `${words.join(" ")}..`;
}

/**
 * The caller says `text` on the HUD line: carrying on the sentence he's in the middle of (`carryOn`, if it
 * fits), or starting a new one. From time `at` (default now), the line before stays up until then.
 */
function sayOnHud(scene, who, text, carryOn, at = scene.now) {
  if (!text) return;
  const prev = scene.callLine;
  if (carryOn && prev && prev.who === who && fitsHud(`${prev.text} ${text}`))
    scene.callLine = { who, text: `${prev.text} ${text}`, from: shownOf(prev, scene.now), t0: at };
  else scene.callLine = { who, text: fitted(text), from: 0, t0: at, prev: at > scene.now ? prev : null };
}

/** Finish the caller's open sentence ("--") with a full stop: the ball's over and there's no more to say. */
function closeHud(scene) {
  const call = scene.callLine;
  if (!call?.text.endsWith(" --")) return;
  scene.callLine = { ...call, text: `${call.text.slice(0, -3)}.`, from: shownOf(call, scene.now), t0: scene.now };
}

/** The innings (or match) is over: the box wraps it up over the scorecard. */
export function onInningsEnd(scene) {
  if (!live(scene)) return;
  const inn = scene.inn;
  const match = scene.match;
  const score = `${inn.runs}${inn.wkts >= 10 ? " ALL OUT" : `/${inn.wkts}${inn.declared ? " DECLARED" : ""}`}`;
  const facts = { team: inn.batTeam.name, score, chasers: inn.bowlTeam.name };
  // A Test has a target to talk about only before the last innings.
  if (match.hasNextInnings && !match.clock) facts.need = inn.runs + 1;
  else if (match.hasNextInnings && match.innings.length === 3) facts.need = Math.max(1, -leadOf(match, inn.bowlTeam) + 1);
  else if (match.result) facts.result = match.result.text;
  const who = boxVoice(scene, lead(scene));
  const text = wrapUpCall(who, facts, pick);
  if (fitsBox(text)) queue(scene, [{ who, text, event: true }], scene.now + 0.6);
}

/** The weather report is up: the box's take on the day (and the rain), the longest version that fits. */
export function onForecast(scene) {
  if (scene.nets) return;
  const { match } = scene;
  const w = match.weather;
  const who = boxVoice(scene, (match.clock?.day ?? 0) % 3);
  const facts = {
    id: w.id,
    temp: w.temp,
    day: match.clock?.day,
    lost: match.clock?.lostToday,
    overs: match.oversLost ? match.overs : 0,
  };
  for (const f of [facts, { ...facts, day: 0 }, { id: w.id, temp: w.temp }]) {
    const text = weatherCall(who, f, pick);
    if (fitsBox(text)) return queue(scene, [{ who, text, event: true }], scene.now + 0.5);
  }
}

/** Lunch, tea or stumps in a Test. */
export function onBreak(scene, brk, day) {
  if (scene.nets) return;
  const inn = scene.inn;
  const who = boxVoice(scene, lead(scene));
  const text = breakCall(who, brk, { team: inn.batTeam.name, score: `${inn.runs}/${inn.wkts}`, day }, pick);
  if (fitsBox(text)) queue(scene, [{ who, text, event: true }], scene.now + 0.6);
}

/** Rain has stopped play: one voice says so, the next what it has cost. */
export function onRain(scene, facts) {
  if (scene.nets) return;
  const who = (lead(scene) + 1) % 3;
  const next = (lead(scene) + 2) % 3;
  const calls = [
    { who, text: rainStopCall(who, pick), event: true },
    { who: next, text: rainCostCall(next, facts, pick), event: true },
  ];
  queue(
    scene,
    calls.filter((c) => c.text && fitsBox(c.text)),
    scene.now + 0.5,
  );
}

/** The umpire has warned the bowler for too many bouncers, or taken him off: the box says so after the ball. */
export function onWarning(scene, kind, bowler) {
  if (scene.nets) return;
  const who = boxVoice(scene, lead(scene));
  const text = warningCall(who, kind, { w: bowler.short }, pick);
  if (fitsBox(text)) queue(scene, [{ who, text, event: true }], scene.now + 0.8);
}

/** Batting in a Test: the box reckons it's time to declare. */
export function onDeclareAdvice(scene) {
  const who = boxVoice(scene, lead(scene));
  const text = declareCall(who, pick);
  if (fitsBox(text)) queue(scene, [{ who, text, event: true }], scene.now + 0.4);
}

/**
 * The next ball is being set up. At an innings' start the box sets the scene (the ground and the pitch); at
 * an over's, the caller says who's bowling and the box why he's on, the phase, the field or his plan.
 */
export function onNextBall(scene) {
  if (!live(scene)) return;
  const beats = state(scene);
  const inn = scene.inn;
  const calls = [];
  if (beats.innings !== inn) {
    beats.innings = inn;
    beats.fieldSaid.clear();
    const text = venueCall(scene.cfg.ground, inn.pitch.type.id, scene.cfg.light, scene.match.innings.length === 1, pick);
    if (text && fitsBox(text)) calls.push({ who: boxVoice(scene, 0), text, keep: true, event: true });
  }
  const sig = fieldSignature(inn);
  if (inn.ballInOver === 0) {
    // Batting against the computer, a change of plan is read out, and tagged on screen as it's said.
    const plan = scene.human === "bat" && PLAN_READS[inn.overPlan] && inn.overPlan !== beats.planSaid ? inn.overPlan : null;
    const { head, extra } = overIntroParts(lead(scene), inn, fieldCall(inn, beats.fieldSaid), pick, plan);
    sayOnHud(scene, lead(scene), head, false);
    // What's new about the over (the powerplay, a Test day, a bowler's last), or else the usual scene-setting.
    const remark = plan
      ? null
      : editorOf(scene)?.overStart(inn, scene.match, { caller: lead(scene), rng: presentation, fits: fitsBox });
    if (remark) calls.push({ ...remark, keep: true });
    else if (extra && fitsBox(extra)) {
      // A plan read matters to the batter: kept through the run-up, and important enough for QUIET.
      calls.push({ who: (lead(scene) + 1) % 3, text: extra, keep: true, priority: plan ? 70 : 30 });
      if (plan) {
        beats.planSaid = plan;
        scene.flash(`READ: ${PLAN_READS[plan].tag}`, COLORS.gold);
      }
    }
  } else if (beats.field !== null && sig !== beats.field) {
    // The captain has moved the field mid-over.
    const field = fieldCall(inn, beats.fieldSaid);
    if (field && fitsBox(`A CHANGE IN THE FIELD. ${field}`))
      calls.push({ who: (lead(scene) + 2) % 3, text: `A CHANGE IN THE FIELD. ${field}`, priority: 30 });
  }
  beats.field = sig;
  queue(scene, calls);
}

/** Calls still to be said that must not be cut: the ground and the start of the over. */
const kept = (scene) => (scene.booth ?? []).filter((c) => c.keep && scene.now - c.t0 <= callDuration(c));
/** When the last of `calls` finishes. */
const endOf = (calls, now) => calls.reduce((end, c) => Math.max(end, c.t0 + callDuration(c)), now);

/**
 * The bowler runs in: the box's chat about the last ball stops here (the ground and the start of the over
 * carry on), and the caller starts the ball's sentence on the HUD line. If the over so far has a pattern
 * (and the box is free), one of the others says so, briefly, before he lets go.
 */
export function onRunup(scene) {
  if (!live(scene) || !scene.cur) return;
  const beats = state(scene);
  const inn = scene.inn;
  beats.shotSaid = false;
  const intro = kept(scene);
  const started = intro.filter((c) => c.t0 <= scene.now);
  const waiting = intro.filter((c) => c.t0 > scene.now);
  scene.booth = [...started, ...scheduleCalls(waiting, endOf(started, scene.now))];
  const remark = intro.length ? null : editorOf(scene)?.runup(inn, { caller: lead(scene), rng: presentation, fits: fitsBox });
  if (remark && boxAllows(remark)) scene.booth = scheduleCalls([remark], scene.now);
  const ends = GROUNDS[scene.cfg.ground]?.ends ?? ["PAVILION END", "SCOREBOARD END"];
  const text = setupCall(
    lead(scene),
    {
      w: inn.bowler.p.short,
      b: inn.bat[inn.striker].p.short,
      end: ends[inn.overNo % 2],
      spin: ["offspin", "legspin"].includes(inn.bowler.p.bowl?.style),
      around: activeWicketSide(scene) === "around",
    },
    pick,
  );
  sayOnHud(scene, lead(scene), text, false);
}

/** The ball reaches the bat: what was bowled and what he did with it, carried on from the run-up. */
export function onContact(scene) {
  if (!live(scene) || !scene.cur?.delivery) return;
  const beats = state(scene);
  const d = scene.cur.delivery;
  const delivery = deliveryCall(
    {
      type: scene.cur.intent.type,
      pitchZ: d.pitchedAt?.z ?? 0,
      line: d.atCrease ? d.atCrease.x : scene.cur.intent.line,
      spin: ["offspin", "legspin"].includes(scene.inn.bowler.p.bowl?.style),
    },
    pick,
  );
  // The stroke, called as he plays it; where it ends up comes when the ball is dead.
  const res = scene.cur.play?.res;
  const shot = res
    ? shotCall(
        {
          shot: scene.cur.play.shot.type,
          contact: res.contact.kind,
          shotName: res.contact.shotName,
          touched: res.touchedBat,
          padHit: res.padHit,
          exit: res.contact.exit,
        },
        pick,
      )
    : "";
  beats.shotSaid = !!shot;
  sayOnHud(scene, lead(scene), shot ? `${delivery} ${shot}` : delivery, true);
  // Too long for the line with the run-up: the shot alone carries on.
  if (shot && !scene.callLine.text.endsWith(shot)) sayOnHud(scene, lead(scene), shot, true);
}

/**
 * The ball is done. The caller finishes his sentence with how it ended: briefly if he called the shot, or
 * with his own call for the ball (wickets, drops, extras). The box's remarks follow.
 */
export function onResult(scene, calls, rec) {
  const beats = state(scene);
  const primary = calls.find((c) => c.topic === "ballCall");
  const rest = calls.filter((c) => c !== primary);
  const who = scene.callLine?.who ?? primary?.who ?? lead(scene);
  const outcome = beats.shotSaid ? outcomeCall(rec, pick) : null;
  beats.shotSaid = false;
  if (outcome) sayOnHud(scene, who, outcome, true);
  else if (outcome === null && primary) sayOnHud(scene, primary.who, primary.text, true);
  else closeHud(scene);
  queue(scene, rest);
}

const names = (scene) => ({ b: scene.inn.bat[scene.cur.play.striker ?? scene.inn.striker]?.p.short ?? "" });

/** The umpire gives his decision on an LBW appeal: the caller says it. */
export function onDecision(scene, out) {
  if (!live(scene)) return;
  sayOnHud(scene, lead(scene), onFieldCall(lead(scene), out, names(scene), pick), true);
}

/** A review is called for (the box), then the caller reads the ball-tracking as it plays. */
export function onReview(scene, by) {
  if (!live(scene)) return;
  const who = (lead(scene) + 1) % 3;
  interrupt(scene, { who, text: reviewCall(who, by, names(scene), pick), event: true });
  const at = Math.max(scene.boothEndsAt(), scene.now + TRACKING_TIME - 0.6);
  sayOnHud(scene, lead(scene), trackingCall(scene.cur.tracking.reason, pick), false, at);
}

/** The review's verdict, from the box, before the ball's own calls. */
export function onVerdict(scene, { onField, out, verdict }) {
  if (!live(scene)) return;
  const who = (lead(scene) + 2) % 3;
  interrupt(scene, { who, text: verdictCall(who, { onField, out, verdict }, names(scene), pick), event: true });
}
