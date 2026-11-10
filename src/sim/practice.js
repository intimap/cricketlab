import { isSpinner } from "./teams.js";
import { PITCH_TYPES, Pitch } from "./conditions.js";
import { aimAllowance, expectedTurnAtBat, crossingAtZ } from "./delivery.js";
import { armOf } from "./bowling-side.js";
import { facingOf } from "./handedness.js";

/**
 * Practice (the nets): one squad, a batter and a bowler from it, and no overs or score. The batter stays on
 * strike, the bowler keeps bowling (never tiring, never warned for bouncers), and the ball and the pitch stay
 * as they were chosen. Batting, the player says what's bowled: over or around the wicket, the delivery, its
 * length and its line, each one fixed or RANDOM (RANDOM is what the bowler would choose in a match).
 *
 * settings: { batter, bowler (indexes into the squad), side, delivery, length, line }.
 */

export const PRACTICE_SIDES = ["random", "over", "around"];
export const PRACTICE_LENGTHS = ["random", "full", "good", "short"];
export const PRACTICE_LINES = ["random", "off", "stumps", "leg"];
export const PRACTICE_PITCHES = ["green", "dust", "cracked"];
export const PRACTICE_WORDS = {
  random: "RANDOM",
  over: "OVER THE WICKET",
  around: "AROUND THE WICKET",
  full: "FULL",
  good: "GOOD LENGTH",
  short: "SHORT",
  off: "OUTSIDE OFF",
  stumps: "AT THE STUMPS",
  leg: "LEG SIDE",
};

/** Where each length pitches (m from his stumps), for a quick and for a spinner. */
const LENGTHS = { full: { pace: 3.4, spin: 3.0 }, good: { pace: 6.3, spin: 5.2 }, short: { pace: 9.2, spin: 7.4 } };
/** Where each line reaches his stumps (m, + his off side). */
const LINES = { off: 0.3, stumps: 0.03, leg: -0.2 };
/** His stock line (m at the stumps) for a delivery he hadn't planned, and how much it varies (sd, m). */
const STOCK_LINE = { pace: 0.2, spin: 0.1 };
const STOCK_SD = 0.08;
/** How far the bowler strays from what's asked, ball to ball (sd, m), before his own release error. */
const LENGTH_SD = 0.35;
const LINE_SD = 0.04;
/** Aiming (see aimFor): corrections after the first two tries, and how far apart those two are aimed (m). */
const AIM_TRIES = 2;
const AIM_PROBE = 0.1;
/** Dice that always come up average: where a ball goes with nothing going wrong. */
const AVERAGE = {
  next: () => 0.5,
  range: (lo, hi) => (lo + hi) / 2,
  normal: (mean = 0) => mean,
  chance: () => false,
  pick: (items) => items[0],
  state: 0,
};
/** Deliveries with a length of their own, and the line he bowls them at unless asked for another. */
const OWN_LENGTH = { bouncer: { length: 11, line: -0.05 }, yorker: { length: 1.9, line: 0.02 } };

/** The squad's bowlers (indexes): players with a bowling style. */
export const bowlersOf = (team) => team.players.flatMap((p, i) => (p.bowl ? [i] : []));

/** What a bowler can be asked for: RANDOM, then his deliveries. */
export const deliveriesOf = (player) => ["random", ...(player?.bowl?.repertoire ?? [])];

/** A new session: the opener against the squad's last bowler (its spearhead or its spinner), all RANDOM. */
export function practiceDefaults(team) {
  return { batter: 0, bowler: bowlersOf(team).at(-1) ?? 0, side: "random", delivery: "random", length: "random", line: "random" };
}

/** Settings made good for this squad: a batter in it, a bowler who bowls (not the batter too), his deliveries. */
export function fixPractice(settings, team) {
  const s = { ...practiceDefaults(team), ...settings };
  const n = team.players.length;
  if (!(s.batter >= 0 && s.batter < n)) s.batter = 0;
  const bowlers = bowlersOf(team).filter((i) => i !== s.batter);
  if (!bowlers.includes(s.bowler)) s.bowler = bowlers.at(-1) ?? 0;
  if (!PRACTICE_SIDES.includes(s.side)) s.side = "random";
  if (!deliveriesOf(team.players[s.bowler]).includes(s.delivery)) s.delivery = "random";
  if (!PRACTICE_LENGTHS.includes(s.length)) s.length = "random";
  if (!PRACTICE_LINES.includes(s.line)) s.line = "random";
  return s;
}

const step = (list, value, dir) => list[(list.indexOf(value) + dir + list.length) % list.length];

/**
 * The settings with `key` moved one way (`dir` +1 or -1): the next batter (not the bowler), the next bowler
 * (not the batter), or the next side, delivery, length or line. Pure: the scene sends the result in an action.
 */
export function stepPractice(settings, key, dir, team) {
  const s = { ...settings };
  if (key === "batter") {
    const others = team.players.map((_, i) => i).filter((i) => i !== s.bowler || i === s.batter);
    s.batter = step(others, s.batter, dir);
  } else if (key === "bowler") {
    const bowlers = bowlersOf(team).filter((i) => i !== s.batter || i === s.bowler);
    s.bowler = step(bowlers, s.bowler, dir);
  } else if (key === "side") s.side = step(PRACTICE_SIDES, s.side, dir);
  else if (key === "delivery") s.delivery = step(deliveriesOf(team.players[s.bowler]), s.delivery, dir);
  else if (key === "length") s.length = step(PRACTICE_LENGTHS, s.length, dir);
  else if (key === "line") s.line = step(PRACTICE_LINES, s.line, dir);
  return fixPractice(s, team);
}

/** The innings' bowler list index for a squad player. */
const bowlIndex = (inn, squadIndex) =>
  Math.max(
    0,
    inn.bowl.findIndex((b) => b.p === inn.bowlTeam.players[squadIndex]),
  );

/**
 * Start (or change) a practice session on `match`: its settings, and the batter and bowler in place. `pitch`
 * (an id) relays the pitch.
 */
export function setPractice(match, settings, pitch = null) {
  match.practice = fixPractice(settings, match.inn.batTeam);
  if (pitch && PITCH_TYPES[pitch] && pitch !== match.pitch.type.id) {
    match.pitch = new Pitch(PITCH_TYPES[pitch]);
    match.inn.pitch = match.pitch;
  }
  match.startOver(bowlIndex(match.inn, match.practice.bowler));
  keepPractice(match);
}

/** After every ball: the same batter on strike, the same bowler fresh at the end, no pressure, no new over. */
export function keepPractice(match) {
  const inn = match.inn;
  const { batter, bowler } = match.practice;
  inn.striker = batter;
  inn.nonStriker = batter === 0 ? 1 : 0;
  inn.bat[batter].batted = true;
  const b = bowlIndex(inn, bowler);
  if (inn.currentBowler !== b) inn.setBowler(b);
  inn.bowl[b].stamina = 1;
  inn.bowl[b].suspended = false;
  inn.pressure = 0;
  match.needOver = false;
}

/**
 * The ball the practice bowler sends down: the computer's plan for him (`plan`, from sim/ai.js) with what the
 * player has asked for. The line is where it reaches the batter: the bowler allows for his angle, his turn
 * and a left-hander, as the keeper's advice does.
 */
export function practicePlan(match, plan, rng) {
  const inn = match.inn;
  const s = match.practice;
  const skills = inn.bowler.p.bowl;
  const spin = isSpinner(skills);
  const planned = plan.intent;
  let type = planned.type;
  // A delivery asked for; or, at RANDOM with a length asked for, not one that has its own.
  if (s.delivery !== "random") type = s.delivery;
  else if (s.length !== "random" && OWN_LENGTH[type]) type = skills.repertoire.find((t) => !OWN_LENGTH[t]) ?? type;
  const own = OWN_LENGTH[type];
  let length = planned.length;
  if (own) length = own.length;
  else if (s.length !== "random") length = LENGTHS[s.length][spin ? "spin" : "pace"] + rng.normal(0, LENGTH_SD);
  // He'd planned a bouncer or a yorker, and it's something else now: a good length.
  else if (OWN_LENGTH[planned.type]) length = LENGTHS.good[spin ? "spin" : "pace"] + rng.normal(0, LENGTH_SD);
  const effort = type === "bouncer" ? "high" : planned.effort;
  const wicketSide = s.side === "random" ? (rng.chance(0.5) ? "over" : "around") : s.side;
  const intent = { type, length, effort, wicketSide };
  // The line it reaches him on: asked for, a bouncer's or yorker's own, his stock line for a ball he hadn't
  // planned (the plan's line allows for that ball's turn), or the plan's.
  let reach = null;
  if (s.line !== "random") reach = LINES[s.line] + rng.normal(0, LINE_SD);
  else if (own) reach = own.line;
  else if (type !== planned.type) reach = STOCK_LINE[spin ? "spin" : "pace"] + rng.normal(0, STOCK_SD);
  const flip = facingOf(inn.bat[inn.striker].p) * armOf(skills);
  const base = reach === null ? planned.line : reach - expectedTurnAtBat(intent, skills, inn.ball, inn.pitch);
  const guess = base + aimAllowance(intent, skills, inn.ball, inn.pitch, flip, wicketSide);
  // A line asked for is where it reaches his stumps, swing, seam, turn and angle allowed for.
  const line = reach === null ? guess : aimFor(match, intent, reach, guess);
  return { ...plan, intent: { ...intent, line } };
}

/**
 * The line to aim (striker's frame) for the ball to reach his stumps at `reach`: bowled with average dice,
 * where it goes, and the aim moved by the miss over how much the aim moves it (a short ball's line spreads
 * further than a full one's). Nothing about the match changes (the stamina it spends is given back).
 */
function aimFor(match, intent, reach, guess) {
  const bowler = match.inn.bowler;
  const { rng } = match;
  const stamina = bowler.stamina;
  const arrives = (line) => crossingAtZ(match.deliver({ ...intent, line }, 0).samples, 0)?.x ?? null;
  let line = guess;
  try {
    match.rng = AVERAGE;
    let at = arrives(line);
    const probe = arrives(line + AIM_PROBE);
    if (at === null || probe === null || Math.abs(probe - at) < 1e-3) return guess;
    const slope = (probe - at) / AIM_PROBE;
    for (let i = 0; i < AIM_TRIES && at !== null; i++) {
      line += (reach - at) / slope;
      at = i + 1 < AIM_TRIES ? arrives(line) : null;
    }
  } finally {
    match.rng = rng;
    bowler.stamina = stamina;
  }
  return line;
}
