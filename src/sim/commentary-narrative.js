import { presetPlacements } from "./field.js";

// Summary lookup is outside Innings: narration never adds fields to cricket state.
const summaries = new WeakMap();
const oversText = (balls) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;

export function createNarrative() {
  return {
    innings: null,
    seen: new WeakSet(),
    batters: new Map(),
    over: null,
    dotPressure: { batter: 0, over: 0 },
    milestones: {},
    pitch: {},
    lastOver: null,
  };
}

/** Called after Innings.apply, for live AND simulated balls. No random draws or cricket mutations. */
export function trackBall(narrative, rec, inn) {
  if (!inn || !rec) return narrative;
  if (narrative.innings !== inn) {
    Object.assign(narrative, createNarrative(), { innings: inn });
    summaries.set(inn, new Map());
  }
  if (narrative.seen.has(rec)) return narrative;
  narrative.seen.add(rec);
  if (!narrative.over || narrative.over.number !== rec.over) {
    narrative.over = { number: rec.over, runs: 0, dots: 0, consecutive: 0, partial: rec.ball > 1, bowler: rec.bowler, legal: 0 };
  }
  const over = narrative.over;
  over.runs += rec.total ?? 0;
  if (rec.legal) over.legal++;
  const dot = !!rec.legal && rec.total === 0 && !rec.wicket;
  over.consecutive = dot ? over.consecutive + 1 : 0;
  if (dot) over.dots++;
  const batter = narrative.batters.get(rec.striker) ?? { dots: 0, streak: 0 };
  // Illegal deliveries never count as faced dots. Extras break over pressure;
  // a batter's legal-ball streak survives wides/no-balls unless they score.
  if ((rec.runsBat ?? 0) > 0 || rec.wicket || (rec.legal && !dot)) {
    batter.dots = 0;
    batter.streak++;
  } else if (dot) batter.dots++;
  narrative.batters.set(rec.striker, batter);
  if (rec.wicket) narrative.batters.delete(rec.wicket.batter);
  narrative.dotPressure = {
    batter: batter.dots,
    over: over.consecutive,
    overDots: over.dots,
    striker: rec.striker,
    streak: batter.streak,
  };
  const bat = inn.bat?.[rec.striker],
    bowl = inn.bowl?.[rec.bowler];
  narrative.milestones = {
    batter: rec.striker,
    runs: bat?.runs ?? 0,
    nearFifty: !bat?.out && bat?.runs >= 45 && bat.runs < 50,
    nervousNineties: !bat?.out && bat?.runs >= 90 && bat.runs < 100,
    bowler: rec.bowler,
    huntingFive: bowl?.wkts === 4,
  };
  const previous = narrative.pitch;
  narrative.pitch = {
    wear: inn.pitch?.wear ?? 0,
    type: inn.pitch?.type?.id,
    low: (previous.low ?? 0) + (rec.bounceNote === "low" ? 1 : 0),
    high: (previous.high ?? 0) + (rec.bounceNote === "high" ? 1 : 0),
    bounce: rec.bounceNote,
    uneven: !!((previous.low || rec.bounceNote === "low") && (previous.high || rec.bounceNote === "high")),
  };
  if (rec.legal && (inn.legal ?? 0) % 6 === 0 && bowl) {
    narrative.lastOver = {
      ...over,
      score: `${inn.batTeam?.abbr ?? ""} ${inn.runs}/${inn.wkts}`.trim(),
      overs: oversText(inn.legal),
      name: bowl.p?.short ?? "BOWLER",
      figures: {
        overs: oversText(bowl.balls ?? 0),
        maidens: bowl.maidens ?? 0,
        wickets: bowl.wkts ?? 0,
        runs: bowl.runs ?? 0,
      },
    };
    summaries.get(inn).set(rec.over, narrative.lastOver);
  }
  return narrative;
}

/** `over` is a tracked snapshot or the zero-based completed over number. */
export function getOverSummary(inn, over = (inn?.overNo ?? 0) - 1) {
  const snapshot = typeof over === "object" ? over : summaries.get(inn)?.get(over);
  if (!snapshot) return "";
  const f = snapshot.figures;
  const recap = snapshot.partial
    ? `${snapshot.runs} since resumption.`
    : snapshot.runs === 0
      ? "A scoreless over."
      : `${snapshot.runs} from the over.`;
  return (
    `${recap} ${snapshot.name}: ${f.overs} over${f.overs === "1" ? "" : "s"}, ` +
    `${f.maidens} maiden${f.maidens === 1 ? "" : "s"}, ${f.wickets} for ${f.runs}. ` +
    `${snapshot.score} after ${snapshot.overs} over${snapshot.overs === "1" ? "" : "s"}.`
  );
}

/** Preset plans are described only when still intact; custom fields need actual positions. */
export function getFieldObservation(fieldPreset, bowlingType) {
  let places;
  try {
    places = Array.isArray(fieldPreset) ? fieldPreset : presetPlacements(fieldPreset);
  } catch {
    return "";
  }
  const names = new Set(places.map((p) => p.name));
  const spin = ["offspin", "legspin", "spin"].includes(bowlingType);
  if (["first slip", "second slip", "third slip", "gully"].every((n) => names.has(n)))
    return "Three slips and a gully: a fourth-stump invitation, hunting the edge.";
  if (names.has("deep midwicket") && names.has("deep square leg"))
    return spin
      ? "Deep midwicket and deep square: protection for the sweep."
      : "Deep midwicket and deep square back: expecting the pull.";
  if (names.has("short leg") && names.has("leg gully")) return "Short leg, leg gully, two back on the hook: a short-ball trap.";
  if (names.has("short leg") && names.has("slip") && spin) return "Slip and short leg waiting for the edge or bat-pad catch.";
  if (names.has("leg slip")) return "A leg slip as well: cover for the glance or the inside edge.";
  if (names.has("extra cover") && ![...names].some((n) => n.startsWith("deep ") || n.startsWith("long-")))
    return "The close ring is saving the single. They must find a gap.";
  if (names.has("second slip") && names.has("gully"))
    return "Two slips and a gully: catchers retained without leaving the ring bare.";
  return "";
}
