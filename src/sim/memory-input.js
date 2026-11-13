import { formatOf } from "./lines.js";
import { leadOf } from "./test-match.js";

/**
 * The match memory's inputs (sim/match-memory.js) from a completed ball: { ball, state }, plain records, so the
 * memory never reads the match itself. Players are named, so a duel is the same pairing in either innings.
 *
 * Each player is named in full (who he is) and short (as the commentary says him).
 *
 * `rec`: the ball's record (Match.finish); `inn`, `match`: as they stand after it. extra: { lostReview (the
 * bowling side reviewed and lost, so the batter survived), light (the time of day, from the scene) }.
 */
export function memoryInput(rec, inn, match, { lostReview = false, light = null } = {}) {
  const name = (i) => inn.bat[i]?.p.name ?? String(i);
  const batter = name(rec.striker);
  const validDrop = rec.dropped && !rec.freeHit && rec.extra?.type !== "nb";
  // A throw at the stumps that missed is the run-out chance let go (a close call made good is not).
  const letoff = validDrop ? "drop" : rec.nearRunout?.shy ? "missedRunOut" : lostReview ? "wastedReview" : null;
  const ball = {
    batter,
    bowler: inn.bowl[rec.bowler]?.p.name ?? String(rec.bowler),
    // As the commentary says them.
    batterShort: inn.bat[rec.striker]?.p.short ?? batter,
    bowlerShort: inn.bowl[rec.bowler]?.p.short ?? String(rec.bowler),
    batterScore: inn.bat[rec.striker]?.runs ?? 0,
    runs: rec.total ?? 0,
    batRuns: rec.runsBat ?? 0,
    legal: !!rec.legal,
    faced: !!rec.legal || rec.extra?.type === "nb",
    boundary: rec.boundary ?? 0,
    beaten: !!rec.beatBat,
    wicket: rec.wicket ? { batter: name(rec.wicket.batter), byBowler: rec.wicket.how !== "runout" } : null,
    letoff,
    // Who put the catch down (a drop only).
    fielder: validDrop && typeof rec.dropped === "string" ? rec.dropped : null,
  };
  const clock = match?.clock;
  const state = {
    innings: match?.innings?.length ?? 1,
    format: formatOf(inn),
    batTeam: inn.batTeam?.abbr ?? "BAT",
    // The batting side as the commentary names it.
    batName: (inn.batTeam?.name ?? inn.batTeam?.abbr ?? "BAT").toUpperCase(),
    bowlTeam: inn.bowlTeam?.abbr ?? "BOWL",
    runs: inn.runs,
    wkts: inn.wkts,
    legal: inn.legal,
    oversLimit: inn.oversLimit,
    target: inn.target ?? null,
    partnership: { runs: inn.partnership?.runs ?? 0, balls: inn.partnership?.balls ?? 0 },
    test: clock
      ? {
          // The batting side's lead before this innings' runs, for the chance of winning.
          lead: leadOf(match, inn.batTeam) - inn.runs,
          oversLeft: clock.oversLeft,
          day: clock.day,
          today: clock.today,
          quota: clock.quota,
          lunch: clock.lunch,
          tea: clock.tea,
        }
      : null,
    ballNumber: inn.ball?.number ?? 1,
    ballOvers: inn.ball?.overs ?? 0,
    reverse: inn.ball?.reverse ?? 0,
    turnRatio: 1 + 0.9 * (inn.pitch?.wear ?? 0),
    light,
  };
  return { ball, state };
}
