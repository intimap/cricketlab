import test from "node:test";
import assert from "node:assert/strict";
import { BATTER_CLIPS } from "../src/render/batter/batter-motion-all.js";
import { strokeFrames, worstJolt } from "./batter-snaps.mjs";

// Smooth strokes: no joint lurches as a stroke joins the stance, passes contact or eases back (see the tool).
test("no stroke jolts its joints more than the whip shots do", () => {
  for (const name of Object.keys(BATTER_CLIPS)) {
    const { jolt, t, joint } = worstJolt(strokeFrames(name));
    assert.ok(jolt < 80, `${name}: jolt ${jolt.toFixed(1)} at ${t.toFixed(2)}s (${joint})`);
  }
});

test("drives flow through contact", () => {
  for (const name of Object.keys(BATTER_CLIPS).filter((n) => /Drive$/.test(n) && n !== "backFootDrive")) {
    const { jolt } = worstJolt(strokeFrames(name));
    assert.ok(jolt < 25, `${name}: jolt ${jolt.toFixed(1)}`);
  }
});
