import test from "node:test";
import assert from "node:assert/strict";
import { BAT_BLADE, batImpact, bladeAngle } from "../src/sim/bat-impact.js";
import { BALL_RADIUS } from "../src/sim/geometry.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";

const hit = (options = {}) => batImpact({ dx: 0, dy: 0, timing: 0, type: "drive", sweetWidth: 0.033, ...options });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test("toe and splice face contacts return less energy than the middle", () => {
  const middle = hit();
  const toe = hit({ dy: -0.17 });
  const splice = hit({ dy: 0.3 });
  assert.equal(middle.region, "middle");
  near(middle.along, BAT_BLADE.sweet);
  near(middle.energy, 1);
  assert.equal(toe.region, "toe");
  assert.equal(splice.region, "splice");
  for (const impact of [toe, splice]) {
    assert.equal(impact.edge, false);
    assert.equal(impact.missed, false);
    assert.ok(impact.energy > 0 && impact.energy < middle.energy);
  }
  assert.ok(hit({ dy: -0.19 }).energy < toe.energy);
  assert.ok(hit({ dy: 0.34 }).energy < splice.energy);
});

test("ball radius permits grazing contacts but excludes air beyond toe, blade and handle", () => {
  // Limits follow the ball's size, so changing BALL_RADIUS doesn't break the test.
  const edge = BAT_BLADE.halfWidth + BALL_RADIUS;
  const toe = -(BAT_BLADE.sweet + BALL_RADIUS);
  const handle = BAT_BLADE.handle + BALL_RADIUS - BAT_BLADE.sweet;
  assert.equal(hit({ dx: edge - 0.001 }).missed, false);
  assert.equal(hit({ dx: edge + 0.001 }).missed, true);
  assert.equal(hit({ dy: toe + 0.01 }).missed, false);
  assert.equal(hit({ dy: toe - 0.01 }).missed, true);
  assert.equal(hit({ dy: 0.4 }).region, "handle");
  assert.equal(hit({ dy: handle + 0.01 }).missed, true);
});

test("length and width follow bat orientation for cuts, pulls, sweeps and ramps", () => {
  for (const [type, back] of [
    ["drive"],
    ["defend"],
    ["cutpull", "punch"],
    ["cutpull", "cut"],
    ["cutpull", "pull"],
    ["sweep"],
    ["reverseSweep"],
    ["ramp"],
  ]) {
    const angle = bladeAngle(type, back);
    // Rotate the same bat-local contact back into world coordinates.
    const width = 0.045;
    const length = -0.15;
    const impact = hit({
      type,
      back,
      dx: width * Math.cos(angle) + length * Math.sin(angle),
      dy: -width * Math.sin(angle) + length * Math.cos(angle),
    });
    near(impact.across, width);
    near(impact.along, BAT_BLADE.sweet + length);
    assert.equal(impact.region, "toe");
    assert.equal(impact.edge, true);
  }
});

test("edge thickness falls smoothly from the face to the rim", () => {
  let last = 1;
  for (let dx = 0.034; dx < 0.1; dx += 0.004) {
    const t = hit({ dx }).thickness;
    assert.ok(t <= last, `${dx}: ${t} after ${last}`);
    last = t;
  }
  assert.ok(Math.abs(hit({ dx: 0.062 - 1e-9 }).thickness - hit({ dx: 0.062 + 1e-9 }).thickness) < 1e-6);
});

test("timing shifts contact along the blade without extra random draws", () => {
  near(hit({ timing: 2 }).along, BAT_BLADE.sweet - 0.07);
  near(hit({ timing: -2 }).along, BAT_BLADE.sweet + 0.07);
});

test("seeded match records retain contact geometry and finite velocities on every pitch", () => {
  for (const pitch of ["green", "dust", "cracked"]) {
    const run = () => {
      const match = new Match(australia(), england(), pitch, 10, new Rng(43), "bat");
      const records = [];
      while (!match.inn.isOver) records.push(match.simBall().rec);
      return records;
    };
    const records = run();
    assert.deepEqual(run(), records, `Non-deterministic outcomes on ${pitch}`);
    const contacts = records.filter((r) => r.impact && r.contact !== "none");
    assert.ok(contacts.length > 0);
    for (const rec of contacts) {
      assert.equal(rec.impact.missed, false);
      assert.ok(Number.isFinite(rec.impact.across) && Number.isFinite(rec.impact.along));
      assert.ok(Number.isFinite(rec.exit.x) && Number.isFinite(rec.exit.z));
      assert.ok(rec.impact.energy > 0 && rec.impact.energy <= 1);
    }
  }
});
