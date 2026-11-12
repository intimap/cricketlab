import test from "node:test";
import assert from "node:assert/strict";
import { throughGlass } from "../src/engine/crt.js";

test("the CRT's curve leaves the middle and the edge midpoints where they are, and bows the corners out", () => {
  assert.deepEqual(throughGlass(0.5, 0.5), { u: 0.5, v: 0.5 });
  assert.deepEqual(throughGlass(0, 0.5), { u: 0, v: 0.5 });
  assert.deepEqual(throughGlass(0.5, 1), { u: 0.5, v: 1 });
  // A corner of the glass is past the corner of the picture (it shows black there).
  const corner = throughGlass(0, 0);
  assert.ok(corner.u < 0 && corner.v < 0);
  // Symmetric about the middle, and it never folds back on itself.
  const a = throughGlass(0.2, 0.3);
  const b = throughGlass(0.8, 0.7);
  assert.ok(Math.abs(a.u + b.u - 1) < 1e-9 && Math.abs(a.v + b.v - 1) < 1e-9);
  let last = -Infinity;
  for (let u = 0; u <= 1; u += 0.05) {
    const { u: x } = throughGlass(u, 0.1);
    assert.ok(x > last);
    last = x;
  }
});

test("the CRT look: CLASSIC is the original look, presets set every part, a change of part is CUSTOM and kept", async () => {
  const crt = await import("../src/engine/crt-settings.js");
  // Nothing saved: CLASSIC, every part MED, the numbers the shader always had.
  assert.equal(crt.crtPreset(), "classic");
  assert.ok(crt.crtEnabled());
  const classic = crt.crtValues();
  assert.deepEqual(
    { ...classic, curve: undefined },
    { scanlines: 0.38, mask: 0.14, glow: 1, fringe: 0.35, corners: 0.22, flicker: 0.008, brightness: 1.18, curve: undefined },
  );
  assert.ok(Math.abs(classic.curve.x - 5.5) < 1e-9 && Math.abs(classic.curve.y - 4.5) < 1e-9);
  const classicCorner = throughGlass(0.1, 0.1).u;
  crt.setCrtPreset("strong");
  assert.equal(crt.crtLevel("scanlines"), "high");
  assert.equal(crt.crtLevel("flicker"), "med");
  // A stronger curve bows the corners further out.
  assert.ok(throughGlass(0.1, 0.1).u < classicCorner - 0.005);
  // One part changed: CUSTOM, and it stays among the presets to come back to.
  crt.cycleCrtLevel("glow", -1);
  assert.equal(crt.crtPreset(), "custom");
  crt.setCrtPreset("classic");
  assert.equal(crt.crtLevel("glow"), "med");
  crt.cycleCrtPreset(-1);
  assert.equal(crt.crtPreset(), "subtle");
  crt.setCrtPreset("custom");
  assert.equal(crt.crtLevel("glow"), "med");
  assert.equal(crt.crtLevel("scanlines"), "high");
  // Changing a part back to a preset's levels makes it that preset.
  crt.setCrtPreset("classic");
  crt.cycleCrtLevel("fringe", 1);
  crt.cycleCrtLevel("fringe", -1);
  assert.equal(crt.crtPreset(), "classic");
  // SHARP is off; switching on again brings the look back.
  crt.setCrtPreset("sharp");
  assert.ok(!crt.crtEnabled());
  crt.setCrt(true);
  assert.equal(crt.crtPreset(), "classic");
});
