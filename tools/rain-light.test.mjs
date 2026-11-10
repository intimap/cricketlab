import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { WEATHER } from "../src/sim/weather.js";
import { TestClock } from "../src/sim/test-match.js";
import { resources, showerComes, limitedRain, revisedTarget, MIN_OVERS } from "../src/sim/rain.js";
import { LIGHTS } from "../src/render/light.js";
import { weatherLight } from "../src/render/weather-look.js";
import { timeNow, endTime, ballKindFor } from "../src/scenes/match-light.js";

const day = (id) => ({ id, ...WEATHER[id], temp: 15, lost: 0 });
// A dry day, so the only rain is the stoppage each test brings on itself.
const oneDay = (seed, weather = day("sunny")) =>
  new Match(australia(), england(), "green", 50, new Rng(seed), "bat", { innings: 2, weather });

test("batting left to use grows with overs and shrinks with wickets", () => {
  assert.equal(resources(0, 0), 0);
  assert.equal(resources(30, 10), 0);
  assert.ok(resources(50, 0) > resources(20, 0));
  assert.ok(resources(20, 0) > resources(20, 5));
  // 20 overs with all ten wickets is worth well over a third of a full 50 (more of each over gets used).
  const share = resources(20, 0) / resources(50, 0);
  assert.ok(share > 0.5 && share < 0.65, `${share}`);
});

test("no dice are rolled for rain on a dry day", () => {
  const m = oneDay(3, day("sunny"));
  const before = m.rng.state;
  for (let i = 0; i < 50; i++) assert.equal(showerComes(m), false);
  assert.equal(m.rng.state, before);
});

test("rain in the first innings cuts both sides' overs and the chase is scaled", () => {
  const m = oneDay(5);
  // The rain comes ten overs in, while the first innings is still going.
  while (m.inn.legal < 60) m.simBall();
  assert.ok(!m.inn.isOver);
  const rain = limitedRain(m);
  assert.ok(rain.lost >= 1 && rain.overs < 50 && rain.overs >= MIN_OVERS);
  assert.equal(m.overs, rain.overs);
  assert.equal(m.inn.oversLimit, rain.overs);
  while (!m.inn.isOver) m.simBall();
  const runs = m.inn.runs;
  m.nextInnings();
  assert.equal(m.inn.oversLimit, rain.overs);
  assert.equal(m.inn.target, revisedTarget(m, runs));
});

test("rain in the chase cuts its overs and lowers the target", () => {
  const m = oneDay(7);
  while (!m.inn.isOver) m.simBall();
  const runs = m.inn.runs;
  m.nextInnings();
  assert.equal(m.inn.target, runs + 1);
  for (let i = 0; i < 60; i++) m.simBall();
  const rain = limitedRain(m);
  assert.ok(rain.target <= runs + 1, `${rain.target} vs ${runs + 1}`);
  assert.equal(m.inn.target, rain.target);
  assert.equal(m.inn.oversLimit, rain.overs);
});

test("a long stoppage ends a Test day, and the next starts with its own weather", () => {
  const clock = new TestClock(new Rng(9), "lords");
  for (let i = 0; i < 20; i++) clock.overBowled();
  const quota = clock.quota;
  const part = clock.loseOvers(10);
  assert.deepEqual(part, { lost: 10, dayOver: false });
  assert.equal(clock.quota, quota - 10);
  const all = clock.loseOvers(500);
  assert.ok(all.dayOver);
  assert.equal(clock.day, 2);
  assert.equal(clock.today, 0);
  assert.ok(!clock.lunch && !clock.tea);
});

test("lunch and tea still come when rain shortens the day", () => {
  const clock = new TestClock(new Rng(11), "theG");
  const breaks = [];
  for (let i = 0; i < 20; i++) breaks.push(clock.overBowled());
  clock.loseOvers(30);
  while (clock.day === 1) breaks.push(clock.overBowled());
  assert.deepEqual(breaks.filter(Boolean), ["lunch", "tea", "stumps"]);
});

test("each weather lays its own light over the time of day", () => {
  assert.equal(weatherLight(LIGHTS.midday, "sunny"), LIGHTS.midday);
  const grey = weatherLight(LIGHTS.midday, "overcast");
  assert.equal(weatherLight(LIGHTS.midday, "overcast"), grey, "made once");
  assert.ok(grey.hd.sky, "a cloudy sky");
  assert.ok(
    grey.hd.casts.every((c) => c.alpha < LIGHTS.midday.hd.casts[0].alpha),
    "faint shadows",
  );
  assert.ok(grey.clouds.count > 1);
  const wet = weatherLight(LIGHTS.night, "rain", true);
  assert.equal(wet.hd.sky.stars, 0);
  assert.ok(wet.hd.lamps, "the floodlights stay on");
  assert.ok(weatherLight(LIGHTS.midday, "humid").hd.grade.haze);
});

test("the light moves on through a Test day and a long game, and the ball suits it", () => {
  const scene = (cfg, match) => ({ cfg, match, nets: false });
  const clock = { session: 0 };
  const test = { format: "test", light: "afternoon" };
  assert.equal(timeNow(scene(test, { clock })), "afternoon");
  clock.session = 2;
  assert.equal(timeNow(scene(test, { clock })), "night");
  assert.equal(endTime({ format: "test", light: "midday" }), "evening");
  assert.equal(ballKindFor({ format: "test", light: "midday" }), "red");
  assert.equal(ballKindFor(test), "pink");
  assert.equal(ballKindFor({ format: "match", overs: 50, light: "night" }), "white");
  const game = { format: "match", overs: 50, light: "midday" };
  const chase = { innings: [1, 2], inn: { legal: 100, oversLimit: 50 } };
  assert.equal(timeNow(scene(game, { innings: [1], inn: { legal: 0, oversLimit: 50 } })), "midday");
  assert.equal(timeNow(scene(game, chase)), "afternoon");
  chase.inn.legal = 200;
  assert.equal(timeNow(scene(game, chase)), "evening");
  assert.equal(timeNow(scene({ ...game, overs: 10 }, chase)), "midday", "short games keep their light");
});
