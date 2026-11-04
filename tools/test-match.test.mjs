import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { createMatch } from "../src/sim/formats.js";
import { TestClock, DAY_OVERS, TEST_DAYS, followOnOption, testStatus } from "../src/sim/test-match.js";
import { WEATHER, rollWeather, weatherEffects } from "../src/sim/weather.js";
import { weatherCall, breakCall, declareCall } from "../src/sim/booth-weather-lines.js";
import { resultEntry, boardFor, BOARD_PATTERN } from "../src/sim/leaderboard.js";
import { fitsBox } from "../src/render/booth.js";

const newTest = (seed, human = "bat") =>
  new Match(australia(), england(), "green", 0, new Rng(seed), human, { test: true, ground: "lords" });

/** Play the current innings out on the computer. */
function playInnings(m) {
  for (let i = 0; !m.inn.isOver && i < 4000; i++) m.simBall();
}

test("a Test day is 90 overs less the rain, with lunch, tea and stumps", () => {
  const clock = new TestClock(new Rng(3), "lords");
  const quota = clock.quota;
  assert.equal(quota, DAY_OVERS - clock.lostToday);
  const breaks = [];
  for (let i = 0; i < quota; i++) breaks.push(clock.overBowled());
  assert.deepEqual(breaks.filter(Boolean), ["lunch", "tea", "stumps"]);
  assert.equal(clock.day, 2);
  assert.equal(clock.today, 0);
});

test("the clock runs out after five days", () => {
  const clock = new TestClock(new Rng(5), "theG");
  for (let i = 0; i < TEST_DAYS * DAY_OVERS && !clock.finished; i++) clock.overBowled();
  assert.ok(clock.finished);
  assert.equal(clock.oversLeft, 0);
});

test("a Test innings lasts as long as the time left in the match", () => {
  const m = newTest(7);
  assert.equal(m.inn.oversLimit, m.clock.oversLeft);
  assert.equal(m.tempo, 0);
  assert.ok(m.inn.test);
  playInnings(m);
  // Still the time left, counted from the overs this innings has had.
  assert.equal(m.inn.oversLimit, Math.floor(m.inn.legal / 6) + m.clock.oversLeft);
});

test("declaring ends the innings and the other side replies", () => {
  const m = newTest(11);
  for (let i = 0; i < 60; i++) m.simBall();
  m.declare();
  assert.ok(m.inn.isOver && m.inn.declared);
  assert.ok(m.hasNextInnings);
  const first = m.inn.batTeam;
  m.nextInnings();
  assert.notEqual(m.inn.batTeam, first);
  assert.equal(m.human, "bowl");
  assert.equal(m.inn.target, null);
});

test("a big first-innings lead offers the follow-on, and enforcing it sends the same side back in", () => {
  const m = newTest(13);
  m.inn.runs = 500;
  m.declare();
  m.nextInnings();
  m.inn.runs = 120;
  m.inn.wkts = 10;
  const option = followOnOption(m);
  assert.equal(option.lead, 380);
  assert.equal(option.captain, m.innings[0].batTeam);
  const following = m.inn.batTeam;
  m.nextInnings(true);
  assert.equal(m.inn.batTeam, following);
  assert.ok(m.followedOn);
  // Bowled out again still behind: an innings win.
  m.inn.runs = 200;
  m.inn.wkts = 10;
  const r = m.result;
  assert.equal(r.kind, "innings");
  assert.equal(r.margin, 180);
  assert.equal(r.winner, m.innings[0].batTeam);
  assert.ok(!m.hasNextInnings);
});

test("the fourth innings chases what's needed, and the draw comes when time runs out", () => {
  const m = newTest(17);
  m.inn.runs = 300;
  m.inn.wkts = 10;
  m.nextInnings();
  m.inn.runs = 250;
  m.inn.wkts = 10;
  m.nextInnings(false);
  m.inn.runs = 200;
  m.inn.wkts = 10;
  m.nextInnings();
  assert.equal(m.inn.target, 251);
  assert.match(testStatus(m), /^DAY \d+ {2}NEED 251 IN \d+ OV$/);
  // Run the clock down with the chase still on.
  while (!m.clock.finished) m.clock.overBowled();
  m.inn.oversLimit = Math.floor(m.inn.legal / 6) + m.clock.oversLeft;
  assert.ok(m.inn.isOver);
  assert.equal(m.result.kind, "draw");
  const entry = resultEntry(m);
  assert.equal(entry.text, "MATCH DRAWN");
  assert.ok(entry.score.length <= 22, entry.score);
});

test("a whole Test on the computer reaches a result", () => {
  const m = newTest(19);
  for (let n = 0; n < 4; n++) {
    playInnings(m);
    if (!m.hasNextInnings) break;
    m.nextInnings();
  }
  assert.ok(m.result, "no result");
  assert.ok(m.clock.day <= TEST_DAYS);
});

test("Tests have their own high-score table", () => {
  assert.equal(boardFor({ format: "test" }), "test");
  assert.ok(BOARD_PATTERN.test("test"));
});

test("weather is rolled for limited-overs games, and rain cuts the overs", () => {
  let cut = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const m = createMatch(
      { format: "match", mode: "bat", pitch: "green", overs: 50, ground: "lords", team: "AUS", opponent: "ENG" },
      new Rng(seed),
    );
    assert.ok(WEATHER[m.weather.id]);
    assert.equal(m.pitch.weather, m.weather);
    if (m.oversLost) {
      cut++;
      assert.equal(m.weather.id, "rain");
      assert.ok(m.overs >= 25 && m.overs < 50);
    }
  }
  assert.ok(cut > 0, "no rain in 80 games at Lord's");
  const short = createMatch({ format: "match", mode: "bat", pitch: "green", overs: 5, ground: "lords" }, new Rng(1));
  assert.equal(short.overs, 5);
});

test("a showery day often stays showery", () => {
  const rng = new Rng(23);
  let same = 0;
  for (let i = 0; i < 200; i++) if (rollWeather(rng, "lords", { id: "rain" }).id === "rain") same++;
  assert.ok(same > 110, `${same}`);
});

test("every weather says what it does, and the box's lines fit", () => {
  const pick = (list) => list[0];
  for (const [id, w] of Object.entries(WEATHER)) {
    assert.ok(weatherEffects(w).length >= 1, id);
    for (const who of [0, 1, 2]) {
      for (const lines of [0, 1]) {
        const text = weatherCall(who, { id, temp: 30 }, (list) => list[lines]);
        assert.ok(fitsBox(text), `${id} ${who}: ${text}`);
      }
    }
  }
  for (const brk of ["lunch", "tea", "stumps"])
    for (const who of [0, 1, 2]) {
      const text = breakCall(who, brk, { team: "NEW ZEALAND", score: "345/7", day: 4 }, pick);
      assert.ok(fitsBox(text), text);
    }
  for (const who of [0, 1, 2]) assert.ok(fitsBox(declareCall(who, pick)));
});
