import { winProbability } from "./win-probability.js";
import { DUEL_DETECTORS } from "./memory-duels.js";
import { PHASE_DETECTORS } from "./memory-phases.js";
import { MOMENT, MOMENT_RULES } from "./memory-moments.js";
export { MOMENT, MOMENT_RULES } from "./memory-moments.js";

/**
 * The match memory: what the commentary would remember of a match, turned ball by ball into named moments
 * (a turning point, a duel, a let-off coming back to bite, the chase's equation, a new phase of the game).
 * Pure: it only reads the ball and the match, never changes them, and uses no dice, so the match plays the
 * same with it or without it. The memory is plain data (it can be saved with a match).
 *
 *   const { memory, moments, fired } = update(memory, ball, state)
 *
 * `ball` and `state` are plain records (sim/memory-input.js builds them from a match). `fired` is every moment
 * this ball; `moments` is the one to announce (or none): the highest priority among those and the ones still
 * waiting from the last few balls. Each moment: { type, key, priority, payload, ball }.
 *
 * The detectors are small functions in families (turning points here, duels and let-offs in
 * sim/memory-duels.js, the chase and the phases in sim/memory-phases.js), each (memory, ball, state, emit).
 * They decide when a moment happens; emit() handles the rest the same for all of them: once per situation
 * (its key), a cooldown per type, and the waiting list.
 */

/** A ball that moves the batting side's chance of winning this much (0..1) is a turning point. */
export const TURN_SWING = 0.15;
/** A partnership that has moved it this much since it began, with at least STAND_MIN_RUNS, is swinging the match. */
export const STAND_SWING = 0.2;
export const STAND_MIN_RUNS = 20;

export function createMatchMemory() {
  return {
    /** Balls seen (the clock cooldowns and the waiting list run on). */
    ball: 0,
    innings: null,
    /** Bowler-batter duels across the match: key -> { balls, runs, dots, streak, beaten, dismissals, squeezes }. */
    duels: {},
    /** Let-offs still alive: { type, batter, team, scoreAt, ball }. */
    letoffs: [],
    /** The partnership in progress: { wkts, from (the chance of winning when it began) }. */
    stand: null,
    /** The chase's thresholds crossed (re-armed when the rate falls back), and how often each has been. */
    chase: { crossed: {}, crossings: {} },
    /** The conditions last seen. */
    seen: { ballNumber: null, ballOvers: 0, reversing: false, light: null },
    /** Moment keys already said (key -> ball), the ball each type last fired, and moments waiting to be said. */
    fired: {},
    lastOfType: {},
    queue: [],
  };
}

/** Turning points: one ball that swings the match, and a partnership that has. */
function detectSwings(mem, ball, state, emit) {
  const after = winProbability(state);
  const before = winProbability({
    ...state,
    runs: state.runs - ball.runs,
    wkts: state.wkts - (ball.wicket ? 1 : 0),
    legal: state.legal - (ball.legal ? 1 : 0),
  });
  const pct = (p) => Math.round(p * 100);
  if (Math.abs(after - before) >= TURN_SWING) {
    emit(MOMENT.TURNING_POINT, `${state.innings}:${state.legal}:${state.wkts}`, {
      team: state.batName ?? state.batTeam,
      before: pct(before),
      after: pct(after),
      swing: pct(Math.abs(after - before)),
      score: `${state.runs}/${state.wkts}`,
      toward: after > before ? "bat" : "bowl",
      b: ball.batterShort ?? ball.batter,
      w: ball.bowlerShort ?? ball.bowler,
    });
  }
  // A new partnership begins with the innings and after each wicket.
  if (!mem.stand || mem.stand.wkts !== state.wkts) mem.stand = { wkts: state.wkts, from: after };
  const moved = after - mem.stand.from;
  if (Math.abs(moved) >= STAND_SWING && state.partnership.runs >= STAND_MIN_RUNS) {
    emit(MOMENT.PARTNERSHIP_SWING, `${state.innings}:${state.wkts}`, {
      team: state.batName ?? state.batTeam,
      stand: state.partnership.runs,
      balls: state.partnership.balls,
      from: pct(mem.stand.from),
      to: pct(after),
      toward: moved > 0 ? "bat" : "bowl",
    });
  }
}

const DETECTORS = [detectSwings, ...DUEL_DETECTORS, ...PHASE_DETECTORS];

/** A copy of the memory to change: it's plain data. */
const copy = (memory) => JSON.parse(JSON.stringify(memory));

export function update(memory, ball, state) {
  const mem = copy(memory ?? createMatchMemory());
  mem.ball++;
  if (mem.innings !== state.innings) {
    // A new innings: a new partnership, a new chase, a new ball. Duels, let-offs and the light carry on.
    mem.innings = state.innings;
    mem.stand = null;
    mem.chase = { crossed: {}, crossings: {} };
    mem.seen = { ...mem.seen, ballNumber: null, ballOvers: 0, reversing: false };
  }
  const fired = [];
  /** `priority`: this one's, when it matters more than its type usually does. */
  const emit = (type, key, payload = {}, priority = null) => {
    const rule = MOMENT_RULES[type];
    const id = `${type}|${key}`;
    if (mem.fired[id] !== undefined) return false;
    if (mem.ball - (mem.lastOfType[type] ?? -Infinity) < rule.cooldown) return false;
    mem.fired[id] = mem.ball;
    mem.lastOfType[type] = mem.ball;
    fired.push({ type, key: id, priority: priority ?? rule.priority, payload, ball: mem.ball });
    return true;
  };
  for (const detect of DETECTORS) detect(mem, ball, state, emit);
  // The one to say: the best of this ball's and those still waiting; the rest wait, if they may.
  const waiting = mem.queue.filter((m) => mem.ball - m.ball <= MOMENT_RULES[m.type].keep);
  const candidates = [...fired, ...waiting].sort((a, b) => b.priority - a.priority || b.ball - a.ball);
  const moments = candidates.slice(0, 1);
  mem.queue = candidates.slice(1).filter((m) => MOMENT_RULES[m.type].keep > 0 && mem.ball - m.ball < MOMENT_RULES[m.type].keep);
  return { memory: mem, moments, fired };
}
