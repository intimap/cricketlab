import { boothChat } from "./booth-chat.js";
import { BoothCaller } from "./booth-caller.js";
import { boothContext } from "./booth-context.js";
import { boothWords, safeBoothCalls, fillLine } from "./booth-policy.js";
import { voiceLines, exchangesFor, kindOf, formatOf } from "./lines.js";
import { SITUATIONS } from "./situations.js";
import { overStartSituations } from "./match-situations.js";
import { loggedBall, runupRead } from "./runup-reads.js";

/** Moments of the over itself: said as the over ends, before the recap (which otherwise keeps the second voice quiet). */
const OVER_MOMENTS = new Set(["maiden", "maidenAgain", "bigOver", "tightSpell", "equation"]);

/** Quiet outcomes, said calmly once a passage has gone quiet (no shouting over a run of dots). */
const CALM = new Set(["defend", "leave", "beaten", "miss", "pad", "stopped", "miscue", "edgeDot", "offCentreDot", "single"]);
const QUIET_PASSAGE = 6;
const calmly = (call) => ({ ...call, text: call.text.replace(/!+/g, ".").replace(/\.\./g, ".") });

/**
 * Who picks up each kind of remark (VOICES order: dry Bunnings, excitable Lorry, tactical Grog): Grog the
 * bowling, Lorry the shots, Bunnings the match, the players and the deadpan quips. If the favourite is
 * calling the over, the other voice in the box takes it in his own style.
 */
const LEAN = { bowling: 2, shot: 1, match: 0, players: 0, banter: 0 };
/** Remarks below this priority are everyday reads, said on most balls but not all. */
const EVERYDAY = 50;
/** Chance the box has an everyday word on a ball it could talk about. */
const TALK = 0.85;
/** No more than this many remarks of one kind in a row, unless it's notable (this priority or more). */
const KIND_RUN = 2;
const NOTABLE = 60;
/** A line said this match can come back, once its pool has run dry, this many balls later. */
const REUSE_AFTER = 30;
/** Chance of an exchange between overs, in a quiet passage (the recap said first). */
const BETWEEN_OVERS = 0.3;

/**
 * Stories told two ways share a cooldown: the match memory's let-off cost with the drop's cost, its powerplay
 * end with the over's opening word on it (and every chase topic with the others, by name).
 */
const SHARED = { letoffCost: "dropCost", phasePowerplayEnd: "powerplay:end" };
/** An over's opening word waits at least this many balls after the same story was told. */
const OVER_START_REST = 6;

/** The match memory's moments as the box's options (sim/match-memory.js), their payloads as the facts. */
const momentOptions = (moments) =>
  moments.map((m) => ({ topic: m.type, case: m.payload?.ahead, priority: m.priority, facts: m.payload, key: m.key }));

/** The situation and case an option's lines are under (the dot-pressure rungs are one situation). */
function situationOf(option) {
  const dots = /^dotPressure(\d+)$/.exec(option.topic);
  return dots ? { situation: "dotPressure", kase: dots[1] } : { situation: option.topic, kase: option.case ?? undefined };
}

/** A match's booth has its own topic and line memory, separate from the cricket RNG. */
export class BoothEditor {
  caller = new BoothCaller();
  ball = 0;
  quiet = 0;
  dots = 0;
  drops = [];
  /** When each line was last said (by its words), so none comes back until its pool runs dry. */
  saidAt = new Map();
  topics = new Map();
  lastTopic = null;
  kinds = [];
  innings = null;
  lastLegal = null;
  narrativeKeys = new Set();
  /** The over so far, for the run-up reads: its number and its balls. */
  overLog = { over: null, balls: [] };
  runupOver = null;
  /** Each batter's weakness the bowlers have read (sim/scouting.js), by batting index. */
  weak = new Map();
  /** The match memory's moments for the coming ball (Commentary.onMoments), used once. */
  moments = [];
  /** Moments that came on a ball the box spent recapping the over: offered once more, on the next ball. */
  carried = [];

  /**
   * The ball's calls: first the caller's (topic "ballCall", fitting `context.fitsCall`, the HUD line), then
   * the box's remarks from the other two voices (fitting `fits`): the over's recap, and one remark (or an
   * exchange between overs) at most.
   */
  edit(rec, hpd, names, rng, fits = () => true, context = {}) {
    const fitsCall = context.fitsCall ?? fits;
    let primary = this.caller.call(rec, hpd, names, rng, fitsCall);
    // Match the energy to the passage: a quiet spell gets quiet calls.
    if (primary && this.quiet >= QUIET_PASSAGE && CALM.has(primary.category)) primary = calmly(primary);
    this.remember(rec, context.inn);
    const recap =
      context.applied?.overEnded && context.commentary ? boothChat(context.commentary, context.inn, rng, { rec, fits, hpd }) : [];
    const overMoment = recap.length > 0 && OVER_MOMENTS.has(rec.moment?.kind) ? rec.moment.kind : null;
    const analysis = this.context(rec, hpd, names, rng, fits, {
      ...context,
      lead: (rec.over + 1) % 3,
      caller: rec.over % 3,
      silent: recap.length > 0 && !overMoment,
      only: overMoment,
    });
    let extra = analysis.calls;
    // A quiet over ends: after the recap, now and then the two in the box have a word with each other.
    if (recap.length && !overMoment && !rec.wicket && !rec.boundary && this.quiet >= 3 && rng.random() < BETWEEN_OVERS)
      extra = this.exchange("betweenOvers", undefined, rec.over % 3, rng, fits, hpd, formatOf(context.inn));
    const calls = overMoment ? [...extra, ...recap] : [...recap, ...extra];
    const called = primary ? safeBoothCalls([primary], hpd, fitsCall) : [];
    return { calls: [...called, ...safeBoothCalls(calls, hpd, fits)] };
  }

  /** The over so far (for the run-up reads) and each batter's read weakness. */
  remember(rec, inn) {
    if (this.overLog.over !== rec.over) this.overLog = { over: rec.over, balls: [] };
    const spinner = ["offspin", "legspin"].includes(inn?.bowl[rec.bowler]?.p.bowl?.style);
    if (rec.legal || rec.extra?.type === "nb") this.overLog.balls.push(loggedBall(rec, spinner));
    if (rec.scout && rec.scout.kind !== "weaknessHint") this.weak.set(rec.striker, rec.scout.how);
  }

  context(
    rec,
    hpd,
    names,
    rng,
    fits = () => true,
    {
      inn = null,
      match = null,
      beforePressure,
      lead = rec.over % 3,
      caller = null,
      narrative,
      light,
      silent = false,
      only = null,
    } = {},
  ) {
    this.ball++;
    if (inn !== this.innings) {
      this.narrativeKeys.clear();
      this.quiet = 0;
      this.dots = 0;
      this.drops = [];
      this.lastLegal = null;
      this.weak.clear();
      this.innings = inn;
    }
    // An AI-simulated passage is a gap in booth coverage, not a run of observed dots.
    if (inn && this.lastLegal !== null && inn.legal - (rec.legal ? 1 : 0) !== this.lastLegal) {
      this.quiet = 0;
      this.dots = 0;
    }
    this.lastLegal = inn?.legal ?? null;
    const quiet = rec.total <= 1 && !rec.wicket && !rec.boundary && !rec.extra?.type && !rec.dropped && !rec.nearRunout;
    this.quiet = quiet ? this.quiet + 1 : 0;
    this.dots = rec.total === 0 ? this.dots + 1 : 0;
    if (rec.dropped && !rec.freeHit && rec.extra?.type !== "nb" && inn) {
      this.drops.push({ batter: rec.striker, on: inn.bat[rec.striker].runs });
    }
    const moments = this.moments;
    this.moments = [];
    if (silent) {
      this.carried = moments.filter((m) => !m.carried).map((m) => ({ ...m, carried: true }));
      return { calls: [] };
    }
    const format = formatOf(inn);
    const chatty = rng.random() < TALK;
    const options = [
      ...boothContext(rec, inn, this, beforePressure, { narrative, light, match, format }),
      ...momentOptions(moments),
    ];
    options.sort((a, b) => b.priority - a.priority);
    for (const option of only ? options.filter((o) => o.topic === only) : options) {
      if (option.priority < EVERYDAY && !chatty) break;
      const { situation, kase } = situationOf(option);
      const sit = SITUATIONS[situation];
      if (!sit || (option.key && this.narrativeKeys.has(option.key))) continue;
      const rest = sit.rest ?? 12;
      const key = kase !== undefined ? `${situation}:${kase}` : situation;
      if (this.ball - (this.topics.get(key) ?? -Infinity) < rest) continue;
      // Closely related story names cannot evade a topic cooldown.
      const group = situation.startsWith("chase") ? "chase" : (SHARED[situation] ?? situation);
      if (this.ball - (this.topics.get(group) ?? -Infinity) < rest) continue;
      if (!option.key && option.topic === this.lastTopic && rest > 0) continue;
      const kind = kindOf(situation);
      if (option.priority < NOTABLE && this.kinds.length >= KIND_RUN && this.kinds.every((k) => k === kind)) continue;
      const facts = { b: names.batter, w: names.bowler, ...option.facts };
      const calls =
        situation === "lull" && exchangesFor("lull", undefined, { format }).length && rng.random() < 0.6
          ? this.exchange("lull", undefined, caller, rng, fits, hpd, format)
          : this.say(situation, kase, kind, facts, caller, rng, fits, hpd, format, option.priority, option.topic);
      if (!calls.length) continue;
      this.topics.set(key, this.ball);
      this.topics.set(group, this.ball);
      this.lastTopic = option.topic;
      this.kinds = [...this.kinds, kind].slice(-KIND_RUN);
      if (option.key) this.narrativeKeys.add(option.key);
      return { calls };
    }
    return { calls: [] };
  }

  /** One remark for a situation, from the voice its kind leans to (never the caller), or []. */
  say(situation, kase, kind, facts, caller, rng, fits, hpd, format, priority = 0, topic = situation) {
    const render = (text) => fillLine(text, facts).toUpperCase();
    const lines = voiceLines(situation, kase, { format, facts });
    const first = LEAN[kind] ?? 0;
    const voices = [first, (first + 1) % 3, (first + 2) % 3].filter((v) => v !== caller);
    // Each written line with its filled text; the memory is of the written line, whatever filled it.
    const usable = (who) =>
      lines[who]
        .map((line) => ({ key: boothWords(line), text: render(line) }))
        .filter(({ text }) => safeBoothCalls([{ who, text }], hpd, fits).length);
    // A line not yet said this match; once a voice's pool has run dry, its longest-unsaid line, if not too recent.
    for (const fresh of [true, false]) {
      for (const who of voices) {
        let choices = usable(who).filter(({ key }) => !this.saidAt.has(key));
        if (!fresh) {
          const old = usable(who).filter(({ key }) => this.ball - this.saidAt.get(key) > REUSE_AFTER);
          const oldest = Math.min(...old.map(({ key }) => this.saidAt.get(key)));
          choices = old.filter(({ key }) => this.saidAt.get(key) === oldest);
        }
        if (!choices.length) continue;
        const { key, text } = choices[Math.min(choices.length - 1, Math.floor(rng.random() * choices.length))];
        this.saidAt.set(key, this.ball);
        return [{ who, text, topic, priority }];
      }
    }
    return [];
  }

  /** An exchange between the voices for a situation, opened by one who isn't calling, or []. */
  exchange(situation, kase, caller, rng, fits, hpd, format) {
    const fresh = exchangesFor(situation, kase, { format }).filter(
      (turns) =>
        turns[0].who !== caller &&
        !this.saidAt.has(boothWords(turns[0].text)) &&
        safeBoothCalls(turns, hpd, fits).length === turns.length,
    );
    if (!fresh.length) return [];
    const turns = fresh[Math.min(fresh.length - 1, Math.floor(rng.random() * fresh.length))];
    this.saidAt.set(boothWords(turns[0].text), this.ball);
    return turns.map(({ who, text }) => ({ who, text: text.toUpperCase(), topic: situation, priority: 10 }));
  }

  /**
   * As the bowler runs in: a word on the pattern of the over so far, a field change or a read weakness, at
   * most once an over, never from the caller. `inn` is the innings about to bowl the ball.
   */
  runup(inn, { caller, rng, fits = () => true, fieldChanged = false } = {}) {
    if (!inn || this.runupOver === inn.overNo) return null;
    const log = this.overLog.over === inn.overNo ? this.overLog.balls : [];
    // A weakness is worth a word only against the bowling that finds it: spin for spin, pace for the rest.
    const spinner = ["offspin", "legspin"].includes(inn.bowler?.p.bowl?.style);
    const how = this.weak.get(inn.striker) ?? null;
    const weakness = how && (/OFF STUMP/.test(how) || /SPINNER/.test(how) === spinner) ? how : null;
    const read = runupRead(log, { fieldChanged, weakness });
    if (!read) return null;
    const key = `runupRead:${read.case}`;
    if (this.ball - (this.topics.get(key) ?? -Infinity) < (read.case === "weakness" ? 30 : 12)) return null;
    const facts = { b: inn.bat[inn.striker]?.p.short, w: inn.bowler?.p.short, ...read.facts };
    const [call] = this.say("runupRead", read.case, "bowling", facts, caller, rng, fits, "", formatOf(inn), 40);
    if (!call) return null;
    this.topics.set(key, this.ball);
    this.runupOver = inn.overNo;
    return call;
  }

  /** At the start of an over: a remark on what's new about it (the powerplay, a Test day...), or null. */
  overStart(inn, match, { caller, rng, fits = () => true } = {}) {
    const format = formatOf(inn);
    for (const option of overStartSituations(inn, match, format)) {
      const rest = Math.max(OVER_START_REST, SITUATIONS[option.topic]?.rest ?? 0);
      const key = option.case !== undefined && option.case !== null ? `${option.topic}:${option.case}` : option.topic;
      if (this.ball - (this.topics.get(key) ?? -Infinity) < rest) continue;
      const facts = { b: inn.bat[inn.striker]?.p.short, w: inn.bowler?.p.short, ...option.facts };
      const kind = kindOf(option.topic);
      const [call] = this.say(
        option.topic,
        option.case ?? undefined,
        kind,
        facts,
        caller,
        rng,
        fits,
        "",
        format,
        option.priority,
      );
      if (!call) continue;
      this.topics.set(key, this.ball);
      return call;
    }
    return null;
  }
}
