import { MOMENT } from "./memory-moments.js";

/**
 * The match memory's chase and phases (sim/match-memory.js). The chase: the required rate climbing through
 * thresholds (each re-armed once the rate falls back below it by a margin, so it's said again only after a
 * real recovery), the need for a boundary an over, and checkpoints against a simple par. The phases: a new
 * ball, the ball starting to reverse, the pitch starting to turn, the powerplay ending, the light changing,
 * the last over before a Test's break.
 */

/** Required rates (runs an over) that are each worth a word as the chase climbs past them. */
export const RRR_THRESHOLDS = [8, 12, 15];
/** A threshold is re-armed once the rate is back this far below it. */
export const RRR_REARM = 1;
/** A boundary an over on top of the singles: this rate. Re-armed below BOUNDARY_REARM. */
export const BOUNDARY_RATE = 10;
export const BOUNDARY_REARM = 9;
/** Chase thresholds are only told with at least this many balls left (later, the last-overs lines take over). */
export const CHASE_MIN_BALLS = 18;
/** The chase's checkpoints (overs), by format. */
export const CHECKPOINTS = { t20: [6, 10, 15], odi: [10, 20, 30, 40] };
/** Overs in the powerplay, by format. */
export const POWERPLAY_OVERS = { t20: 6, odi: 10 };
/** The ball reverses from this (sim/conditions.js reverse, 0..1), and the pitch turns from this much more than at the start. */
export const REVERSE_FROM = 0.3;
export const TURN_FROM = 1.35;

/** A chase in a limited-overs game that's still alive. */
const chasing = (state) =>
  state.target !== null && state.target !== undefined && state.format !== "test" && state.runs < state.target;

function detectChase(mem, ball, state, emit) {
  if (!chasing(state)) return;
  const need = state.target - state.runs;
  const left = state.oversLimit * 6 - state.legal;
  if (left <= 0) return;
  const rrr = (need * 6) / left;
  const facts = { team: state.batName ?? state.batTeam, need, left, rrr: rrr.toFixed(1) };
  const { crossed, crossings } = mem.chase;
  // A threshold is armed until it's told; told, it waits until the rate falls back below its re-arm mark. Held
  // back by a cooldown, it's tried again next ball while the rate is still past it.
  const armed = (id, at, rearm) => {
    if (rrr < rearm) crossed[id] = false;
    return rrr >= at && !crossed[id] && left >= CHASE_MIN_BALLS;
  };
  const tell = (id, type, payload) => {
    if (!emit(type, `${state.innings}:${id}:${(crossings[id] ?? 0) + 1}`, payload)) return false;
    crossed[id] = true;
    crossings[id] = (crossings[id] ?? 0) + 1;
    return true;
  };
  // The highest threshold past is the one told; those below it count as told with it.
  const past = RRR_THRESHOLDS.filter((t) => armed(`rrr${t}`, t, t - RRR_REARM));
  const top = past.at(-1);
  if (top !== undefined && tell(`rrr${top}`, MOMENT.CHASE_RRR_THRESHOLD, { ...facts, threshold: top }))
    for (const t of past) crossed[`rrr${t}`] = true;
  if (armed("boundary", BOUNDARY_RATE, BOUNDARY_REARM))
    tell("boundary", MOMENT.CHASE_BOUNDARY_PER_OVER, { ...facts, overs: Math.ceil(left / 6) });
  // A checkpoint: the over just finished is one of them.
  const over = state.legal / 6;
  if (ball.legal && Number.isInteger(over) && (CHECKPOINTS[state.format] ?? []).includes(over)) {
    const par = Math.round((state.target * state.legal) / (state.oversLimit * 6));
    const diff = state.runs - par;
    emit(MOMENT.CHASE_CHECKPOINT, `${state.innings}:${over}`, {
      ...facts,
      over,
      runs: state.runs,
      par,
      diff: Math.abs(diff),
      ahead: diff >= 0 ? "ahead" : "behind",
    });
  }
}

/** The next break in a Test day, and the over (overs bowled today) that ends with it. */
function nextBreak(test) {
  if (!test.lunch) return { name: "lunch", at: Math.round(test.quota / 3) };
  if (!test.tea) return { name: "tea", at: Math.round((2 * test.quota) / 3) };
  return { name: "stumps", at: test.quota };
}
const BREAK_WORDS = { lunch: "LUNCH", tea: "TEA", stumps: "STUMPS" };
const LIGHT_WORDS = { midday: "THE MIDDAY SUN", afternoon: "THE AFTERNOON", evening: "THE EVENING", night: "THE LIGHTS" };

function detectPhases(mem, ball, state, emit) {
  const seen = mem.seen;
  // A new ball.
  if (seen.ballNumber !== null && state.ballNumber > seen.ballNumber)
    emit(MOMENT.PHASE_NEW_BALL, `${state.innings}:${state.ballNumber}`, {
      overs: Math.round(seen.ballOvers),
      w: ball.bowlerShort ?? ball.bowler,
    });
  if (seen.ballNumber !== state.ballNumber) seen.reversing = false;
  seen.ballNumber = state.ballNumber;
  seen.ballOvers = state.ballOvers;
  // Reverse swing, once a ball.
  if (!seen.reversing && state.reverse >= REVERSE_FROM) {
    seen.reversing = true;
    emit(MOMENT.PHASE_REVERSE, `${state.innings}:${state.ballNumber}`, {
      overs: Math.round(state.ballOvers),
      w: ball.bowlerShort ?? ball.bowler,
    });
  }
  // The pitch turning, once a match.
  if (state.turnRatio >= TURN_FROM) emit(MOMENT.PHASE_TURN, "pitch", { w: ball.bowlerShort ?? ball.bowler });
  // The powerplay's last ball.
  const pp = POWERPLAY_OVERS[state.format];
  if (pp && ball.legal && state.legal === pp * 6)
    emit(MOMENT.PHASE_POWERPLAY_END, `${state.innings}`, {
      team: state.batName ?? state.batTeam,
      runs: state.runs,
      wkts: state.wkts,
      overs: pp,
    });
  // The light.
  if (state.light && seen.light && state.light !== seen.light)
    emit(MOMENT.PHASE_LIGHT, `${state.innings}:${state.light}`, { light: LIGHT_WORDS[state.light] ?? state.light.toUpperCase() });
  if (state.light) seen.light = state.light;
  // A Test's last over before lunch, tea or stumps: the over now under way ends with the break.
  if (state.test?.quota) {
    const brk = nextBreak(state.test);
    if (state.test.today === brk.at - 1)
      emit(MOMENT.PHASE_LAST_OVER_BEFORE_BREAK, `${state.test.day}:${brk.name}`, {
        brk: BREAK_WORDS[brk.name],
        day: state.test.day,
      });
  }
}

export const PHASE_DETECTORS = [detectChase, detectPhases];
