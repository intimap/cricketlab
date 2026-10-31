import test from "node:test";
import assert from "node:assert/strict";
import { projectWide, unprojectWide, ROPE } from "../src/render/camera.js";
import { BOUNDARY, MID_PITCH } from "../src/sim/geometry.js";
import { GROUNDS, GROUND_CHOICES } from "../src/render/grounds.js";

const ellipseRadius = (p) => Math.hypot((p.x - ROPE.cx) / ROPE.rx, (p.y - ROPE.cy) / (p.y < ROPE.cy ? ROPE.ryFar : ROPE.ryNear));

test("every boundary bearing projects onto the same rope as the generated rim", () => {
  for (let degrees = 0; degrees < 360; degrees++) {
    const a = degrees * Math.PI / 180;
    const p = projectWide(BOUNDARY * Math.sin(a), 0, MID_PITCH + BOUNDARY * Math.cos(a));
    assert.ok(Math.abs(ellipseRadius(p) - 1) < 1e-8);
    assert.ok(p.x >= 49 && p.x <= 588 && p.y >= 106 && p.y <= 291);
  }
  assert.ok(ROPE.cy + ROPE.ryNear < 300, "near-side terraces must fit above the score bar");
});

test("fielder placement round-trips through the resized camera within a centimetre", () => {
  for (let degrees = 0; degrees < 360; degrees += 3) for (const d of [0, 5, 20, 40, BOUNDARY]) {
    const a = degrees * Math.PI / 180;
    const x = d * Math.sin(a), z = MID_PITCH + d * Math.cos(a);
    const p = projectWide(x, 0, z), q = unprojectWide(p.x, p.y);
    assert.ok(Math.hypot(q.x - x, q.z - z) < 0.01);
  }
});

test("all playable venues have a perimeter without covering or moving their far landmarks", () => {
  for (const id of GROUND_CHOICES) {
    const wide = GROUNDS[id].wide;
    assert.ok(wide.perimeter.startsWith("wide/"), id);
    assert.equal(wide.groundFrom, ROPE.cy - ROPE.ryFar);
    assert.ok(wide.innerCircle.cy < ROPE.cy + 1);
  }
});
