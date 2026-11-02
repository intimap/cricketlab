import { scheduleCalls, callDuration, fitsBox } from "../render/booth.js";
import { GROUNDS } from "../render/grounds.js";
import { TRACKING_TIME } from "../render/match-broadcast.js";
import { setupCall, deliveryCall, overIntroCall, fieldCall } from "../sim/booth-beats.js";
import { venueCall } from "../sim/booth-venue-lines.js";
import { onFieldCall, reviewCall, trackingCall, verdictCall } from "../sim/booth-drs-lines.js";
import { activeWicketSide } from "./bowling-side.js";

/**
 * The commentary box through each ball, on the broadcast's beats: scene-setting and the start of the
 * over before it, the setup as the bowler runs in, the delivery as it reaches the bat, then the result
 * joined on as one sentence (and the second voice's reset after it); and the LBW decision and review.
 * The words come from sim/booth-*.js; this decides when they're said. Presentation only.
 */

// Presentation randomness: never the match's dice. Never the same option from a list twice running.
const lastPick = new WeakMap();
function pick(list) {
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastPick.get(list)) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  lastPick.set(list, i);
  return list[i];
}

function state(scene) {
  scene.beats ??= { innings: null, fieldSaid: new Set(), field: null, running: null };
  return scene.beats;
}

/** The voice leading the over (the one who calls each ball, as booth-caller.js does). */
const lead = (scene) => scene.inn.overNo % 3;
const live = (scene) => !scene.nets && !!scene.inn.bowler;
const fieldSignature = (inn) => `${inn.preset}:${inn.customField ? JSON.stringify(inn.placements) : ""}`;

/** Calls on after whatever the box is still saying. */
function queue(scene, calls, at = scene.now + 0.2) {
  if (!calls.length) return;
  const after = scene.booth?.length ? Math.max(at, scene.boothEndsAt()) : at;
  scene.booth = [...(scene.booth ?? []).filter((c) => scene.now - c.t0 <= callDuration(c)), ...scheduleCalls(calls, after)];
}

/** The next ball is being set up: at an innings' start, the ground and pitch; at an over's, the bowler. */
export function onNextBall(scene) {
  if (!live(scene)) return;
  const beats = state(scene);
  const inn = scene.inn;
  const calls = [];
  if (beats.innings !== inn) {
    beats.innings = inn;
    beats.fieldSaid.clear();
    const text = venueCall(scene.cfg.ground, inn.pitch.type.id, scene.cfg.light, scene.match.innings.length === 1, pick);
    if (text && fitsBox(text)) calls.push({ who: 0, text, keep: true });
  }
  const sig = fieldSignature(inn);
  if (inn.ballInOver === 0) {
    const text = overIntroCall(lead(scene), inn, fieldCall(inn, beats.fieldSaid), pick);
    if (fitsBox(text)) calls.push({ who: lead(scene), text, keep: true });
  } else if (beats.field !== null && sig !== beats.field) {
    // The captain has moved the field mid-over.
    const field = fieldCall(inn, beats.fieldSaid);
    if (field && fitsBox(`A CHANGE IN THE FIELD. ${field}`))
      calls.push({ who: (lead(scene) + 2) % 3, text: `A CHANGE IN THE FIELD. ${field}` });
  }
  beats.field = sig;
  queue(scene, calls);
}

/** Calls still to be said that must not be cut: the ground and the start of the over. */
const kept = (scene) => (scene.booth ?? []).filter((c) => c.keep && scene.now - c.t0 <= callDuration(c));
/** When the last of `calls` finishes. */
const endOf = (calls, now) => calls.reduce((end, c) => Math.max(end, c.t0 + callDuration(c)), now);

/**
 * The bowler runs in: the last ball's chat stops here. The start of the over (if still to come) is said
 * as he runs in; otherwise the setup, held open for the delivery and the result.
 */
export function onRunup(scene) {
  if (!live(scene) || !scene.cur) return;
  const beats = state(scene);
  const inn = scene.inn;
  beats.running = null;
  const intro = kept(scene);
  if (intro.length) {
    const started = intro.filter((c) => c.t0 <= scene.now);
    const waiting = intro.filter((c) => c.t0 > scene.now);
    scene.booth = [...started, ...scheduleCalls(waiting, endOf(started, scene.now))];
    return;
  }
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
  beats.running = { who: lead(scene), text, t0: scene.now, open: true };
  scene.booth = [beats.running];
}

/** The ball reaches the bat: what was bowled, carried on from the setup. */
export function onContact(scene) {
  if (!live(scene) || !scene.cur?.delivery) return;
  const beats = state(scene);
  const d = scene.cur.delivery;
  const text = deliveryCall(
    {
      type: scene.cur.intent.type,
      pitchZ: d.pitchedAt?.z ?? 0,
      line: d.atCrease ? d.atCrease.x : scene.cur.intent.line,
      spin: ["offspin", "legspin"].includes(scene.inn.bowler.p.bowl?.style),
    },
    pick,
  );
  grow(scene, beats, lead(scene), text, true);
}

/** Add `text` to the open sentence (or start one), keeping it open if more is coming. */
function grow(scene, beats, who, text, open) {
  const prev = beats.running;
  // After the start of the over, if that's still being said.
  const intro = kept(scene);
  const at = endOf(intro, scene.now);
  if (prev && prev.who === who && fitsBox(`${prev.text} ${text}`)) {
    beats.running = {
      who,
      text: `${prev.text} ${text}`,
      from: prev.text.length + 1,
      cont: true,
      open,
      t0: Math.max(at, prev.t0),
    };
  } else beats.running = { who, text, from: 0, cont: !!prev && at === scene.now, open, t0: at };
  scene.booth = [...intro, beats.running];
}

/** Close the open sentence where it stands (the ball is over without its result being called yet). */
function close(scene, beats) {
  if (!beats.running) return;
  const call = { ...beats.running, open: false, from: beats.running.text.length, t0: scene.now };
  beats.running = null;
  scene.booth = [call];
}

/**
 * The ball is done: the box's calls for it (booth-editor.js). The first, the lead voice's result, finishes
 * the open sentence; the rest follow it.
 */
export function onResult(scene, calls) {
  const beats = state(scene);
  const [first, ...rest] = calls;
  if (first && beats.running && first.who === beats.running.who) {
    grow(scene, beats, first.who, first.text, false);
    beats.running = null;
    queue(scene, rest);
    return;
  }
  close(scene, beats);
  queue(scene, calls);
}

const names = (scene) => ({ b: scene.inn.bat[scene.cur.play.striker ?? scene.inn.striker]?.p.short ?? "" });

/** The umpire gives his decision on an LBW appeal. */
export function onDecision(scene, out) {
  if (!live(scene)) return;
  const beats = state(scene);
  close(scene, beats);
  queue(scene, [{ who: lead(scene), text: onFieldCall(lead(scene), out, names(scene), pick) }], scene.now);
}

/** A review is called for, then the ball-tracking plays. */
export function onReview(scene, by) {
  if (!live(scene)) return;
  const who = (lead(scene) + 1) % 3;
  scene.booth = scheduleCalls([{ who, text: reviewCall(who, by, names(scene), pick) }], scene.now);
  // The tracking as it plays, once the review call is done.
  const at = Math.max(scene.boothEndsAt(), scene.now + TRACKING_TIME - 0.6);
  scene.booth.push(...scheduleCalls([{ who: lead(scene), text: trackingCall(scene.cur.tracking.reason, pick) }], at));
}

/** The review's verdict, before the ball's own calls. */
export function onVerdict(scene, { onField, out, verdict }) {
  if (!live(scene)) return;
  const who = (lead(scene) + 2) % 3;
  scene.booth = scheduleCalls([{ who, text: verdictCall(who, { onField, out, verdict }, names(scene), pick) }], scene.now);
}
