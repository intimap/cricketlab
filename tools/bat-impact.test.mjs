import test from "node:test";
import assert from "node:assert/strict";
import { BAT_BLADE, batImpact, bladeAngle, edgeExit } from "../src/sim/bat-impact.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";

const hit = (options = {}) => batImpact({ dx: 0, dy: 0, timing: 0, type: "drive", sweetWidth: 0.033, ...options });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test("toe and splice face contacts return less energy than the middle", () => {
  const middle = hit();
  const toe = hit({ dy: -0.17 });
  const splice = hit({ dy: 0.30 });
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
  assert.equal(hit({ dx: 0.089 }).missed, false);
  assert.equal(hit({ dx: 0.091 }).missed, true);
  assert.equal(hit({ dy: -0.22 }).missed, false);
  assert.equal(hit({ dy: -0.24 }).missed, true);
  assert.equal(hit({ dy: 0.40 }).region, "handle");
  assert.equal(hit({ dy: 0.60 }).missed, true);
});

test("length and width follow bat orientation for cuts, pulls, sweeps and ramps", () => {
  for (const [type, back] of [["drive"], ["defend"], ["cutpull", "punch"], ["cutpull", "cut"],
    ["cutpull", "pull"], ["sweep"], ["reverseSweep"], ["ramp"]]) {
    const angle = bladeAngle(type, back);
    // Rotate the same bat-local contact back into world coordinates.
    const width = 0.045;
    const length = -0.15;
    const impact = hit({ type, back, dx: width * Math.cos(angle) + length * Math.sin(angle),
      dy: -width * Math.sin(angle) + length * Math.cos(angle) });
    near(impact.across, width);
    near(impact.along, BAT_BLADE.sweet + length);
    assert.equal(impact.region, "toe");
    assert.equal(impact.edge, true);
  }
});

test("thin-to-thick deflection is continuous on both edges", () => {
  const thin = hit({ dx: 0.085 });
  const thick = hit({ dx: 0.04 });
  assert.ok(thin.thickness < thick.thickness);
  for (const side of [-1, 1]) {
    const a = edgeExit(thin, 30, 20, false, side);
    const b = edgeExit(thick, 30, 20, false, side);
    assert.ok(Math.abs(a.bearing) > Math.abs(b.bearing));
    const left = edgeExit(hit({ dx: 0.062 - 1e-8 }), 30, 20, false, side);
    const right = edgeExit(hit({ dx: 0.062 + 1e-8 }), 30, 20, false, side);
    assert.ok(Math.abs(left.bearing - right.bearing) < 0.001);
    assert.ok(Math.abs(left.speed - right.speed) < 0.001);
  }
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
    const contacts = records.filter(r => r.impact && r.contact !== "none");
    assert.ok(contacts.length > 0);
    for (const rec of contacts) {
      assert.equal(rec.impact.missed, false);
      assert.ok(Number.isFinite(rec.impact.across) && Number.isFinite(rec.impact.along));
      assert.ok(Number.isFinite(rec.exit.x) && Number.isFinite(rec.exit.z));
      assert.ok(rec.impact.energy > 0 && rec.impact.energy <= 1);
    }
  }
});
