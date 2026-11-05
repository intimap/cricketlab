import test from "node:test";
import assert from "node:assert/strict";
import { SHOT_CATALOG, clipForShot } from "../src/render/batter/batter-catalog.js";
import { BATTER_CLIPS } from "../src/render/batter/batter-motion-all.js";
import { strokeName } from "../src/sim/strokes.js";

test("every stroke in the catalogue has a clip to play", () => {
  for (const row of SHOT_CATALOG) assert.ok(BATTER_CLIPS[row.id], `${row.shotName}: no clip ${row.id}`);
});

test("the matrix's strokes find their clips, and versions of a stroke play its clip", () => {
  assert.equal(clipForShot("cutpull", "upper cut"), "upperCut");
  assert.equal(clipForShot("cutpull", "front-foot pull"), "frontFootPull");
  assert.equal(clipForShot("cutpull", "pull from inside the line"), "pull");
  assert.equal(clipForShot("sweep", "slog-sweep"), "slogSweep");
  assert.equal(clipForShot("reverseSweep", "switch hit"), "switchHit");
  assert.equal(clipForShot("defend", "smother"), "smother");
  assert.equal(clipForShot("defend", "dig out"), "jab");
  assert.equal(clipForShot("defend", "fend"), "fend");
  assert.equal(clipForShot("leave", "sway"), "sway");
  assert.equal(clipForShot("leave", "duck"), "duck");
  assert.equal(clipForShot("leave", ""), "leave");
  assert.equal(clipForShot("drive", "charging cover drive"), "coverDrive");
  assert.equal(clipForShot("loft", "charging inside-out lofted cover drive"), "loftedCoverDrive");
  assert.equal(clipForShot("drive", "whip through midwicket"), "clipOffPads");
  // A front-foot punch is a drive; a computer's drive off the back foot plays the back-foot drive.
  assert.equal(clipForShot("cutpull", "straight drive"), "straightDrive");
  assert.equal(clipForShot("drive", "back-foot drive"), "backFootDrive");
});

test("every name the matrix gives an attacking stroke plays a clip", () => {
  const feet = [
    { stride: "forward", across: 0 },
    { stride: "back", across: 0 },
    { stride: "crease", across: 0 },
    { stride: "down", across: 0 },
    { stride: "forward", across: -0.25 },
    { stride: "back", across: 0.25 },
  ];
  const backs = { cutpull: ["cut", "upperCut", "punch", "pull", "glance"] };
  for (const type of ["drive", "loft", "cutpull", "sweep", "reverseSweep", "ramp", "defend"]) {
    for (const f of feet) {
      for (const bearing of [-150, -60, -20, 0, 30, 60, 100, 140, 175]) {
        for (const back of backs[type] ?? [null]) {
          for (const variant of [null, "slog", "aerial"]) {
            const name = strokeName({ type, bearing, height: 1, back, feet: f, variant, pitchZ: 5, line: 0 });
            assert.ok(
              clipForShot(type, name),
              `${type} ${JSON.stringify(f)} ${bearing} ${back} ${variant}: "${name}" has no clip`,
            );
          }
        }
      }
    }
  }
});
