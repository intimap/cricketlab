import { LINES, COLOUR_LINES } from "./broadcast-lines.js";

export const BROADCAST_STORIES = {
  ...Object.fromEntries([4, 8, 12].map((n) => [`dotPressure${n}`, { rest: 4, lines: LINES.defendPressure[n] }])),
  nervousNineties: {
    rest: 12,
    lines: [
      ["{b} on {runs}. A hundred is close; the next ball still needs playing."],
      ["{b} is on {runs}! Just {need} short of three figures!"],
      ["{b}, {runs}. Keep the scoring options open; don't let the hundred dictate the shot."],
    ],
  },
  nearFifty: {
    rest: 12,
    lines: [
      ["{b} on {runs}. A fifty within reach, with patience."],
      ["{runs} for {b}! {need} away from the half-century!"],
      ["{b} on {runs}. No need to force the milestone."],
    ],
  },
  huntingFive: {
    rest: 12,
    lines: [
      ["Four wickets for {w}. One more would complete a fine spell."],
      ["{w} has four! One more for a five-wicket haul!"],
      ["{w} hunting a fifth. The captain will want to keep the pressure on."],
    ],
  },
  fieldPlan: { rest: 8, lines: [["{field}"], ["Look at the field! {field}"], ["{field}"]] },
  ...Object.fromEntries(Object.entries(COLOUR_LINES).map(([topic, lines]) => [topic, { rest: 18, lines }])),
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
