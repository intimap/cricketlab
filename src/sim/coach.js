import { DELIVERY_NAMES, crossingAtZ, lengthName, lineName, movementText } from "./delivery.js";
import { shotSuitability, CONTACT_Z_FRONT } from "./batting.js";

/**
 * The nets coach: a verdict on every ball. Pure functions of what happened,
 * returning { title, lines, grade } where grade is "good", "ok" or "poor".
 * Thresholds are named below so the coach's strictness can be tuned.
 */

/** Timing within this (seconds) is "perfect"; beyond LATE_BAD it's a poor one. */
const TIMING_PERFECT = 0.015;
const TIMING_BAD = 0.06;
/** A shot this much less suitable than the best option gets called out. */
const CHOICE_GAP = 0.3;
/** Missing the target length by this much (m) earns a comment. */
const LENGTH_MISS = 1;
/** Missing the target line by this much (m) at the stumps earns a comment. */
const LINE_MISS = 0.15;

const SHOT_NAMES = {
  drive: "DRIVE (S)",
  cutpull: "CUT / PULL (Q)",
  loft: "LOFT (W)",
  defend: "DEFEND (A)",
  leave: "LEAVE",
  ramp: "RAMP",
  sweep: "SWEEP",
  reverseSweep: "REVERSE SWEEP",
};
const CHOICES = ["drive", "cutpull", "loft", "defend", "leave"];
const ms = (s) => `${Math.round(Math.abs(s) * 1000)} MS`;
const kmh = (d) => Math.round(d.speed * 3.6);

/** "138 KM/H OUTSWINGER, GOOD LENGTH, OUTSIDE OFF" */
export function describeDelivery(d, spinner) {
  const at = d.atCrease;
  const length = lengthName(d.pitchedAt?.z ?? 0, spinner).toUpperCase();
  const line = lineName(at ? at.x : d.intent.line).toUpperCase();
  return `${kmh(d)} KM/H ${DELIVERY_NAMES[d.intent.type]}, ${length}, ${line}`;
}

function resultText(rec) {
  if (rec.wicket) return `OUT - ${rec.wicket.how.toUpperCase()}`;
  if (rec.boundary) return `${rec.boundary} RUNS`;
  if (rec.extra.type === "wd") return "WIDE";
  if (rec.extra.type === "nb") return "NO BALL";
  return rec.runsBat ? `${rec.runsBat} RUN${rec.runsBat > 1 ? "S" : ""}` : "NO RUN";
}

function contactText(rec) {
  if (rec.shot === "leave") return "LEFT IT";
  switch (rec.contact) {
    case "middle":
      return rec.quality > 0.75 ? "MIDDLED IT" : "DECENT CONTACT";
    case "thickEdge":
    case "outsideEdge":
    case "thinEdge":
      return "EDGED IT";
    case "insideEdge":
    case "bottomEdge":
      return "INSIDE / BOTTOM EDGE";
    case "topEdge":
      return "TOP EDGE";
    case "padPop":
      return "OFF THE PAD";
    default:
      return rec.lbwNote || rec.wicket?.how === "lbw" ? "HIT ON THE PAD" : "MISSED IT";
  }
}

/** Feedback for the player's batting: the ball, the shot, timing, choice and a tip. */
export function battingFeedback({ delivery, shot, rec, spinner }) {
  const lines = [describeDelivery(delivery, spinner)];
  const type = shot?.type ?? "leave";
  const at = crossingAtZ(delivery.samples, CONTACT_Z_FRONT);
  const height = at?.y ?? 0.6;
  const line = at?.x ?? delivery.intent.line;
  const pitchZ = delivery.pitchedAt?.z ?? 0;

  lines.push(`YOUR SHOT: ${SHOT_NAMES[type] ?? type.toUpperCase()} - ${contactText(rec)}`);

  let timingGood = true;
  if (shot && type !== "leave") {
    const err = shot.timingError ?? 0;
    timingGood = Math.abs(err) <= TIMING_PERFECT;
    lines.push(timingGood ? "TIMING: PERFECT" : `TIMING: ${ms(err)} ${err > 0 ? "LATE" : "EARLY"}`);
  }

  // Was it the right shot? Compare with the best of the main options.
  const suit = (t) => (t === "leave" ? (Math.abs(line) > 0.3 ? 0.9 : 0.2) : shotSuitability(t, height, pitchZ, line, spinner));
  const best = CHOICES.reduce((a, b) => (suit(b) > suit(a) ? b : a));
  const gap = suit(best) - suit(type);
  const goodChoice = gap < CHOICE_GAP;
  lines.push(goodChoice ? "SHOT CHOICE: GOOD" : `SHOT CHOICE: ${SHOT_NAMES[best]} WAS THE PERCENTAGE PLAY`);

  let tip = "";
  if (!goodChoice && pitchZ > 8) tip = "SHORT BALL: ROCK BACK AND CUT OR PULL (Q), OR LEAVE IT.";
  else if (!goodChoice && pitchZ < 4.5) tip = "PITCHED UP: GET FORWARD AND DRIVE (S).";
  else if (!goodChoice && Math.abs(line) > 0.35) tip = "WELL OUTSIDE OFF: LEAVE IT, OR CUT IF IT'S SHORT.";
  else if (shot && !timingGood && Math.abs(shot.timingError) > TIMING_BAD) {
    tip =
      shot.timingError > 0
        ? "WAY LATE: PICK UP THE LENGTH AND START YOUR SHOT SOONER."
        : "WAY EARLY: WAIT FOR IT. LET THE BALL COME.";
  } else if (type === "leave" && Math.abs(line) < 0.12) tip = "THAT WAS ON THE STUMPS: DON'T LEAVE THOSE.";
  else if (rec.wicket) tip = "SHAKE IT OFF. WATCH THE BALL OUT OF THE HAND.";
  else if (goodChoice && timingGood) tip = "TEXTBOOK. DO THAT AGAIN.";

  const good = !rec.wicket && goodChoice && (timingGood || type === "leave") && rec.contact !== "none";
  const poor = !!rec.wicket || (!goodChoice && rec.contact === "none") || (shot && Math.abs(shot.timingError ?? 0) > TIMING_BAD);
  if (tip) lines.push(`COACH: ${tip}`);
  return { title: resultText(rec), lines, grade: good ? "good" : poor ? "poor" : "ok" };
}

/** Feedback for the player's bowling: release, where it landed against the target, movement, the result. */
export function bowlingFeedback({ delivery, intent, releaseError, perfect, rec, spinner }) {
  const lines = [];
  if (delivery.noBall) lines.push("RELEASE: NO BALL - OVERSTEPPED");
  else if (perfect) lines.push("RELEASE: PERFECT");
  else lines.push(`RELEASE: ${ms(releaseError)} ${releaseError > 0 ? "LATE - DRAGGED IT FULLER" : "EARLY - IT DROPS SHORTER"}`);

  const pitchZ = delivery.pitchedAt?.z ?? 0;
  const at = delivery.atCrease;
  const lineAt = at ? at.x : intent.line;
  lines.push(
    `PITCHED ${lengthName(pitchZ, spinner).toUpperCase()} (${pitchZ.toFixed(1)} M) - AIMED ${lengthName(intent.length, spinner).toUpperCase()} (${intent.length.toFixed(1)} M)`,
  );
  lines.push(`AT THE STUMPS: ${lineName(lineAt).toUpperCase()} - AIMED ${lineName(intent.line).toUpperCase()}`);

  // Movement: in the air before the bounce, and off the pitch after it.
  const moved = movementText(delivery);
  lines.push(`PACE ${kmh(delivery)} KM/H${moved ? "   " + moved : "   WENT STRAIGHT ON"}`);

  const lengthOff = pitchZ - intent.length;
  const lineOff = lineAt - intent.line;
  let tip = "";
  if (delivery.noBall) tip = "RELEASE A FRACTION EARLIER: YOU'RE OVERSTEPPING.";
  else if (Math.abs(lengthOff) > LENGTH_MISS) {
    tip =
      lengthOff > 0
        ? "DROPPED SHORT OF YOUR TARGET: RELEASE A TOUCH LATER."
        : "TOO FULL FOR YOUR TARGET: RELEASE A TOUCH EARLIER.";
  } else if (Math.abs(lineOff) > LINE_MISS) tip = "STRAYED OFF YOUR LINE: TIRED BOWLERS SPRAY IT, AND HIGH EFFORT DOES TOO.";
  else if (rec.wicket) tip = "GOT HIM. THAT'S THE PLAN WORKING.";
  else if (rec.beatBat) tip = "BEAT THE BAT. KEEP HITTING THAT AREA.";
  else if (rec.boundary) tip = "HE WAS READY FOR THAT ONE. MIX UP YOUR LENGTH OR CHANGE THE BALL.";
  else tip = "ON THE MONEY. BUILD THE PRESSURE.";
  lines.push(`COACH: ${tip}`);

  const onTarget = Math.abs(lengthOff) <= LENGTH_MISS && Math.abs(lineOff) <= LINE_MISS && !delivery.noBall;
  const grade = rec.wicket || (onTarget && (rec.beatBat || rec.total === 0)) ? "good" : !onTarget || rec.boundary ? "poor" : "ok";
  const batter = rec.wicket ? `OUT - ${rec.wicket.how.toUpperCase()}` : rec.beatBat ? "BEATEN!" : resultText(rec);
  return { title: batter, lines, grade };
}
