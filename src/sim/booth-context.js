import { broadcastContext } from "./broadcast-context.js";
import { MOMENT_PRIORITY } from "./booth-moment-lines.js";

/** Read-only, post-ball context. rec.striker stays correct even when the strike has changed. */
export function boothContext(rec, inn, memory, beforePressure, { narrative, light } = {}) {
  const batter = inn?.bat[rec.wicket?.batter ?? rec.striker];
  const bowler = inn?.bowl[rec.bowler];
  const facts = {
    need: inn?.runsNeeded,
    left: inn?.ballsLeft,
    stand: inn?.partnership?.runs,
  };
  const options = broadcastContext(rec, inn, narrative, light);
  const add = (topic, priority, extra = {}) => options.push({ topic, priority, facts: { ...facts, ...extra } });
  if (rec.moment?.kind === "winningRuns" && inn?.chaseWon) add("winning", 130);
  else if (inn?.isOver) add("inningsEnd", 120);
  const moments = new Set([
    "collapse",
    "hatTrick",
    "twoInTwo",
    "hundred",
    "fifty",
    "outInNineties",
    "fiveFor",
    "standBroken",
    "bigKnockEnds",
    "pressureReleased",
    "nearRunout",
  ]);
  if (moments.has(rec.moment?.kind)) add(rec.moment.kind, rec.moment.kind === "collapse" ? 110 : 100);
  // The rest of the moments (moments.js), and a second one a wicket was as well, a little lower.
  for (const [moment, drop] of [
    [rec.moment, 0],
    [rec.moment?.also, 12],
  ]) {
    if (!moment) continue;
    if (MOMENT_PRIORITY[moment.kind]) add(moment.kind, MOMENT_PRIORITY[moment.kind] - drop, { n: moment.n, k: moment.k });
    else if (drop && moments.has(moment.kind)) add(moment.kind, 100 - drop);
  }
  if (rec.wicket && inn && !inn.isOver) add("wicket", 80);
  // A weakness showing: worth the box's while, more so once it's plain (sim/scouting.js).
  if (rec.scout) add(rec.scout.kind, rec.scout.kind === "weaknessShown" ? 93 : 73, { how: rec.scout.how });
  const validDrop = rec.dropped && !rec.freeHit && rec.extra?.type !== "nb";
  if (validDrop) add("drop", 90);
  if (rec.nearRunout) add("nearRunout", 85);
  if (rec.boundary && beforePressure >= 0.35 && inn?.pressure < beforePressure - 0.12) add("pressureReleased", 88);
  if (inn && !inn.isOver && inn.target !== null && inn.ballsLeft > 0 && inn.runsNeeded > 0 && inn.ballsLeft <= 60) {
    add(inn.requiredRate >= 9 ? "chaseSteep" : inn.requiredRate <= 4 ? "chaseComfort" : "chaseTight", 65);
  }
  const batBoundary = rec.boundary && rec.runsBat === rec.boundary;
  if (batBoundary && rec.seenBall?.line === "wide") add("width", 60);
  if (batBoundary && rec.contact !== "middle") add("luckyBoundary", 70);
  if (rec.beatBat && rec.battle?.surprise) add("variation", 60);
  if (!rec.wicket && inn && !inn.isOver) {
    if (inn.partnership.runs >= 50) add("partnership", 40);
    if (rec.total === 0 && (inn.pressure >= 0.6 || memory.dots >= 6)) add("pressure", 50);
    if (bowler?.stamina <= 0.35 && bowler.balls >= 18) add("fatigue", 30);
    if (batter?.eye >= 0.6 && batter.balls >= 30) add("setBatter", 25);
  }
  for (const drop of memory.drops) {
    const survivor = inn?.bat[drop.batter];
    if (survivor && !survivor.out && survivor.runs - drop.on >= 15) {
      add("dropCost", 75, { b: survivor.p.short, gained: survivor.runs - drop.on });
    }
  }
  // Lulls may have banter. Never interrupt wickets, boundaries, extras or match endings with a joke.
  if (memory.quiet >= 12 && !rec.wicket && !rec.boundary && !rec.extra?.type && !rec.moment && !inn?.isOver) add("lull", 20);
  return options.sort((a, b) => b.priority - a.priority);
}
