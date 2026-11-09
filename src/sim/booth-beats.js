import { lengthName, lineName } from "./delivery.js";
import { readField } from "./field-reading.js";
import { shotArea } from "./describe.js";
import { anyLines, byCase, voiceLines } from "./lines.js";

/**
 * The box's calls around the ball itself, in the broadcast's rhythm: the start of the over (the
 * bowler, his figures, why he's on, the new ball, the phase of the innings, the field), the setup as
 * he runs in, and the delivery as it reaches the bat. The result and the reset after it come from
 * booth-editor.js. Wording only: everything here reads the innings and the ball, and decides nothing.
 *
 * `pick(list)` chooses a line (presentation randomness from the scene, never the match's rng).
 * Voice order throughout: dry Bunnings, excitable Lorry, tactical Grog.
 */

const ORDINAL = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH"];
const nth = (n) => ORDINAL[n - 1] ?? `${n}TH`;
const isSpin = (style) => style === "offspin" || style === "legspin";

// --- Setup: the bowler running in. ---

const SETUP = voiceLines("setup");
const SETUP_SPIN = voiceLines("setupSpin");
const AROUND = anyLines("setupAround");

/** The run-up line: { w, b, end, spin, around }. */
export function setupCall(who, facts, pick) {
  const pool = facts.around && pick([true, false, false]) ? AROUND : (facts.spin ? SETUP_SPIN : SETUP)[who];
  return fill(pick(pool), facts);
}

// --- Delivery: what he bowled, called as it reaches the bat (never before the batter has played it). ---

const LENGTH = byCase("length");
const SPIN_LENGTH = byCase("spinLength");
const LINE = byCase("line");
const VARIATION = byCase("deliveryName");

/** The delivery line: { type, pitchZ, line, spin }, as the ball reaches the bat. */
export function deliveryCall(d, pick) {
  const length = lengthName(d.pitchZ, d.spin);
  const parts = [];
  if (VARIATION[d.type] && pick([true, true, false])) parts.push(pick(VARIATION[d.type]));
  if (d.type !== "bouncer" || !parts.length) parts.push(pick((d.spin ? SPIN_LENGTH : LENGTH)[length]));
  parts.push(pick(LINE[lineName(d.line)]));
  return parts.join(", ") + " --";
}

// --- The shot: called the moment he plays it, before anyone knows where it ends up. ---

/** The stroke's verb, from its name (batting.js shotName). */
const VERB = [
  [/switch/, "SWITCH-HIT"],
  [/sweep/, "SWEPT"],
  [/ramp|scoop/, "RAMPED"],
  [/hook/, "HOOKED"],
  [/pull|slog/, "PULLED"],
  [/upper cut/, "UPPER-CUT"],
  [/cut/, "CUT"],
  [/whip/, "WHIPPED"],
  [/glance|clip/, "CLIPPED"],
  [/punch|back-foot drive/, "PUNCHED"],
  [/drive/, "DRIVEN"],
];
const EDGE = byCase("edge");
const NO_BAT = byCase("noBat");
const BLOCK = anyLines("block");

/**
 * The stroke as he plays it: { shot, contact, shotName, touched, padHit, exit } (batting.js's result).
 * Ends in "--": the outcome follows once the ball is dead (outcomeCall).
 */
export function shotCall(b, pick) {
  if (!b.touched) {
    if (b.padHit) return `${pick(NO_BAT.pad)} --`;
    return `${pick(b.shot === "leave" ? NO_BAT.leave : NO_BAT.miss)} --`;
  }
  if (EDGE[b.contact]) return `${pick(EDGE[b.contact])} --`;
  if (b.shot === "defend" || /defence/.test(b.shotName ?? "")) return `${pick(BLOCK)} --`;
  const verb = VERB.find(([re]) => re.test(b.shotName ?? ""))?.[1] ?? "STRUCK";
  const far = b.exit ? Math.hypot(b.exit.x, b.exit.z) > 18 : false;
  const where = b.exit && Math.hypot(b.exit.x, b.exit.z) > 0 ? shotArea(b.exit, far).words[0] : "";
  const air = b.exit && b.exit.y > 6 ? ", IN THE AIR" : "";
  return `${verb}${where ? `, ${where}` : ""}${air} --`.toUpperCase();
}

const OUTCOME = byCase("outcome");

/**
 * How the ball played (already called) ended, briefly: "FOUR!", "THEY RUN TWO." "" when the shot call
 * already said it all (a leave, a block, a miss for no run); null when the box's own call for the
 * ball is needed instead (wickets, drops, extras, run-out chances and the unusual).
 */
export function outcomeCall(rec, pick) {
  if (rec.wicket || rec.dropped || rec.extra?.type || rec.nearRunout || rec.moment?.kind === "winningRuns") return null;
  const bat = rec.boundary && rec.runsBat === rec.boundary;
  if (bat) return pick(rec.boundary === 6 ? OUTCOME.six : OUTCOME.four);
  if (rec.boundary) return null;
  if (rec.total > 3) return null;
  if (rec.total > 0) return pick(OUTCOME[rec.total]);
  if (rec.contact === "middle" && rec.shot !== "defend" && rec.shot !== "leave") return pick(OUTCOME.fielded);
  return "";
}

// --- The start of the over. ---

const INTRO = voiceLines("intro", "continue");
const INTRO_OPEN = voiceLines("intro", "open");
const INTRO_PARTNER = voiceLines("intro", "partner");
const INTRO_NEW = voiceLines("intro", "new");
/** Why the captain made the change, when there's an obvious reason. */
const CHANGE_REASON = byCase("changeReason");
const NEW_BALL = byCase("newBall");
const PHASE = byCase("phase");

/**
 * The start-of-over call for the bowler about to bowl: who, his figures, and one thing worth saying
 * (why he's on, the new ball, the phase, the field). `field` is the field reading's text, if fresh.
 * Returns the text.
 */
/**
 * The box reading the bowler's plan for the over (sim/ai.js pickOverPlan), so a player batting can use it,
 * with the short tag shown on screen as it's said.
 */
const PLAN_TAGS = {
  short: "SHORT BALL COMING",
  corridor: "OUTSIDE OFF",
  squeeze: "TIGHT LINES",
  setup: "WATCH THE ONE BACK IN",
  flight: "FLIGHTED: TEMPTING THE DRIVE",
  rough: "INTO THE FOOTMARKS",
};
export const PLAN_READS = Object.fromEntries(
  Object.entries(PLAN_TAGS).map(([plan, tag]) => [plan, { tag, lines: anyLines("planRead", plan) }]),
);

/** `plan`: the computer bowler's plan to read out (or null, as when the player is bowling). */
export function overIntroCall(who, inn, field, pick, plan = null) {
  const { head, extra } = overIntroParts(who, inn, field, pick, plan);
  return [head, extra].filter(Boolean).join(" ");
}

/**
 * The start of the over in two parts: `head` (who's bowling and his figures, the caller's) and `extra` (why
 * he's on, the new ball, the phase, the field or his plan: a remark for the box), or null.
 */
export function overIntroParts(who, inn, field, pick, plan = null) {
  const bowler = inn.bowler;
  const style = bowler.p.bowl?.style;
  const overs = Math.floor(bowler.balls / 6);
  const striker = inn.bat[inn.striker];
  const facts = {
    w: bowler.p.short,
    b: striker.p.short,
    r: striker.runs,
    nth: nth(overs + 1),
    figures: `${bowler.wkts} FOR ${bowler.runs}`,
    stand: inn.partnership.runs,
  };
  const fresh = bowler.spell === 0 && inn.legal > 0;
  const opening = inn.legal === 0 || (overs === 0 && inn.overNo < 2);
  const pool = opening ? (inn.overNo === 1 ? INTRO_PARTNER : INTRO_OPEN) : fresh || overs === 0 ? INTRO_NEW : INTRO;
  const head = fill(pick(pool[who]), facts);
  // A new plan is the most useful thing the box can tell a batter; otherwise the usual scene-setting.
  const read = plan && PLAN_READS[plan] ? pick(PLAN_READS[plan].lines) : null;
  return { head, extra: read ?? extraFor(inn, fresh, opening, style, striker, field, facts, pick) };
}

function extraFor(inn, fresh, opening, style, striker, field, facts, pick) {
  if (fresh && isSpin(style) && (inn.pitch.wear >= 0.15 || inn.pitch.type.id === "dust")) return pick(CHANGE_REASON.spin);
  if (fresh && striker.runs >= 40) return fill(pick(CHANGE_REASON.setBatter), facts);
  if (fresh && inn.partnership.runs >= 40) return fill(pick(CHANGE_REASON.stand), facts);
  const ball = inn.ball;
  if (ball.number > 1 && ball.overs < 1) return pick(NEW_BALL.taken);
  if (inn.newBallAvailable) return pick(NEW_BALL.available);
  if (ball.number === 1 && ball.overs >= 77 && ball.overs < 80)
    return fill(pick(NEW_BALL.due), { n: Math.ceil(80 - ball.overs) });
  const limit = inn.oversLimit;
  const left = Number.isFinite(limit) ? limit - inn.overNo : Infinity;
  if (!inn.test && limit <= 50 && left <= Math.max(2, Math.ceil(limit * 0.2)) && left > 0) {
    if (inn.target !== null && inn.runsNeeded > 0) return fill(pick(PHASE.deathChase), { left, need: inn.runsNeeded });
    return fill(pick(PHASE.death), { left });
  }
  if (field) return field;
  // The opening line already speaks of the new ball.
  if (inn.overNo < 2 && !opening) return pick(PHASE.start);
  const other = inn.bat[inn.nonStriker];
  if (inn.wkts <= 2 && striker.balls >= 24 && other.balls >= 24 && inn.pressure < 0.3) return pick(PHASE.set);
  return null;
}

/** The field worth mentioning now: a reading that hasn't been said for this field already. */
export function fieldCall(inn, saidKeys) {
  const reading = readField(inn.placements, inn.bowler?.p.bowl?.style);
  if (!reading) return null;
  const key = `${inn.preset}:${inn.customField ? JSON.stringify(inn.placements.map((p) => p.name)) : ""}:${reading.key}`;
  if (saidKeys.has(key)) return null;
  saidKeys.add(key);
  return reading.text;
}

// The box speaks in capitals, names included.
const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? `{${k}}`)).toUpperCase();
