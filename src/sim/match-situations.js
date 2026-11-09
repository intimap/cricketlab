import { leadOf } from "./test-match.js";

/**
 * The match's own situations for the box (TODO: commentary): the end of a chase (the last two overs, the
 * last over, the last ball, scores level, a side closing it out), the tail wagging, and in a Test the lead
 * passed and batting for a draw. And at the start of an over: the powerplay, the first over of a Test day,
 * the follow-on, a nightwatchman, the push for a declaration. Read-only: options { topic, case, priority,
 * facts } for sim/booth-context.js and the over's start (sim/booth-editor.js).
 */

/** Overs in the fielding restrictions at the start of an innings. */
const POWERPLAY = { t20: 6, odi: 10 };
/** A chase's need against the balls left: easy, even or steep. */
const ease = (need, left) => (need <= left * 0.75 ? "easy" : need <= left * 1.5 ? "even" : "steep");

/** After the ball: the state of the match worth a word. */
export function matchSituations(rec, inn, match, format) {
  const out = [];
  const add = (topic, kase, priority, facts = {}) => out.push({ topic, case: kase, priority, facts });
  if (!inn || inn.isOver) return out;
  const chasing = inn.target !== null && inn.target !== undefined && inn.runsNeeded > 0 && format !== "test";
  if (chasing) {
    const need = inn.runsNeeded;
    const left = inn.ballsLeft;
    const facts = { need, left };
    if (left === 1) add("chaseLastBall", need <= 6 ? String(need) : "more", 96, facts);
    else if (need === 1 && left > 1) add("scoresLevel", null, 92, facts);
    else if (left <= 6) add("chaseLastOver", ease(need, left), 85, facts);
    else if (left <= 12) add("chaseLastTwo", ease(need, left), 75, facts);
    if (left <= 18 && need > 6 && need > left * 2.5) add("closingOut", null, 60, facts);
  }
  if (!rec.wicket && inn.wkts >= 7 && inn.partnership.runs >= 25) add("tailWagging", null, 50, { stand: inn.partnership.runs });
  if (match?.clock && match.innings.length >= 2) {
    const lead = leadOf(match, inn.batTeam);
    if (lead > 0 && lead - rec.total <= 0) add("leadPassed", null, 70, { lead });
    const last = match.innings.length === 4;
    const overs = match.clock.oversLeft;
    if (last && match.clock.day >= 5 && inn.runsNeeded > overs * 6 && rec.total === 0 && !rec.wicket)
      add("battingForDraw", null, 44, { left: overs });
  }
  return out;
}

/** At the start of an over: what's new about it, if anything (most important first). */
export function overStartSituations(inn, match, format) {
  const out = [];
  const add = (topic, kase, priority, facts = {}) => out.push({ topic, case: kase, priority, facts });
  if (!inn?.bowler) return out;
  const striker = inn.bat[inn.striker];
  if (format === "test" && match?.clock) {
    const clock = match.clock;
    if (match.followedOn && match.innings.length === 3 && inn.legal === 0)
      add("followOn", null, 80, { lead: Math.max(0, -leadOf(match, inn.batTeam)) });
    if (clock.today === 0 && clock.day > 1 && inn.legal > 0) add("firstOverOfDay", null, 70, { day: clock.day });
    const tail = inn.bat.indexOf(striker) >= 7;
    if (tail && striker.balls === 0 && inn.wkts <= 5 && clock.quota - clock.today <= 8) add("nightwatchman", null, 65);
    if (match.innings.length === 3 && !inn.declared) {
      const lead = leadOf(match, inn.batTeam);
      if (lead >= 250) add("declarationPush", null, 55, { lead });
    }
  } else if (POWERPLAY[format]) {
    if (inn.overNo === 0) add("powerplay", "start", 60, { overs: POWERPLAY[format] });
    else if (inn.overNo === POWERPLAY[format]) add("powerplay", "end", 60, { overs: POWERPLAY[format] });
  }
  return out.sort((a, b) => b.priority - a.priority);
}
