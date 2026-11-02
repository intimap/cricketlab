import { lengthName, lineName } from "./delivery.js";
import { readField } from "./field-reading.js";

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

const SETUP = [
  ["{w} IN FROM THE {end} --", "{w} TO {b} --", "{w}, FROM THE {end} --"],
  ["HERE COMES {w}, STEAMING IN --", "{w} RUNS IN TO {b} --", "{w} CHARGES IN FROM THE {end} --"],
  ["{w} TO {b}, FROM THE {end} --", "{w} RUNS IN --", "{w} AGAIN TO {b} --"],
];
const SETUP_SPIN = [
  ["{w} IN FROM THE {end} --", "{w}, OFF HIS SHORT RUN --", "{w} TO {b} --"],
  ["{w} SKIPS IN --", "{w} TWIRLS IN TO {b} --", "HERE'S {w} FROM THE {end} --"],
  ["{w} TO {b}, FROM THE {end} --", "{w} WALKS IN --", "{w}, TOSSING IT UP TO {b} --"],
];
const AROUND = ["{w}, AROUND THE WICKET --", "{w} COMES AROUND THE WICKET --", "{w} FROM AROUND THE WICKET TO {b} --"];

/** The run-up line: { w, b, end, spin, around }. */
export function setupCall(who, facts, pick) {
  const pool = facts.around && pick([true, false, false]) ? AROUND : (facts.spin ? SETUP_SPIN : SETUP)[who];
  return fill(pick(pool), facts);
}

// --- Delivery: what he bowled, called as it reaches the bat (never before the batter has played it). ---

const LENGTH = {
  "full toss": ["A FULL TOSS", "FULL TOSS"],
  yorker: ["RIGHT IN THE BLOCKHOLE", "SPEARED IN AT THE TOES", "FULL AT THE BASE OF THE STUMPS"],
  full: ["PITCHED UP", "NICE AND FULL", "FULLER"],
  "good length": ["ON A LENGTH", "HITS THE DECK ON A LENGTH", "A GOOD AREA"],
  "back of a length": ["SHORT OF A LENGTH", "HAMMERED INTO THE PITCH", "BANGED IN"],
  short: ["BANGED IN SHORT", "DUG IN SHORT", "SHORT AND RISING"],
};
const SPIN_LENGTH = {
  "full toss": ["A FULL TOSS", "FULL TOSS"],
  yorker: ["FIRED IN AT THE TOES", "QUICKER AND FULL"],
  full: ["TOSSED UP", "FLIGHTED", "GIVEN SOME AIR"],
  "good length": ["ON A LENGTH", "DIPPING ON A GOOD LENGTH", "A TEASING LENGTH"],
  "back of a length": ["DRAGGED DOWN A TOUCH", "A SHADE SHORT"],
  short: ["DRAGGED DOWN SHORT", "A LONG HOP"],
};
const LINE = {
  "wide outside off": ["WIDE OF OFF STUMP", "WIDE, TEMPTING HIM"],
  "outside off": ["OUTSIDE OFF", "IN THE CHANNEL", "FOURTH STUMP"],
  "off stump": ["AT THE TOP OF OFF", "AT OFF STUMP"],
  middle: ["AT THE STUMPS", "STRAIGHT", "ON MIDDLE"],
  "leg stump": ["ON THE PADS", "AT LEG STUMP"],
  "down leg": ["DRIFTING DOWN LEG", "DOWN THE LEG SIDE"],
};
const VARIATION = {
  bouncer: ["BOUNCER", "THE SHORT ONE"],
  yorker: ["THE YORKER", "YORKER"],
  slower: ["THE SLOWER BALL", "OFF-PACE"],
  cutter: ["THE CUTTER", "CUTTER"],
  googly: ["THE GOOGLY", "THE WRONG 'UN"],
  armBall: ["THE ARM BALL", "ARM BALL, SKIDDING ON"],
};

/** The delivery line: { type, pitchZ, line, spin }, as the ball reaches the bat. */
export function deliveryCall(d, pick) {
  const length = lengthName(d.pitchZ, d.spin);
  const parts = [];
  if (VARIATION[d.type] && pick([true, true, false])) parts.push(pick(VARIATION[d.type]));
  if (d.type !== "bouncer" || !parts.length) parts.push(pick((d.spin ? SPIN_LENGTH : LENGTH)[length]));
  parts.push(pick(LINE[lineName(d.line)]));
  return parts.join(", ") + " --";
}

// --- The start of the over. ---

const INTRO = [
  ["{w} TO BOWL HIS {nth} OVER. {figures}.", "{w} CONTINUES. {figures}.", "{w}, {figures}, FOR HIS {nth}."],
  ["{w}'S {nth} OVER COMING UP! {figures}!", "HERE'S {w} AGAIN! {figures}!", "{w} FOR HIS {nth}! {figures} SO FAR!"],
  ["{w}, {nth} OVER. {figures}.", "{w} TO CONTINUE. {figures}.", "{w}'S {nth}. {figures}."],
];
const INTRO_OPEN = [
  ["{w} TO OPEN THE BOWLING.", "{w} WILL TAKE THE NEW BALL."],
  ["{w} HAS THE NEW BALL! HERE WE GO!", "AND IT'S {w} TO START US OFF!"],
  ["{w} OPENS UP. LET'S SEE WHAT THE NEW BALL DOES.", "{w} WITH THE NEW BALL. HE'LL LOOK FOR EARLY MOVEMENT."],
];
const INTRO_PARTNER = [
  ["{w} SHARES THE NEW BALL.", "{w} FROM THE OTHER END."],
  ["AND {w} FROM THE OTHER END! NEW BALL!", "{w} TO SHARE THE NEW BALL!"],
  ["{w} WITH THE OTHER NEW-BALL OVER. SAME PLAN: FIND THE EDGE.", "{w} FROM THE OTHER END. HE'LL WANT IT TO SWING."],
];
const INTRO_NEW = [
  ["{w} INTO THE ATTACK.", "A CHANGE: {w} COMES ON."],
  ["HERE'S {w}! FIRST OVER OF THE SPELL!", "{w} IS ON! LET'S SEE WHAT HE'S GOT!"],
  ["{w} BROUGHT ON.", "A BOWLING CHANGE: {w}."],
];
/** Why the captain made the change, when there's an obvious reason. */
const CHANGE_REASON = {
  spin: ["SPIN ON -- THE PITCH IS OFFERING SOMETHING.", "THE SPINNER ON NOW. THE SURFACE IS STARTING TO HELP."],
  setBatter: ["{b} IS ON {r}. TIME FOR SOMETHING DIFFERENT.", "BROUGHT ON FOR {b}, WHO'S ON {r}. A NEW PROBLEM FOR HIM."],
  stand: ["THIS STAND IS WORTH {stand}. THEY NEED A BREAKTHROUGH.", "TO BREAK A STAND OF {stand}."],
};
const NEW_BALL = {
  due: ["THE NEW BALL IS DUE IN {n} OVERS.", "{n} OVERS UNTIL THE NEW BALL."],
  available: ["THE NEW BALL IS AVAILABLE. WILL THEY TAKE IT?", "NEW BALL AVAILABLE NOW."],
  taken: ["THE NEW BALL IN HAND -- SHINY, HARD, DANGEROUS.", "NEW BALL. IT'LL SWING AND BOUNCE."],
};
const PHASE = {
  start: ["NEW BALL, CLOSE CATCHERS. THE MOST DANGEROUS TIME TO BAT.", "EARLY DAYS. THE BALL WILL DO A BIT NOW."],
  set: ["BOTH BATTERS LOOK SET. TIDY BOWLING, NOT THREATENING.", "A PERIOD OF CONSOLIDATION. BOTH BATTERS IN."],
  deathChase: [
    "{left} OVERS LEFT, {need} NEEDED. THIS IS WHERE IT GETS INTERESTING.",
    "{need} FROM {left} OVERS. EVERY BALL MATTERS NOW.",
  ],
  death: ["{left} OVERS TO GO. TIME TO PUSH ON.", "THE LAST {left} OVERS. EXPECT THE BIG SHOTS."],
};

/**
 * The start-of-over call for the bowler about to bowl: who, his figures, and one thing worth saying
 * (why he's on, the new ball, the phase, the field). `field` is the field reading's text, if fresh.
 * Returns the text.
 */
export function overIntroCall(who, inn, field, pick) {
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
  return [head, extraFor(inn, fresh, opening, style, striker, field, facts, pick)].filter(Boolean).join(" ");
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
  if (limit <= 50 && left <= Math.max(2, Math.ceil(limit * 0.2)) && left > 0) {
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
