import { lengthName } from "./delivery.js";

/**
 * The everyday reads of a ball that give the box something to say on most balls (TODO: commentary): the
 * shot (timing, feet, a charge, an edge that got away with it), the bowling (beaten outside off, the
 * bouncer, the yorker, the slower ball, a loose one), the players (a first ball, off the mark, scoring
 * quickly or grinding) and the running (a dive, a third, a batter sent back). Read-only: each read is an
 * option { topic, case, priority, facts } for sim/booth-context.js to rank with the big moments.
 */

/** The shot's family, from its name (batting.js shotName). */
function family(rec) {
  const name = rec.shotName ?? "";
  if (/sweep|ramp|scoop|switch/.test(name)) return "sweep";
  if (/glance|clip|whip|flick/.test(name)) return "glance";
  if (/cut|pull|hook/.test(name)) return "cutpull";
  if (rec.shot === "loft" || /lofted|slog|over the top/.test(name)) return "loft";
  if (rec.shot === "drive" || /drive|punch/.test(name)) return "drive";
  return rec.shot === "cutpull" ? "cutpull" : null;
}

/** The run rate a bowler is doing well to keep under, by format. */
const PAR_ECONOMY = { t20: 7.5, odi: 5, test: 3 };

/** Every everyday read that's true of this ball, highest priority first is up to the caller. */
export function ballReads(rec, inn, format) {
  const out = [];
  const add = (topic, kase, priority, facts = {}) => out.push({ topic, case: kase, priority, facts });
  if (!inn || inn.isOver) return out;
  const batter = inn.bat[rec.striker];
  const bowler = inn.bowl[rec.bowler];
  const spinner = ["offspin", "legspin"].includes(bowler?.p.bowl?.style);
  const length = lengthName(rec.pitched?.z ?? 5, spinner);
  const line = rec.seenBall?.line;
  const wicket = !!rec.wicket;
  const bat = rec.contact && rec.contact !== "none";
  const scored = rec.runsBat > 0;
  const attacking = !["defend", "leave"].includes(rec.shot);

  // --- The running. ---
  if (rec.dived && !wicket) add("diveHome", null, 62);
  if (rec.recalled && !wicket) add("sentBack", null, 50);
  if (rec.runsBat === 3 && !rec.boundary) add("thirdRun", null, 34);

  if (wicket || rec.extra?.type === "wd") {
    if (rec.extra?.type === "wd") add("wayward", "wide", 24);
    return out;
  }

  // --- The shot. ---
  const fam = family(rec);
  if (rec.stride === "down") add("charged", scored ? "scored" : bat ? "blocked" : "missed", 46);
  if (bat && rec.contact === "middle" && attacking && (rec.quality ?? 0) >= 0.72 && (scored || rec.quality >= 0.85) && fam)
    add("timedShot", fam, rec.boundary ? 30 : 36, { shot: (rec.shotName ?? "").toUpperCase() });
  if (attacking && Number.isFinite(rec.timing) && Math.abs(rec.timing) > 1 && rec.total <= 1)
    add("mistimed", rec.timing < 0 ? "early" : "late", 34);
  if (rec.feet && rec.feet !== "goodStride") add("feetRead", rec.feet, 37);
  else if (rec.feet === "goodStride" && (rec.runsBat >= 2 || rec.boundary)) add("feetRead", "goodStride", 30);
  if (["thinEdge", "thickEdge", "insideEdge", "bottomEdge"].includes(rec.contact) && !rec.boundary && !rec.dropped)
    add("edgedSafe", scored ? "runs" : "dot", 40);
  if (rec.shot === "leave" && !rec.padVerdict && (line === "off" || rec.seenBall?.length === "back"))
    add("goodLeave", line === "off" ? "close" : "length", 26);
  if (rec.shot === "defend" && rec.contact === "middle" && ["full", "good length"].includes(length)) add("solidBlock", null, 20);
  if (rec.boundary === 6 && rec.contact === "middle") add("bigHit", null, 38);

  // --- The bowling. ---
  if (rec.notPicked && !scored) add("notPicked", null, 47);
  if (rec.beatBat && (line === "off" || line === "wide")) add("beatenOutside", null, 42);
  if (rec.deliveryType === "bouncer" || (length === "short" && !spinner))
    add("bouncerBall", scored ? "hooked" : rec.contact === "topEdge" ? "topEdged" : bat ? "fended" : "evaded", 40);
  if (rec.deliveryType === "yorker" || length === "yorker") add("yorkerBall", scored ? "scored" : bat ? "dug" : "missed", 38);
  if ((rec.deliveryType === "slower" || rec.deliveryType === "cutter") && !rec.boundary)
    add("slowerBall", !bat || rec.missReason === "early" || (rec.timing ?? 0) < -1 ? "fooled" : "read", 36);
  if (rec.runsBat >= 2 && (length === "full toss" || (spinner && length === "short")))
    add("looseBall", length === "full toss" ? "fullToss" : "longHop", 44);
  if (line === "leg" && rec.extra?.type === "lb") add("wayward", "downLeg", 24);

  // --- The players. ---
  if (batter && batter.balls === 1) add("firstBall", null, 40);
  if (batter && scored && batter.runs === rec.runsBat && batter.balls >= 6) add("offTheMark", null, 55, { n: batter.balls });
  const rate = batter && batter.balls ? (100 * batter.runs) / batter.balls : 0;
  if (format !== "test" && batter && batter.runs >= 20 && batter.balls >= 12 && rate >= 160 && scored)
    add("strikingFast", null, 32, { r: batter.runs, n: batter.balls });
  if (format !== "t20" && batter && batter.balls >= 60 && rate < 35 && rec.total === 0)
    add("grinding", null, 24, { r: batter.runs, n: batter.balls });
  if (bowler && bowler.wkts >= 2 && bowler.balls >= 12 && rec.total === 0) {
    const economy = (6 * bowler.runs) / bowler.balls;
    if (economy < PAR_ECONOMY[format]) add("bowlerOnTop", null, 22, { figures: `${bowler.wkts} FOR ${bowler.runs}` });
  }
  return out;
}
