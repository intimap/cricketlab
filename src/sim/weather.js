/**
 * The weather, a day at a time, and what it does to the pitch and outfield (sim/conditions.js Pitch reads
 * it). Rolled from the match's dice, so it's part of the result. The multipliers are on the pitch's own:
 *   swing   in the air (cloud and humidity help it)     seam, pace, bounce, turn   off the pitch
 *   wear    how fast the pitch breaks up (heat cracks it)  drag   the outfield's (wet is slow, hard is quick)
 *   lost    rain: [min, max] share of a day's (or a short game's) overs lost
 */
export const WEATHER = {
  sunny: {
    name: "SUNNY",
    sky: "CLEAR SKIES",
    temp: [23, 29],
    swing: 1,
    seam: 1,
    pace: 1,
    bounce: 1,
    turn: 1,
    wear: 1.15,
    drag: 0.96,
  },
  overcast: {
    name: "OVERCAST",
    sky: "THICK CLOUD COVER",
    temp: [16, 21],
    swing: 1.35,
    seam: 1.12,
    pace: 1,
    bounce: 1,
    turn: 0.95,
    wear: 0.9,
    drag: 1,
  },
  humid: {
    name: "HUMID",
    sky: "MUGGY, HAZY SUN",
    temp: [25, 31],
    swing: 1.28,
    seam: 1.05,
    pace: 0.99,
    bounce: 1,
    turn: 1,
    wear: 1,
    drag: 1.02,
  },
  hot: {
    name: "HOT AND DRY",
    sky: "BAKING SUN",
    temp: [32, 39],
    swing: 0.8,
    seam: 0.9,
    pace: 1.03,
    bounce: 1.04,
    turn: 1.1,
    wear: 1.5,
    drag: 0.95,
  },
  rain: {
    name: "SHOWERS",
    sky: "RAIN ABOUT",
    temp: [13, 18],
    swing: 1.25,
    seam: 1.3,
    pace: 0.95,
    bounce: 0.97,
    turn: 0.9,
    wear: 0.7,
    drag: 1.09,
    lost: [0.15, 0.5],
  },
};

/** Neutral: the pitch exactly as it is (no weather rolled, as in AI test runs). */
export const NO_WEATHER = { swing: 1, seam: 1, pace: 1, bounce: 1, turn: 1, wear: 1, drag: 1 };

/** How likely each weather is at a ground (by ground id), out of the total. */
const CLIMATES = {
  lords: { sunny: 3, overcast: 4, humid: 1, hot: 1, rain: 3 },
  lakshmi: { sunny: 3, overcast: 3, humid: 1, hot: 1, rain: 2 },
  theG: { sunny: 4, overcast: 2, humid: 1, hot: 3, rain: 1 },
  scg: { sunny: 4, overcast: 1, humid: 3, hot: 2, rain: 1 },
  default: { sunny: 4, overcast: 2, humid: 2, hot: 2, rain: 1 },
};

/** A day's weather at `ground`; with `yesterday`, the same again more often than not. */
export function rollWeather(rng, ground, yesterday = null) {
  if (yesterday && rng.chance(0.55)) return dayOf(yesterday.id, rng);
  const odds = CLIMATES[ground] ?? CLIMATES.default;
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (const [id, n] of Object.entries(odds)) {
    roll -= n;
    if (roll < 0) return dayOf(id, rng);
  }
  return dayOf("sunny", rng);
}

/** One day of weather `id`: its effects, a temperature, and (for rain) the share of play lost. */
function dayOf(id, rng) {
  const w = WEATHER[id];
  const temp = Math.round(rng.range(w.temp[0], w.temp[1]));
  const lost = w.lost ? rng.range(w.lost[0], w.lost[1]) : 0;
  return { id, ...w, temp, lost };
}

/** What a day's weather does, in words for the report: e.g. ["MORE SWING", "FAST OUTFIELD"]. */
export function weatherEffects(w) {
  const out = [];
  const say = (v, more, less) => {
    if (v >= 1.08) out.push(more);
    else if (v <= 0.92) out.push(less);
  };
  say(w.swing, "MORE SWING", "LITTLE SWING");
  say(w.seam, "MORE OFF THE SEAM", "LESS OFF THE SEAM");
  say(w.turn, "MORE TURN", "LESS TURN");
  say(w.wear, "THE PITCH WILL CRACK FASTER", "THE PITCH WILL HOLD TOGETHER");
  if (w.drag >= 1.05) out.push("SLOW, DAMP OUTFIELD");
  else if (w.drag <= 0.96) out.push("FAST OUTFIELD");
  return out.length ? out : ["NOTHING IN IT FOR EITHER SIDE"];
}
