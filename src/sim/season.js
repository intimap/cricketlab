import { Match } from "./match.js";
import { Rng } from "./rng.js";
import { CLUBS, CLUB_IDS } from "./season-clubs.js";

/**
 * A season of club cricket: eight clubs, home and away (14 rounds of 20-over matches), a ladder, semi-finals
 * (first against fourth, second against third, at the higher side's ground) and a grand final. The player is
 * one club; the other matches of each round are simulated. Plain data, so the browser can keep it and the
 * player can come back to it (scenes/season-store.js).
 *
 * season: { version, seed, club, rounds: [[fixture...]...], finals: [[fixture...]...] (semis, then final),
 *           results: { fixtureId: result }, round (the round now being played; rounds.length + i in the finals),
 *           inProgress (the player's fixture id while it's being played), stats, champion }
 * fixture: { id, home, away, round }. result: see resultOf.
 */

export const SEASON_VERSION = 1;
export const OVERS = 20;
/** Points for a win, and for a tie. */
export const WIN_POINTS = 4;
export const TIE_POINTS = 2;
/** Sides that make the finals. */
export const FINALISTS = 4;

/** Home and away: each club plays each other twice, once at home, by the circle method (all play each round). */
export function fixturesFor(clubs) {
  const n = clubs.length;
  const ring = clubs.slice(1);
  const half = [];
  for (let r = 0; r < n - 1; r++) {
    const order = [clubs[0], ...ring];
    const games = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      // Alternate who's at home, so each club has a fair share in the first half.
      games.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    half.push(games);
    ring.unshift(ring.pop());
  }
  const rounds = [...half, ...half.map((games) => games.map(([a, b]) => [b, a]))];
  return rounds.map((games, r) => games.map(([home, away], i) => ({ id: `R${r + 1}G${i + 1}`, home, away, round: r })));
}

export function createSeason(club, seed = Math.floor(Math.random() * 2 ** 31)) {
  return {
    version: SEASON_VERSION,
    seed,
    club,
    rounds: fixturesFor(CLUB_IDS),
    finals: [],
    results: {},
    round: 0,
    inProgress: null,
    stats: { bat: {}, bowl: {} },
    champion: null,
  };
}

/** A fixture's own dice: the same toss and the same simulated match however the season is resumed. */
const fixtureSeed = (season, id) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, season.seed >>> 0);

/** Who bats first: the toss, decided for the fixture. */
export function battingFirst(season, fixture) {
  return new Rng(fixtureSeed(season, fixture.id) ^ 0x9e3779b9).next() < 0.5 ? fixture.home : fixture.away;
}

/** A finished match as the season records it: each side's total, the winner, and the players' figures. */
export function resultOf(match, fixture) {
  const [first, second] = match.innings;
  const side = (inn) => ({
    club: clubOf(fixture, inn.batTeam),
    runs: inn.runs,
    wkts: inn.wkts,
    balls: inn.wkts >= 10 ? OVERS * 6 : inn.legal,
  });
  const totals = [side(first), side(second)];
  const res = match.result;
  const winner = res?.winner ? clubOf(fixture, res.winner) : null;
  const players = [];
  for (const inn of match.innings) {
    const bat = clubOf(fixture, inn.batTeam);
    const bowl = clubOf(fixture, inn.bowlTeam);
    for (const b of inn.bat)
      if (b.batted) players.push({ kind: "bat", club: bat, name: b.p.name, runs: b.runs, balls: b.balls, out: b.out });
    for (const w of inn.bowl)
      if (w.balls) players.push({ kind: "bowl", club: bowl, name: w.p.name, wkts: w.wkts, runs: w.runs, balls: w.balls });
  }
  return { id: fixture.id, home: fixture.home, away: fixture.away, totals, winner, text: res?.text ?? "", players };
}
/** A team in a match back to its club id (the match holds the built squads). */
const clubOf = (fixture, team) => (team.abbr === CLUBS[fixture.home]().abbr ? fixture.home : fixture.away);

/** Play a fixture out on the computer, start to finish. */
export function simFixture(season, fixture) {
  const first = battingFirst(season, fixture);
  const second = first === fixture.home ? fixture.away : fixture.home;
  const match = new Match(CLUBS[first](), CLUBS[second](), "green", OVERS, new Rng(fixtureSeed(season, fixture.id)), "bat", {
    innings: 2,
  });
  for (let i = 0; i < 2000 && !match.result; i++) {
    if (match.inn.isOver) {
      if (!match.hasNextInnings) break;
      match.nextInnings();
    }
    match.simBall();
  }
  return resultOf(match, fixture);
}

/** The fixtures of the round now being played (regular season or finals), or [] once it's over. */
export function currentFixtures(season) {
  const r = season.round;
  if (r < season.rounds.length) return season.rounds[r];
  return season.finals[r - season.rounds.length] ?? [];
}

/** The player's fixture this round, or null (not in the finals, or the season's over). */
export const playerFixture = (season) =>
  currentFixtures(season).find((f) => !season.results[f.id] && (f.home === season.club || f.away === season.club)) ?? null;

/** Record a result: the ladder and the season's figures take it in; a finished round moves the season on. */
export function recordResult(season, result) {
  if (season.results[result.id]) return season;
  // Kept small: the season's figures take each player's, and the result keeps its best batter and bowler.
  const { players, ...kept } = result;
  season.results[result.id] = { ...kept, top: topOf(players) };
  for (const p of players) {
    const key = `${p.club}:${p.name}`;
    if (p.kind === "bat") {
      const s = (season.stats.bat[key] ??= { name: p.name, club: p.club, runs: 0, balls: 0, inns: 0, outs: 0, best: 0 });
      s.runs += p.runs;
      s.balls += p.balls;
      s.inns++;
      s.outs += p.out ? 1 : 0;
      s.best = Math.max(s.best, p.runs);
    } else {
      const s = (season.stats.bowl[key] ??= { name: p.name, club: p.club, wkts: 0, runs: 0, balls: 0 });
      s.wkts += p.wkts;
      s.runs += p.runs;
      s.balls += p.balls;
    }
  }
  if (season.inProgress === result.id) season.inProgress = null;
  advance(season);
  return season;
}

/** A match's best batter (most runs) and bowler (most wickets, fewest runs). */
function topOf(players) {
  const best = (kind, better) => players.filter((p) => p.kind === kind).sort(better)[0] ?? null;
  const bat = best("bat", (a, b) => b.runs - a.runs || a.balls - b.balls);
  const bowl = best("bowl", (a, b) => b.wkts - a.wkts || a.runs - b.runs);
  return {
    bat: bat && { name: bat.name, club: bat.club, runs: bat.runs, balls: bat.balls, out: bat.out },
    bowl: bowl && { name: bowl.name, club: bowl.club, wkts: bowl.wkts, runs: bowl.runs },
  };
}

/** Every other fixture of the round, simulated (the player's own is left to play). */
export function simRest(season) {
  const mine = playerFixture(season);
  for (const f of currentFixtures(season)) if (!season.results[f.id] && f !== mine) recordResult(season, simFixture(season, f));
  return season;
}

/** Each club's line on the ladder, best first: { club, p, w, l, t, pts, nrr }. Regular season only. */
export function ladder(season) {
  const rows = Object.fromEntries(
    CLUB_IDS.map((club) => [club, { club, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, bf: 0, ra: 0, bb: 0 }]),
  );
  for (const round of season.rounds) {
    for (const f of round) {
      const r = season.results[f.id];
      if (!r) continue;
      for (const [mine, theirs] of [
        [0, 1],
        [1, 0],
      ]) {
        const row = rows[r.totals[mine].club];
        row.p++;
        row.rf += r.totals[mine].runs;
        row.bf += r.totals[mine].balls;
        row.ra += r.totals[theirs].runs;
        row.bb += r.totals[theirs].balls;
        if (r.winner === null) {
          row.t++;
          row.pts += TIE_POINTS;
        } else if (r.winner === row.club) {
          row.w++;
          row.pts += WIN_POINTS;
        } else row.l++;
      }
    }
  }
  const rate = (runs, balls) => (balls ? (runs * 6) / balls : 0);
  return Object.values(rows)
    .map((row) => ({ ...row, nrr: rate(row.rf, row.bf) - rate(row.ra, row.bb) }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.club.localeCompare(b.club));
}

/** Move on once the round is done: the next round, the finals, the grand final, the champion. */
function advance(season) {
  if (currentFixtures(season).some((f) => !season.results[f.id])) return;
  season.round++;
  const regular = season.rounds.length;
  if (season.round === regular) {
    const top = ladder(season)
      .slice(0, FINALISTS)
      .map((r) => r.club);
    season.finals.push([
      { id: "SF1", home: top[0], away: top[3], round: regular },
      { id: "SF2", home: top[1], away: top[2], round: regular },
    ]);
  } else if (season.round === regular + 1) {
    const [a, b] = season.finals[0].map((f) => finalWinner(season, f));
    season.finals.push([{ id: "GF", home: a, away: b, round: regular + 1 }]);
  } else if (season.round === regular + 2) {
    season.champion = finalWinner(season, season.finals[1][0]);
  }
}

/** A final's winner: a tie goes to the side higher on the ladder (the home side). */
const finalWinner = (season, f) => season.results[f.id].winner ?? f.home;

/** The top `n` of the season's run-scorers and wicket-takers. */
export function leaders(season, n = 5) {
  const bat = Object.values(season.stats.bat)
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)
    .slice(0, n);
  const bowl = Object.values(season.stats.bowl)
    .sort((a, b) => b.wkts - a.wkts || a.runs - b.runs)
    .slice(0, n);
  return { bat, bowl };
}

/** A round's name: ROUND 3, SEMI-FINALS, GRAND FINAL. */
export function roundName(season, round = season.round) {
  const regular = season.rounds.length;
  if (round < regular) return `ROUND ${round + 1}`;
  return round === regular ? "SEMI-FINALS" : round === regular + 1 ? "GRAND FINAL" : "SEASON OVER";
}
