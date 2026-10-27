import { Match } from "./match.js";
import { australia, england } from "./teams.js";

/**
 * How a game is played, as data:
 *   spell   - one innings, then the scorecard (practice)
 *   match   - both sides bat the same overs; the second chases a target
 *   classic - a set piece dropped into the closing stages of a chase
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
  spell: { name: "SPELL", innings: 1, blurb: "ONE INNINGS. BAT OR BOWL A SPELL." },
  match: { name: "FULL MATCH", innings: 2, blurb: "BOTH SIDES BAT. THE SECOND CHASES THE TOTAL." },
  classic: { name: "CLASSIC MATCHES", innings: 1, blurb: "WIN FROM A TIGHT SPOT." },
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

/** Overs choices on the menu, per format. */
export const OVERS_CHOICES = { spell: [10, 20, 40, 90], match: [5, 10, 20, 50] };

/**
 * Build the Match for a menu choice:
 * cfg = { format, mode ("bat"/"bowl"), pitch, overs, classic (id) }.
 */
export function createMatch(cfg, rng) {
  const aus = australia();
  const eng = england();
  if (cfg.format === "classic") {
    const c = CLASSICS.find((x) => x.id === cfg.classic) ?? CLASSICS[0];
    const [bat, bowl] = c.batting === "aus" ? [aus, eng] : [eng, aus];
    return new Match(bat, bowl, c.pitch, c.overs, rng, c.human, { start: c.start, target: c.target });
  }
  const [bat, bowl] = cfg.mode === "bat" ? [aus, eng] : [eng, aus];
  return new Match(bat, bowl, cfg.pitch, cfg.overs, rng, cfg.mode, { innings: FORMATS[cfg.format]?.innings ?? 1 });
}
