import { MOMENT } from "./memory-moments.js";

/**
 * The match memory's duels and let-offs (sim/match-memory.js). A duel is one bowler against one batter across
 * the whole match (both innings of a Test): balls, runs, dots, the dots in a row, times beaten and dismissals.
 * A let-off (a drop, a missed run-out, a review the bowlers lost) is remembered until the batter is out, and
 * what it has cost is told as it grows.
 */

/** Beaten this many times by the same bowler (and again at each multiple). */
export const BEATEN_TIMES = 3;
/** This many runs off one bowler (each multiple), from at least DOMINANCE_BALLS, at DOMINANCE_RATE or more. */
export const DOMINANCE_RUNS = 25;
export const DOMINANCE_BALLS = 10;
export const DOMINANCE_RATE = 1.5;
/** Dots in a row from one bowler to one batter. */
export const SQUEEZE_DOTS = 8;
/** A let-off's cost is told at each of these runs since. */
export const LETOFF_STEPS = [20, 50];

/** One duel's identity: the batter and the bowler, each with his side. */
const duelKey = (ball, state) => `${state.batTeam}:${ball.batter}|${state.bowlTeam}:${ball.bowler}`;

function detectDuels(mem, ball, state, emit) {
  if (!ball.faced) return;
  const key = duelKey(ball, state);
  const d = (mem.duels[key] ??= { balls: 0, runs: 0, dots: 0, streak: 0, beaten: 0, dismissals: 0, squeezes: 0 });
  const dot = ball.legal && ball.batRuns === 0 && !ball.wicket;
  d.balls += ball.legal ? 1 : 0;
  d.runs += ball.batRuns;
  d.dots += dot ? 1 : 0;
  d.streak = dot ? d.streak + 1 : 0;
  const names = { b: ball.batterShort ?? ball.batter, w: ball.bowlerShort ?? ball.bowler };
  // Each milestone is keyed by the step reached: said once, and if a cooldown holds it back, tried again
  // while it's still true (the next time he's beaten, or scores).
  if (ball.beaten) {
    d.beaten++;
    const step = Math.floor(d.beaten / BEATEN_TIMES) * BEATEN_TIMES;
    if (step >= BEATEN_TIMES) emit(MOMENT.DUEL_BEATEN, `${key}:${step}`, { ...names, beaten: d.beaten, balls: d.balls });
  }
  if (ball.wicket?.byBowler && ball.wicket.batter === ball.batter) {
    d.dismissals++;
    if (d.dismissals >= 2) emit(MOMENT.DUEL_REPEAT_DISMISSAL, `${key}:${d.dismissals}`, { ...names, times: d.dismissals });
  }
  const step = Math.floor(d.runs / DOMINANCE_RUNS);
  if (step >= 1 && ball.batRuns > 0 && d.balls >= DOMINANCE_BALLS && d.runs >= DOMINANCE_RATE * d.balls)
    emit(MOMENT.DUEL_DOMINANCE, `${key}:${step}`, { ...names, runs: d.runs, balls: d.balls });
  if (d.streak === SQUEEZE_DOTS) {
    d.squeezes++;
    emit(MOMENT.DUEL_DOT_SQUEEZE, `${key}:${d.squeezes}`, { ...names, dots: d.streak });
  }
}

/** The let-off's words, for the lines. */
const LETOFF_WORDS = { drop: "THE DROP", missedRunOut: "THE MISSED RUN-OUT", wastedReview: "THE LOST REVIEW" };

/** A let-off that ends with him out, once it has cost something, is worth more than the wicket's own remark. */
export const LETOFF_ENDED_PRIORITY = 88;

function detectLetoffs(mem, ball, state, emit) {
  const told = (l, cost, nowOn, ended, key, priority = null) =>
    emit(
      MOMENT.LETOFF_COST,
      `${l.team}:${l.batter}:${l.ball}:${key}`,
      { b: l.short, letoff: LETOFF_WORDS[l.type], kind: l.type, fielder: l.fielder, droppedOn: l.scoreAt, nowOn, cost, ended },
      priority,
    );
  // Out: his let-offs are spent, and one that cost something is told one last time.
  if (ball.wicket) {
    const out = (l) => l.batter === ball.wicket.batter && l.team === state.batTeam;
    for (const l of mem.letoffs.filter(out)) {
      const cost = ball.batterScore - l.scoreAt;
      if (ball.wicket.batter === ball.batter && cost >= LETOFF_STEPS[0])
        told(l, cost, ball.batterScore, "yes", "out", LETOFF_ENDED_PRIORITY);
    }
    mem.letoffs = mem.letoffs.filter((l) => !out(l));
  }
  if (ball.letoff && !(ball.wicket && ball.wicket.batter === ball.batter)) {
    mem.letoffs.push({
      type: ball.letoff,
      batter: ball.batter,
      short: ball.batterShort ?? ball.batter,
      fielder: ball.fielder ?? null,
      team: state.batTeam,
      scoreAt: ball.batterScore - ball.batRuns,
      ball: mem.ball,
    });
  }
  for (const l of mem.letoffs) {
    if (l.batter !== ball.batter || l.team !== state.batTeam || ball.batRuns === 0) continue;
    const cost = ball.batterScore - l.scoreAt;
    for (const step of LETOFF_STEPS) if (cost >= step) told(l, cost, ball.batterScore, "no", step);
  }
}

export const DUEL_DETECTORS = [detectDuels, detectLetoffs];
