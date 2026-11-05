import test from "node:test";
import assert from "node:assert/strict";
import { bladeFor, batBody, swingSpeedOf, swingTimeOf, windowOf, reachOf, bladeLabel, AVERAGE_BLADE } from "../src/sim/bats.js";
import { strike } from "../src/sim/bat-ball.js";
import { batImpact } from "../src/sim/bat-impact.js";
import { TEAMS } from "../src/sim/team-list.js";
import { styleName } from "../src/sim/teams.js";
import { textWidth } from "../src/engine/text.js";
import { SHEET, COLUMNS } from "../src/render/team-sheet.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";

const ball = { x: 0, y: 1.5, z: -37.5 };
const hit = (blade, dx = 0) => {
  const impact = batImpact({ dx, dy: 0, timing: 0, type: "drive", sweetWidth: 0.033 });
  const v = strike({
    ball,
    bearing: 30,
    tilt: -1,
    speed: 12.4,
    impact,
    offset: { x: impact.across, y: 0 },
    bat: batBody(blade),
  }).vel;
  return Math.hypot(v.x, v.y, v.z);
};

test("a bat comes from his power and height, and the squad can say otherwise", () => {
  const strong = bladeFor({ power: 0.9 }, { height: 1.85 });
  const light = bladeFor({ power: 0.3 }, { height: 1.75 });
  assert.ok(strong.weight > light.weight && strong.edges > light.edges);
  assert.equal(bladeFor({ power: 0.5 }, { height: 1.95 }).handle, "long");
  assert.equal(bladeFor({ power: 0.5 }, { height: 1.7 }).handle, "short");
  assert.equal(bladeFor({ power: 0.5 }, { height: 1.8 }).handle, "normal");
  assert.deepEqual(bladeFor({ power: 0.5 }, { height: 1.8 }, { weight: 1.38, edges: 44 }).weight, 1.38);
});

test("every player in every squad has a bat in range", () => {
  for (const make of Object.values(TEAMS)) {
    for (const p of make().players) {
      assert.ok(p.blade.weight >= 1.1 && p.blade.weight <= 1.4, `${p.name} ${p.blade.weight}`);
      assert.ok(p.blade.edges >= 36 && p.blade.edges <= 44, `${p.name} ${p.blade.edges}`);
      assert.ok(["short", "normal", "long"].includes(p.blade.handle));
    }
  }
});

test("a heavier bat hits harder at the same swing, but swings slower, comes down later and has a narrower window", () => {
  const heavy = { ...AVERAGE_BLADE, weight: 1.4 };
  const light = { ...AVERAGE_BLADE, weight: 1.1 };
  assert.ok(hit(heavy) > hit(AVERAGE_BLADE) && hit(AVERAGE_BLADE) > hit(light));
  assert.ok(swingSpeedOf(heavy) < 1 && swingSpeedOf(light) > 1);
  assert.ok(swingTimeOf(heavy) > 1 && swingTimeOf(light) < 1);
  assert.ok(windowOf(heavy) < 1 && windowOf(light) > 1);
  // Still, at their own swing speeds, the heavy bat hits it harder.
  assert.ok(hit(heavy) * 0.98 > hit(light));
  assert.equal(swingSpeedOf(AVERAGE_BLADE), 1);
  assert.equal(windowOf(AVERAGE_BLADE), 1);
});

test("big edges keep more pace off an edge; a long handle reaches further", () => {
  const big = { ...AVERAGE_BLADE, edges: 44 };
  const thin = { ...AVERAGE_BLADE, edges: 36 };
  assert.ok(hit(big, 0.07) > hit(thin, 0.07) + 0.5);
  assert.ok(Math.abs(hit(big) - hit(thin)) < 1e-9);
  assert.ok(reachOf({ ...AVERAGE_BLADE, handle: "long" }) > 0 && reachOf({ ...AVERAGE_BLADE, handle: "short" }) < 0);
});

test("the team sheet's columns hold every name, bat and job", () => {
  for (const make of Object.values(TEAMS)) {
    for (const p of make().players) {
      assert.ok(COLUMNS.name + textWidth(p.name.toUpperCase()) < COLUMNS.hand - 3, p.name);
      assert.ok(COLUMNS.bat + textWidth(bladeLabel(p.blade)) < COLUMNS.role - 3, bladeLabel(p.blade));
      const job = p.keeper ? "KEEPER" : p.bowl ? styleName(p.bowl) : "BATTER";
      assert.ok(COLUMNS.role + textWidth(job) < SHEET.w - 4, job);
    }
  }
  assert.equal(bladeLabel({ weight: 1.3, edges: 43, handle: "long" }), "1.30+L");
});

test("the striker plays with his own bat", () => {
  const m = new Match(TEAMS.AUS(), TEAMS.ENG(), "green", 50, new Rng(3), "bat");
  m.startOver();
  const { intent, releaseError } = m.aiPlan();
  const d = m.deliver(intent, releaseError);
  const shot = m.aiShot(d);
  m.resolve(intent, d, shot, false);
  assert.deepEqual(shot.blade, m.inn.bat[m.inn.striker].p.blade);
});
