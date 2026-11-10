import { Match } from "./match.js";
import { australia, england } from "./teams.js";
import { TEAMS } from "./team-list.js";
import { rollWeather } from "./weather.js";
import { setPractice } from "./practice.js";

/**
 * How a game is played, as data:
 *   test    - two innings each over five days of 90 overs: a win, or a draw if time runs out
 *   match   - both sides bat the same overs; the second chases a target
 *   classic - a set piece dropped into the closing stages of a chase
 *   nets    - endless practice: no innings to lose, a coach's verdict on every ball
 *
 * Classic Matches are pure data, so new ones (and their difficulty) can be
 * added or tuned without touching the game code. Each one sets:
 *   human     "bat" or "bowl"
 *   batting   who is chasing: "aus" or "eng"
 *   pitch     pitch type id
 *   overs     the innings length, e.g. 50
 *   start     where the chase stands: { overs, runs, wkts }
 *   target    runs needed to win the match
 *
 * Targets were set against AI-vs-AI runs of each situation (the AI chaser wins
 * roughly 30-40%), nudged towards the dramatic. Re-check them with
 * tools/sim-report.mjs-style runs whenever batting balance changes.
 */
export const FORMATS = {
  test: { name: "TEST MATCH", innings: 4, blurb: "FIVE DAYS, TWO INNINGS EACH. BOWL THEM OUT TWICE TO WIN." },
  match: { name: "FULL MATCH", innings: 2, blurb: "BOTH SIDES BAT. THE SECOND CHASES THE TOTAL." },
  classic: { name: "CLASSIC MATCHES", innings: 1, blurb: "WIN FROM A TIGHT SPOT." },
  nets: { name: "NETS", innings: 1, blurb: "PRACTICE AS LONG AS YOU LIKE. THE COACH RATES EVERY BALL." },
};

export const CLASSICS = [
  {
    id: "lastOver",
    title: "THE LAST-OVER THRILLER",
    blurb: "NINE OFF THE LAST OVER. TWO WICKETS LEFT. THE CROWD IS ON ITS FEET.",
    human: "bat",
    batting: "aus",
    pitch: "green",
    overs: 50,
    start: { overs: 49, runs: 229, wkts: 8 },
    target: 238,
  },
  {
    id: "tailRescue",
    title: "TAIL-END RESCUE",
    blurb: "17 NEEDED OFF 5 OVERS, SEVEN DOWN. PROTECT THE TAIL OR GO FOR IT?",
    human: "bat",
    batting: "aus",
    pitch: "cracked",
    overs: 50,
    start: { overs: 45, runs: 197, wkts: 7 },
    target: 214,
  },
  {
    id: "bigChase",
    title: "THE BIG CHASE",
    blurb: "64 OFF 20 OVERS ON A CRUMBLING DECK. THREE DOWN. TIME TO BUILD.",
    human: "bat",
    batting: "aus",
    pitch: "dust",
    overs: 50,
    start: { overs: 30, runs: 156, wkts: 3 },
    target: 220,
  },
  {
    id: "defend12",
    title: "DEFEND TWELVE",
    blurb: "ENGLAND NEED 12 OFF 2 OVERS WITH FOUR WICKETS LEFT. HOLD YOUR NERVE.",
    human: "bowl",
    batting: "eng",
    pitch: "green",
    overs: 50,
    start: { overs: 48, runs: 226, wkts: 6 },
    target: 238,
  },
  {
    id: "spinToWin",
    title: "SPIN TO WIN",
    blurb: "A DUSTBOWL. ENGLAND NEED 27 OFF 8, FIVE DOWN. TOSS IT UP.",
    human: "bowl",
    batting: "eng",
    pitch: "dust",
    overs: 50,
    start: { overs: 42, runs: 201, wkts: 5 },
    target: 228,
  },
  {
    id: "rollThemOver",
    title: "ROLL THEM OVER",
    blurb: "ENGLAND ARE 6 DOWN AND NEED 29 OFF 10. FOUR MORE WICKETS WINS IT.",
    human: "bowl",
    batting: "eng",
    pitch: "cracked",
    overs: 50,
    start: { overs: 40, runs: 181, wkts: 6 },
    target: 210,
  },
];

/** Nets go on as long as you like. */
const NETS_OVERS = 9999;

/**
 * Practice: one squad (cfg.team) at both ends, the batter and bowler from cfg.practice (sim/practice.js), and
 * the player batting or bowling (cfg.mode).
 */
function practiceMatch(cfg, rng) {
  const squad = TEAMS[cfg.team] ?? australia;
  const match = new Match(squad(), squad(), cfg.pitch, NETS_OVERS, rng, cfg.mode, { nets: true });
  setPractice(match, cfg.practice ?? {});
  return match;
}

/** Overs choices on the menu, per format. */
export const OVERS_CHOICES = { match: [5, 10, 20, 50] };

/** The fewest overs rain can leave a limited-overs game (a shorter game than that isn't cut). */
const MIN_RAIN_OVERS = 5;

/**
 * Build the Match for a menu choice:
 * cfg = { format, mode ("bat"/"bowl"), pitch, overs, classic (id), ground (id), team, opponent }.
 * Matches get the day's weather (sim/weather.js); rain before the start cuts a limited-overs game's overs.
 */
export function createMatch(cfg, rng) {
  const aus = australia();
  const eng = england();
  if (cfg.format === "classic") {
    const c = CLASSICS.find((x) => x.id === cfg.classic) ?? CLASSICS[0];
    const [bat, bowl] = c.batting === "aus" ? [aus, eng] : [eng, aus];
    return new Match(bat, bowl, c.pitch, c.overs, rng, c.human, { start: c.start, target: c.target });
  }
  // The player's side (cfg.team) and the other (cfg.opponent), by abbreviation (sim/team-list.js).
  const mine = (TEAMS[cfg.team] ?? australia)();
  const theirs = (TEAMS[cfg.opponent] ?? england)();
  const [bat, bowl] = cfg.mode === "bat" ? [mine, theirs] : [theirs, mine];
  if (cfg.format === "nets") return practiceMatch(cfg, rng);
  if (cfg.format === "test") return new Match(bat, bowl, cfg.pitch, 0, rng, cfg.mode, { test: true, ground: cfg.ground });
  const weather = rollWeather(rng, cfg.ground);
  const overs = Math.max(Math.min(cfg.overs, MIN_RAIN_OVERS), Math.round(cfg.overs * (1 - weather.lost)));
  const match = new Match(bat, bowl, cfg.pitch, overs, rng, cfg.mode, { innings: FORMATS[cfg.format]?.innings ?? 1, weather });
  /** Overs the rain took before the start (the weather report says so). */
  match.oversLost = cfg.overs - overs;
  return match;
}
