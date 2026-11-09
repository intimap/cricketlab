import { voiceLines, storiesIn } from "./lines.js";

/** Leaves worth a word, and runs of dots (sim/lines/results.json and colour.json). */
export const LINES = {
  leaveWide: voiceLines("leaveExtra", "wide"),
  leaveClose: voiceLines("leaveExtra", "close"),
  leaveLength: voiceLines("leaveExtra", "length"),
  defendPressure: Object.fromEntries([4, 8, 12].map((n) => [n, voiceLines("dotPressure", String(n))])),
};

/** The pitch and the light. */
const COLOUR_TOPICS = ["lowBounce", "extraBounce", "unevenBounce", "wideningCracks", "afternoon", "evening"];
export const COLOUR_LINES = Object.fromEntries(COLOUR_TOPICS.map((topic) => [topic, voiceLines(topic)]));

const { dotPressure, ...COLOUR_STORIES } = storiesIn("colour");
export const BROADCAST_STORIES = {
  ...Object.fromEntries([4, 8, 12].map((n) => [`dotPressure${n}`, { rest: dotPressure.rest, lines: LINES.defendPressure[n] }])),
  ...COLOUR_STORIES,
};

/** Facts only: the innings clock does not imply a real day, weather or session. */
export function broadcastContext(rec, inn, narrative, light) {
  if (!narrative || narrative.innings !== inn || inn?.isOver || rec.wicket || rec.boundary || rec.extra?.type) return [];
  const options = [];
  const add = (topic, priority, facts = {}, key) => options.push({ topic, priority, facts, key });
  const m = narrative.milestones;
  const batter = inn.bat?.[rec.striker];
  if (m.nervousNineties)
    add("nervousNineties", 78, { b: batter.p.short, runs: m.runs, need: 100 - m.runs }, `nineties:${rec.striker}`);
  if (m.nearFifty) add("nearFifty", 58, { b: batter.p.short, runs: m.runs, need: 50 - m.runs }, `fifty:${rec.striker}`);
  if (m.huntingFive) add("huntingFive", 76, {}, `five:${rec.bowler}`);
  const dots = narrative.dotPressure;
  const level = dots.batter >= 12 ? 12 : dots.batter >= 8 ? 8 : dots.batter >= 4 ? 4 : 0;
  if (level && rec.legal && rec.total === 0)
    add(`dotPressure${level}`, 56 + level, { dots: dots.batter }, `dots:${rec.striker}:${dots.streak}:${level}`);
  const pitch = narrative.pitch;
  if (pitch.wear >= 0.2 && pitch.bounce === "low") add("lowBounce", 55);
  if (pitch.wear >= 0.2 && pitch.bounce === "high") add("extraBounce", 54);
  if (pitch.type === "cracked" && pitch.uneven) add("unevenBounce", 53);
  const type = inn.bowl?.[rec.bowler]?.p.bowl?.style;
  if (pitch.type === "cracked" && pitch.wear >= 0.25 && ["offspin", "legspin"].includes(type)) add("wideningCracks", 42);
  // The field is read at the start of each over (booth-beats.js), from the actual placings.
  if (["afternoon", "evening"].includes(light)) add(light, 15, {}, `light:${light}`);
  return options;
}
