/**
 * Every situation the commentary has lines for (sim/lines/*.json, read by sim/lines.js). An entry says how
 * many balls the box rests after saying it (`rest`), the facts its lines may use as {placeholders} beyond
 * the batter {b} and bowler {w}, and, for a situation split by case, the cases there are.
 *
 * `short`: lines said in the run-up, kept to RUNUP_CHARS so they're done before he lets go. `exchanges`: the
 * situation's words are exchanges between the voices rather than single lines.
 *
 * Adding lines needs nothing here. A new situation needs an entry here, lines in a JSON file and the code
 * that spots it (sim/booth-context.js and friends). `npm test` checks the lines against this list.
 */

/** The longest a run-up remark may be (characters, filled). */
export const RUNUP_CHARS = 48;

/** Facts every line may use: the batter and the bowler. */
export const COMMON_FACTS = ["b", "w"];

const LENGTHS = ["full toss", "yorker", "full", "good length", "back of a length", "short"];
const RESULTS = [
  "leave",
  "defend",
  "beaten",
  "miss",
  "pad",
  "edgeDot",
  "offCentreDot",
  "stopped",
  "miscue",
  "glove",
  "single",
  "two",
  "three",
  "runs",
  "edgeRuns",
  "offCentreRuns",
  "four",
  "six",
  "edgeBoundary",
  "drop",
  "byes",
  "legByes",
  "wide",
  "noBall",
  "noBallBoundary",
  "winningExtra",
  "bowled",
  "lbw",
  "caught",
  "runout",
  "stumped",
  "wicket",
];

export const SITUATIONS = {
  // --- The caller, on the HUD line (calls.json, results.json). ---
  setup: { facts: ["end"] },
  setupSpin: { facts: ["end"] },
  setupAround: {},
  length: { cases: LENGTHS },
  spinLength: { cases: LENGTHS },
  line: { cases: ["wide outside off", "outside off", "off stump", "middle", "leg stump", "down leg"] },
  deliveryName: { cases: ["bouncer", "yorker", "slower", "cutter", "googly", "armBall"] },
  edge: { cases: ["thinEdge", "thickEdge", "insideEdge", "padPop", "topEdge", "bottomEdge", "gloved"] },
  noBat: { cases: ["leave", "pad", "miss"] },
  block: {},
  outcome: { cases: ["1", "2", "3", "six", "four", "fielded"] },
  intro: { facts: ["nth", "figures"], cases: ["continue", "open", "partner", "new"] },
  onField: { cases: ["out", "notOut"] },
  tracking: {
    cases: [
      "WICKETS: HITTING",
      "WICKETS: UMPIRE'S CALL",
      "PITCHING: OUTSIDE LEG",
      "IMPACT: OUTSIDE OFF",
      "WICKETS: GOING OVER",
      "WICKETS: MISSING",
    ],
  },
  result: {
    facts: ["contact", "part", "shot", "result", "where", "n", "boundary", "event", "extra", "dismissal"],
    cases: RESULTS,
  },
  leaveExtra: { cases: ["wide", "close", "length"] },

  // --- The start of the over (overs.json). ---
  changeReason: { facts: ["r", "stand"], cases: ["spin", "setBatter", "stand"] },
  newBall: { facts: ["n"], cases: ["due", "available", "taken"] },
  phase: { facts: ["left", "need"], cases: ["start", "set", "deathChase", "death"] },
  planRead: { cases: ["short", "corridor", "squeeze", "setup", "flight", "rough"] },

  // --- After the ball: the big moments and the state of the game (stories.json). ---
  winning: { rest: 0 },
  inningsEnd: { rest: 0 },
  collapse: { rest: 12 },
  hatTrick: { rest: 0 },
  twoInTwo: { rest: 0 },
  hundred: { rest: 0 },
  fifty: { rest: 0 },
  outInNineties: { rest: 0 },
  fiveFor: { rest: 0 },
  standBroken: { rest: 12 },
  bigKnockEnds: { rest: 12 },
  wicket: { rest: 8 },
  pressureReleased: { rest: 18 },
  drop: { rest: 18 },
  dropCost: { rest: 36, facts: ["gained"] },
  chaseSteep: { rest: 18, facts: ["need", "left"] },
  chaseTight: { rest: 18, facts: ["need", "left"] },
  chaseComfort: { rest: 24, facts: ["need", "left"] },
  partnership: { rest: 30, facts: ["stand"] },
  pressure: { rest: 18 },
  width: { rest: 24 },
  luckyBoundary: { rest: 24 },
  fatigue: { rest: 36 },
  setBatter: { rest: 36 },
  nearRunout: { rest: 18 },
  variation: { rest: 24 },
  lull: { rest: 18, exchanges: true },

  // --- The smaller moments (moments.json), from sim/moments.js: {n} and {k} are the moment's numbers. ---
  goldenDuck: { rest: 0 },
  longDuck: { rest: 0, facts: ["n"] },
  duck: { rest: 0 },
  bowlerThird: { rest: 0 },
  shyMissed: { rest: 6 },
  threeInARow: { rest: 6 },
  backToBack: { rest: 6 },
  intoNineties: { rest: 0, facts: ["n"] },
  teamMilestone: { rest: 0, facts: ["n"] },
  equation: { rest: 6, facts: ["n", "k"] },
  bigOver: { rest: 0, facts: ["n"] },
  tightSpell: { rest: 18, facts: ["n"] },
  maiden: { rest: 6 },
  maidenAgain: { rest: 6 },
  beatenAgain: { rest: 6, facts: ["n"] },
  jaffa: { rest: 12, facts: ["n", "k"] },
  rapid: { rest: 36, facts: ["n"] },
  bigSwing: { rest: 36, facts: ["n", "k"] },
  bigTurn: { rest: 36, facts: ["n", "k"] },
  weaknessHint: { rest: 0, facts: ["how"] },
  weaknessWorkedOut: { rest: 0, facts: ["how"] },
  weaknessShown: { rest: 0, facts: ["how"] },

  // --- Dots, milestones in reach, the field, the pitch and the light (colour.json). ---
  dotPressure: { rest: 4, facts: ["dots"], cases: ["4", "8", "12"] },
  nervousNineties: { rest: 12, facts: ["runs", "need"] },
  nearFifty: { rest: 12, facts: ["runs", "need"] },
  huntingFive: { rest: 12 },
  fieldPlan: { rest: 8, facts: ["field"] },
  lowBounce: { rest: 18 },
  extraBounce: { rest: 18 },
  unevenBounce: { rest: 18 },
  wideningCracks: { rest: 18 },
  afternoon: { rest: 18 },
  evening: { rest: 18 },

  // --- The everyday reads of the ball (sim/ball-reads.js; reads.json): the shot, the bowling, the players. ---
  timedShot: { rest: 4, facts: ["shot"], cases: ["drive", "cutpull", "sweep", "loft", "glance"] },
  mistimed: { rest: 6, cases: ["early", "late"] },
  feetRead: { rest: 6, cases: ["wrongFoot", "crease", "acrossLine", "outOfReach", "room", "goodStride"] },
  charged: { rest: 6, cases: ["scored", "blocked", "missed"] },
  edgedSafe: { rest: 6, cases: ["dot", "runs"] },
  goodLeave: { rest: 8, cases: ["close", "length"] },
  solidBlock: { rest: 8 },
  bigHit: { rest: 4 },
  notPicked: { rest: 6 },
  beatenOutside: { rest: 4 },
  bouncerBall: { rest: 4, cases: ["hooked", "topEdged", "fended", "evaded"] },
  yorkerBall: { rest: 4, cases: ["scored", "dug", "missed"] },
  slowerBall: { rest: 6, cases: ["fooled", "read"] },
  looseBall: { rest: 8, cases: ["fullToss", "longHop"] },
  wayward: { rest: 12, cases: ["wide", "downLeg"] },
  firstBall: { rest: 0 },
  offTheMark: { rest: 0, facts: ["n"] },
  strikingFast: { rest: 30, facts: ["r", "n"] },
  grinding: { rest: 60, facts: ["r", "n"] },
  bowlerOnTop: { rest: 48, facts: ["figures"] },
  diveHome: { rest: 6 },
  sentBack: { rest: 12 },
  thirdRun: { rest: 18 },

  // --- The match's state (sim/match-situations.js; finishes.json): the end of a chase, the tail, a Test. ---
  chaseLastTwo: { rest: 3, facts: ["need", "left"], cases: ["easy", "even", "steep"] },
  chaseLastOver: { rest: 1, facts: ["need", "left"], cases: ["easy", "even", "steep"] },
  chaseLastBall: { rest: 0, facts: ["need", "left"], cases: ["1", "2", "3", "4", "5", "6", "more"] },
  scoresLevel: { rest: 6, facts: ["need", "left"] },
  closingOut: { rest: 12, facts: ["need", "left"] },
  tailWagging: { rest: 36, facts: ["stand"] },
  leadPassed: { rest: 0, facts: ["lead"] },
  battingForDraw: { rest: 30, facts: ["left"] },
  // At the start of an over.
  powerplay: { rest: 0, facts: ["overs"], cases: ["start", "end"] },
  firstOverOfDay: { rest: 0, facts: ["day"] },
  followOn: { rest: 0, facts: ["lead"] },
  nightwatchman: { rest: 0 },
  declarationPush: { rest: 36, facts: ["lead"] },

  // --- As he runs in (sim/runup-reads.js; reads.json): the pattern of the over so far. ---
  runupRead: {
    short: true,
    facts: ["n", "types", "how"],
    cases: ["fieldChange", "bouncers", "same", "weakness", "full", "short", "offside"],
  },

  // --- Banter between the voices (banter.json). ---
  betweenOvers: { rest: 0, exchanges: true },

  // --- The ground, the weather, the intervals, the rain, the umpire and the wrap-up (scene.json). ---
  venue: { cases: ["theG", "lords", "scg", "lakshmi", "parklands"] },
  pitch: { cases: ["green", "dust", "cracked"] },
  light: { cases: ["afternoon", "evening", "night"] },
  weather: { facts: ["temp"], cases: ["sunny", "overcast", "humid", "hot", "rain"] },
  day: { facts: ["day"] },
  rainLost: { facts: ["lost"] },
  rainCut: { facts: ["overs"] },
  break: { facts: ["team", "score", "day"], cases: ["lunch", "tea", "stumps"] },
  declare: {},
  rainStops: {},
  rainCost: { facts: ["lost", "target", "overs"], cases: ["lost", "dayOver", "target", "overs"] },
  wrapUp: { facts: ["team", "score", "chasers", "need", "result"], cases: ["break", "result", "finish"] },
  warning: { cases: ["warning", "suspended"] },
  review: { cases: ["bat", "bowl"] },
  verdict: { cases: ["overturnedOut", "overturnedNotOut", "stands", "umpiresCall"] },
};
