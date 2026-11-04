import { rollWeather } from "./weather.js";
import { clamp } from "../math.js";
import { showerComes, testOversLost } from "./rain.js";

/**
 * Test cricket: five days of 90 overs, two innings a side, the follow-on, declarations and the draw. The
 * Match (sim/match.js) plays the balls; this keeps the clock and decides who bats next and who won.
 */

export const TEST_DAYS = 5;
export const DAY_OVERS = 90;
/** A lead after the first two innings big enough to make the other side follow on. */
export const FOLLOW_ON_LEAD = 200;
/** Pitch wear per over in a Test, against a limited-overs game's (so a normal pitch is worn, not dust, by day 5). */
export const TEST_WEAR = 0.6;
/**
 * How the computer bats in a Test (sim/ai.js): with less aggression, and a sharper read and timing than in an
 * untimed limited-overs innings, so a wicket costs about 55 balls rather than 35 (tools/test-report.mjs). A
 * chase needing more than `drawRate` an over is given up: they bat for the draw (`forDraw` aggression).
 */
export const TEST_BATTING = { caution: 0.3, read: 0.5, timing: 0.5, drawRate: 5.5, forDraw: -0.3 };

/** The match clock: the day, overs bowled today, today's weather, and how many overs rain has cost. */
export class TestClock {
  day = 1;
  today = 0;

  constructor(rng, ground) {
    this.rng = rng;
    this.ground = ground;
    this.startDay(null);
  }

  /** A new day's weather, and the overs it leaves (rain at the start of play costs a share of them). */
  startDay(yesterday) {
    this.weather = rollWeather(this.rng, this.ground, yesterday);
    this.lostToday = Math.round(this.weather.lost * DAY_OVERS);
    this.quota = DAY_OVERS - this.lostToday;
    this.lunch = false;
    this.tea = false;
  }

  /** Overs still to come in the match, if no more are lost. */
  get oversLeft() {
    return Math.max(0, this.quota - this.today) + (TEST_DAYS - this.day) * DAY_OVERS;
  }

  /** Has time run out? */
  get finished() {
    return this.day >= TEST_DAYS && this.today >= this.quota;
  }

  /** Which session it is: 0 morning, 1 afternoon (after lunch), 2 evening (after tea). */
  get session() {
    return this.tea ? 2 : this.lunch ? 1 : 0;
  }

  /**
   * An over has been bowled: "lunch", "tea" or "stumps" if that brings a break (stumps starts the next day
   * and rolls its weather straight away, so a simulated day plays as a watched one), else null.
   */
  overBowled() {
    this.today++;
    if (this.today >= this.quota) {
      if (this.day >= TEST_DAYS) return "stumps";
      this.day++;
      this.today = 0;
      this.startDay(this.weather);
      return "stumps";
    }
    // Lunch and tea split the day's overs in three (later, if rain has cut the day short).
    if (!this.lunch && this.today >= Math.round(this.quota / 3)) {
      this.lunch = true;
      return "lunch";
    }
    if (!this.tea && this.today >= Math.round((2 * this.quota) / 3)) {
      this.tea = true;
      return "tea";
    }
    return null;
  }

  /** Rain stops play: up to `overs` come off today. { lost, dayOver }: a long enough stoppage ends the day. */
  loseOvers(overs) {
    const lost = Math.max(0, Math.min(overs, this.quota - this.today));
    this.quota -= lost;
    this.lostToday += lost;
    const dayOver = this.today >= this.quota;
    if (dayOver && this.day < TEST_DAYS) {
      this.day++;
      this.today = 0;
      this.startDay(this.weather);
    }
    return { lost, dayOver };
  }
}

/**
 * An over has ended in a Test: tick the clock, perhaps stop for rain, rest the bowlers over a break, bring
 * in the new day's weather, shorten the innings to the time that's left, and let a computer side batting
 * declare. Sets `applied.testBreak` ("lunch", "tea", "stumps" or null) and `applied.rain` ({ lost, dayOver }).
 */
export function testOverEnded(match, applied) {
  const { clock, inn } = match;
  const brk = clock.overBowled();
  const day = clock.day;
  if (brk !== "stumps" && !clock.finished && showerComes(match)) applied.rain = clock.loseOvers(testOversLost(match.rng));
  const newDay = clock.day !== day || brk === "stumps";
  if (brk || applied.rain) restBowlers(inn, newDay ? 1 : 0.4);
  if (newDay && !clock.finished) match.pitch.weather = match.weather = clock.weather;
  inn.oversLimit = Math.floor(inn.legal / 6) + clock.oversLeft;
  if (!inn.isOver && match.human !== "bat" && declareAdvised(match)) inn.declared = true;
  applied.testBreak = brk;
  applied.inningsOver = inn.isOver;
}

/** A break: the bowlers get back `share` of what they'd lost and start fresh spells. */
function restBowlers(inn, share) {
  for (const b of inn.bowl) {
    b.stamina = clamp(b.stamina + share * (1 - b.stamina));
    b.spell = 0;
  }
}

/**
 * Start the next innings of a Test. `enforce` is the player's follow-on call when it's theirs to make;
 * otherwise (or with no call given) the captain with the choice decides.
 */
export function testNextInnings(match, enforce) {
  const option = followOnOption(match);
  const call = !!option && (enforce ?? aiEnforces(match, option));
  const { bat, bowl, target } = nextTestInnings(match, call);
  match.human = bat === match.humanTeam ? "bat" : "bowl";
  match.followedOn = match.followedOn || call;
  match.beginInnings(bat, bowl, target);
}

/** Each side's runs so far, over all its innings: Map(team -> runs). */
function totals(match) {
  const runs = new Map();
  for (const inn of match.innings) runs.set(inn.batTeam, (runs.get(inn.batTeam) ?? 0) + inn.runs);
  return runs;
}

/** How far `team` is ahead of the other side on runs so far (negative if behind). */
export function leadOf(match, team) {
  const runs = totals(match);
  const other = match.innings.find((i) => i.batTeam !== team)?.batTeam;
  return (runs.get(team) ?? 0) - (other ? (runs.get(other) ?? 0) : 0);
}

/** After the first two innings: can the side that batted first make the other follow on, and by how much do they lead? */
export function followOnOption(match) {
  if (match.innings.length !== 2 || !match.inn.isOver) return null;
  const first = match.innings[0].batTeam;
  const lead = leadOf(match, first);
  return lead >= FOLLOW_ON_LEAD ? { lead, captain: first } : null;
}

/** The computer captain's call on the follow-on: enforce with a big lead, or when time's short. */
export function aiEnforces(match, option) {
  return option.lead >= 250 || match.clock.oversLeft <= 230;
}

/** Should the side batting declare now? (The computer does; a player batting is offered it.) */
export function declareAdvised(match) {
  const inn = match.inn;
  const n = match.innings.length;
  if (inn.isOver || inn.wkts >= 9) return false;
  const left = match.clock.oversLeft;
  if (n <= 2) return inn.runs >= 560 && left >= 120;
  if (n === 3) {
    const lead = leadOf(match, inn.batTeam);
    return lead >= 450 || (lead >= 250 && left <= 130) || (lead >= 180 && left <= 70);
  }
  return false;
}

/** Who bats next (the follow-on decided), and the target if it's the last innings. */
export function nextTestInnings(match, enforce) {
  const n = match.innings.length;
  const last = match.inn;
  const bat = n === 2 && enforce ? last.batTeam : last.bowlTeam;
  const bowl = bat === last.batTeam ? last.bowlTeam : last.batTeam;
  const target = n === 3 ? Math.max(1, -leadOf(match, bat) + 1) : null;
  return { bat, bowl, target };
}

/** Is the match decided before a fourth innings (the side batting twice running still behind: an innings win)? */
export function inningsWin(match) {
  // Bowled out: time running out (or a declaration) leaves it a draw or a chase.
  if (match.innings.length !== 3 || match.inn.wkts < 10) return null;
  const inn = match.inn;
  const behind = -leadOf(match, inn.batTeam);
  // Only a side that followed on can lose by an innings: it has batted twice to the other's once.
  const twice = match.innings.filter((i) => i.batTeam === inn.batTeam).length === 2;
  if (!twice || behind <= 0 || match.innings[2].batTeam !== match.innings[1].batTeam) return null;
  const text = `${inn.bowlTeam.name} win by an innings and ${behind} run${behind === 1 ? "" : "s"}`;
  return { winner: inn.bowlTeam, text, kind: "innings", margin: behind };
}

/**
 * The Test's result, or null while it's still on: { winner (null for a tie or draw), text, kind ("innings",
 * "wkts", "runs", "tie" or "draw"), margin, draw }.
 */
export function testResult(match) {
  const early = inningsWin(match);
  if (early) return early;
  const inn = match.inn;
  if (match.innings.length === 4 && inn.isOver) {
    if (inn.chaseWon) {
      const left = 10 - inn.wkts;
      const text = `${inn.batTeam.name} win by ${left} wicket${left === 1 ? "" : "s"}`;
      return { winner: inn.batTeam, text, kind: "wkts", margin: left };
    }
    if (inn.wkts >= 10) {
      const margin = inn.target - 1 - inn.runs;
      if (margin === 0) return { winner: null, text: "Match tied", kind: "tie", margin: 0 };
      const text = `${inn.bowlTeam.name} win by ${margin} run${margin === 1 ? "" : "s"}`;
      return { winner: inn.bowlTeam, text, kind: "runs", margin };
    }
  }
  if (match.clock.finished && inn.isOver) return { winner: null, draw: true, text: "Match drawn", kind: "draw", margin: 0 };
  return null;
}

const SESSIONS = ["MORNING", "AFTERNOON", "EVENING"];

/** The score bar's line on the state of a Test: the day, and the lead, or the chase and the time left. */
export function testStatus(match) {
  const { clock, inn } = match;
  const day = `DAY ${clock.day}`;
  if (inn.target !== null) return `${day}  NEED ${inn.runsNeeded} IN ${clock.oversLeft} OV`;
  if (match.innings.length === 1) return `${day}  ${SESSIONS[clock.session]}`;
  const lead = leadOf(match, inn.batTeam);
  return `${day}  ${lead > 0 ? `LEAD BY ${lead}` : lead < 0 ? `TRAIL BY ${-lead}` : "SCORES LEVEL"}`;
}
