import test from "node:test";
import assert from "node:assert/strict";
import {
  createSeason,
  fixturesFor,
  ladder,
  recordResult,
  playerFixture,
  currentFixtures,
  battingFirst,
  simFixture,
  leaders,
  WIN_POINTS,
  TIE_POINTS,
} from "../src/sim/season.js";
import { CLUBS, CLUB_IDS } from "../src/sim/season-clubs.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";

/** A made-up result: `winner` (or null, a tie) makes 150 against the loser's 140, each in 20 overs. */
function result(f, winner, players = []) {
  const loser = winner === f.home ? f.away : f.home;
  const totals = winner
    ? [
        { club: winner, runs: 150, wkts: 5, balls: 120 },
        { club: loser, runs: 140, wkts: 8, balls: 120 },
      ]
    : [
        { club: f.home, runs: 150, wkts: 5, balls: 120 },
        { club: f.away, runs: 150, wkts: 6, balls: 120 },
      ];
  return { id: f.id, home: f.home, away: f.away, totals, winner, text: "", players };
}

test("season clubs: eight made-up clubs, each a full eleven with enough bowlers for 20 overs", () => {
  assert.equal(CLUB_IDS.length, 8);
  for (const id of CLUB_IDS) {
    const club = CLUBS[id]();
    assert.equal(club.players.length, 11, id);
    assert.ok(club.players.filter((p) => p.bowl).length * 4 >= 20, `${id}: bowlers for 20 overs`);
    assert.equal(club.players.filter((p) => p.keeper).length, 1);
    assert.deepEqual(
      CLUBS[id]().players.map((p) => p.name),
      club.players.map((p) => p.name),
      "the same squad every time",
    );
  }
});

test("home and away: 14 rounds, every club once a round, every pairing twice with the grounds swapped", () => {
  const rounds = fixturesFor(CLUB_IDS);
  assert.equal(rounds.length, 14);
  for (const round of rounds) assert.deepEqual(round.flatMap((f) => [f.home, f.away]).sort(), [...CLUB_IDS].sort());
  const games = rounds.flat();
  for (const a of CLUB_IDS)
    for (const b of CLUB_IDS)
      if (a !== b) assert.equal(games.filter((f) => f.home === a && f.away === b).length, 1, `${a} v ${b}`);
  for (const club of CLUB_IDS) assert.equal(games.filter((f) => f.home === club).length, 7, `${club} at home`);
});

test("the ladder: four points a win, two a tie, net run rate after that; the finals from the top four", () => {
  const s = createSeason("BRK", 7);
  // Every match: the home side wins, except one tie.
  for (const round of s.rounds) for (const f of round) recordResult(s, result(f, f.id === "R1G1" ? null : f.home));
  const rows = ladder(s);
  for (const r of rows) assert.equal(r.pts, r.w * WIN_POINTS + r.t * TIE_POINTS);
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].pts > r.pts || (rows[i - 1].pts === r.pts && rows[i - 1].nrr >= r.nrr)));
  // The regular season done: semi-finals, first v fourth and second v third, at the higher side's ground.
  assert.equal(s.round, 14);
  const top = rows.slice(0, 4).map((r) => r.club);
  assert.deepEqual(
    currentFixtures(s).map((f) => [f.home, f.away]),
    [
      [top[0], top[3]],
      [top[1], top[2]],
    ],
  );
  // Semis won by the home sides, a final, and a champion.
  for (const f of currentFixtures(s)) recordResult(s, result(f, f.home));
  assert.deepEqual(
    currentFixtures(s).map((f) => [f.home, f.away]),
    [[top[0], top[1]]],
  );
  recordResult(s, result(currentFixtures(s)[0], top[1]));
  assert.equal(s.champion, top[1]);
});

test("the player's fixture, the toss, and the season's figures", () => {
  const s = createSeason("STK", 11);
  const mine = playerFixture(s);
  assert.ok(mine.home === "STK" || mine.away === "STK");
  assert.equal(battingFirst(s, mine), battingFirst(s, mine), "the toss is decided for the fixture");
  const players = [
    { kind: "bat", club: "STK", name: "A Bat", runs: 70, balls: 40, out: true },
    { kind: "bowl", club: mine.home === "STK" ? mine.away : mine.home, name: "B Ball", wkts: 3, runs: 24, balls: 24 },
  ];
  recordResult(s, result(mine, "STK", players));
  assert.equal(leaders(s).bat[0].runs, 70);
  assert.equal(leaders(s).bowl[0].wkts, 3);
  assert.equal(s.results[mine.id].top.bat.name, "A Bat");
  assert.equal(s.results[mine.id].players, undefined, "the stored result is kept small");
  // Recorded once only.
  recordResult(s, result(mine, "STK", players));
  assert.equal(leaders(s).bat[0].runs, 70);
});

test("a simulated fixture is the same whenever it's played (it's saved and resumed), and the season is plain data", () => {
  const s = createSeason("CAM", 99);
  const f = s.rounds[0][1];
  assert.deepEqual(simFixture(s, f), simFixture(JSON.parse(JSON.stringify(s)), f));
  const r = simFixture(s, f);
  assert.ok(r.totals.every((t) => t.balls <= 120));
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test("limited overs: no bowler bowls more than a fifth of the overs", () => {
  const inn = new Match(CLUBS.BRK(), CLUBS.DAN(), "green", 20, new Rng(1), "bat", { innings: 2 }).inn;
  assert.equal(inn.bowlerQuota, 24);
  inn.bowl[0].balls = 24;
  assert.ok(!inn.canBowl(0));
  assert.ok(inn.canBowl(1));
  const test = new Match(CLUBS.BRK(), CLUBS.DAN(), "green", 0, new Rng(1), "bat", { test: true }).inn;
  assert.equal(test.bowlerQuota, Infinity);
});
