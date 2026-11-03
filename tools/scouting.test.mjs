import test from "node:test";
import assert from "node:assert/strict";
import { scout, WEAKNESS_NAMES } from "../src/sim/scouting.js";

const inn = () => ({ bat: [{ p: { weakness: "offStump" } }] });
const troubled = { striker: 0, beatBat: true, battle: { weak: 1 } };

test("a weakness is hinted at, then given away, by balls aimed at it that cause trouble", () => {
  const i = inn();
  assert.equal(scout(i, { striker: 0, beatBat: false, battle: { weak: 1 } }), null, "no trouble, no clue");
  assert.equal(scout(i, { ...troubled, battle: { weak: 0.2 } }), null, "not aimed at it, no clue");
  assert.equal(scout(i, troubled).kind, "weaknessHint");
  const shown = scout(i, troubled);
  assert.equal(shown.kind, "weaknessShown");
  assert.equal(shown.tag, "LOOSE OUTSIDE OFF");
  assert.equal(scout(i, troubled), null, "said once");
});

test("weakness tags fit the batter's panel", () => {
  for (const { tag } of Object.values(WEAKNESS_NAMES)) assert.ok(tag.length <= 17, tag);
});
