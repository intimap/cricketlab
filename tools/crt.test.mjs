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
