import test from "node:test";
import assert from "node:assert/strict";
import { CHATTER, pickSledges, pickChirp } from "../src/sim/field-chatter.js";
import { TEAM_IDS } from "../src/sim/team-list.js";
import { wrapText } from "../src/engine/text.js";

// What the pixel font can draw (engine/text.js).
const DRAWABLE = /^[A-Z0-9 .,:;!?'"\-+/()&*%#=<>_|~[\]{}]+$/;

test("every side has its own send-offs and chirps, all drawable and short enough for a bubble", () => {
  const seen = new Set();
  for (const id of TEAM_IDS) {
    const sledges = CHATTER.SLEDGES[id];
    const chirps = CHATTER.CHIRPS[id];
    assert.ok(sledges?.length >= 12, `${id} send-offs`);
    assert.ok(chirps?.length >= 3, `${id} chirps`);
    for (const line of [...sledges, ...chirps]) {
      assert.match(line, DRAWABLE, `${id}: ${line}`);
      // The speech bubble wraps at 24 characters (render/hud.js): three lines at most, even for a long name.
      assert.ok(wrapText(line.replace("{N}", "KARUNARATNA"), 24).length <= 3, `${id} too long: ${line}`);
      assert.ok(!seen.has(line), `${id} repeats another side's line: ${line}`);
      seen.add(line);
    }
  }
});

test("send-offs name the batter and never repeat in one wicket's chatter", () => {
  const lines = pickSledges("IND", "Root", 3);
  assert.equal(new Set(lines).size, 3);
  assert.ok(lines.every((l) => !l.includes("{N}")));
  assert.ok(CHATTER.CHIRPS.SL.includes(pickChirp("SL")));
  assert.ok(CHATTER.CHIRPS.ENG.includes(pickChirp("XYZ")), "an unknown side sounds English");
});
