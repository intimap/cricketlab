import test from "node:test";
import assert from "node:assert/strict";
import { ASSIST, noteAssist } from "../src/scenes/assists.js";
import { gradeTap, rhythmOf } from "../src/sim/rhythm.js";
import { validEntry } from "../src/sim/leaderboard.js";

test("the match keeps the easiest assist level it was played at", () => {
  const match = {};
  noteAssist(match, "normal");
  noteAssist(match, "hard");
  assert.equal(match.easiestAssist, "normal");
  noteAssist(match, "easy");
  noteAssist(match, "hard");
  assert.equal(match.easiestAssist, "easy");
});

test("EASY widens the beats and a miss costs little; HARD narrows them", () => {
  const { easy, hard } = ASSIST;
  assert.ok(gradeTap(0.06, "med", easy.beatWiden) > gradeTap(0.06, "med"));
  assert.ok(gradeTap(0.03, "med", hard.beatWiden) < gradeTap(0.03, "med"));
  assert.equal(rhythmOf([null, null], "med", easy.beatWiden, easy.missedBeat), 0.5);
  assert.equal(rhythmOf([null, null], "med"), 0);
  assert.ok(easy.zone > 1 && hard.zone < 1);
});

test("a score keeps the assist it was played at, and nothing else gets through", () => {
  const base = { board: "match-10", name: "AB", rank: 1, at: 1, text: "WON", score: "AUS 1" };
  assert.equal(validEntry({ ...base, assist: "easy" }).assist, "easy");
  assert.equal(validEntry({ ...base, assist: "cheat" }).assist, null);
});
