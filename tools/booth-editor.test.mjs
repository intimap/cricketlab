import test from "node:test";
import assert from "node:assert/strict";
import { BoothEditor } from "../src/sim/booth-editor.js";
import { boothCall } from "../src/sim/commentators.js";
import { boothContext } from "../src/sim/booth-context.js";
import { repeatsHpd, safeBoothCalls } from "../src/sim/booth-policy.js";
import { BOOTH_STORIES } from "../src/sim/booth-stories.js";
import { fitsBox } from "../src/render/booth.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";

const rng = { random: () => 0, chance: () => false };
const names = { batter: "HEARN", bowler: "WOAKESLEY" };
const ball = (extra = {}) => ({ over: 0, striker: 0, bowler: 0, legal: true, total: 0, boundary: 0,
  contact: "middle", extra: { type: "", runs: 0 }, ...extra });
const innings = (extra = {}) => ({ legal: 1, striker: 0, target: null, runsNeeded: null, ballsLeft: 59,
  pressure: 0, partnership: { runs: 0 }, isOver: false,
  bat: [{ p: { short: "HEARN" }, runs: 0, balls: 1, eye: 0, out: false }],
  bowl: [{ p: { short: "WOAKESLEY" }, stamina: 1, balls: 1 }], ...extra });
const edit = (editor, rec, inn, hpd = "GOOD LENGTH, DEFENDED, NO RUN") =>
  editor.context(rec, hpd, names, rng, fitsBox, { inn });

test("the final gate rejects exact, normalised and embedded copies after substitution", () => {
  assert.ok(repeatsHpd("Hearn's drive: four!", "HEARN’S DRIVE - FOUR."));
  assert.ok(repeatsHpd("WELL, GOOD LENGTH OUTSIDE OFF DEFENDED NO RUN. PATIENT.", "GOOD LENGTH OUTSIDE OFF, DEFENDED, NO RUN"));
  assert.ok(!repeatsHpd("THAT FOUR RELIEVES SOME PRESSURE.", "FOUR"));
  const calls = [{ who: 0, text: "HEARN'S DRIVE - FOUR" }, { who: 1, text: "THAT SHOULD SETTLE HIM." }];
  assert.deepEqual(safeBoothCalls(calls, "HEARN’S DRIVE: FOUR!"), [calls[1]]);
  // A previously scheduled line is also rejected if it matches a later HPD.
  assert.equal(safeBoothCalls([calls[1]], "THAT SHOULD SETTLE HIM!").length, 0);
});

test("an ordinary ball always gets a primary call without copying the HPD", () => {
  const result = boothCall(ball({ shot: "defend" }), "NO RUN", names, rng, {}, fitsBox, { inn: innings() });
  assert.equal(result.calls[0].topic, "ballCall");
  assert.ok(!repeatsHpd(result.calls[0].text, "NO RUN"));
});

test("a full line that duplicates HPD is replaced by another safe contextual voice", () => {
  const editor = new BoothEditor();
  const hpd = BOOTH_STORIES.fifty.lines[0][0].replace("{b}", names.batter);
  const result = edit(editor, ball({ moment: { kind: "fifty" } }), innings(), hpd);
  assert.ok(result.calls.length);
  assert.ok(result.calls.every(call => !repeatsHpd(call.text, hpd)));
});

test("pressure context has three distinct commentator voices", () => {
  const outputs = [];
  for (let over = 0; over < 3; over++) {
    const result = edit(new BoothEditor(), ball({ over }), innings({ pressure: 0.8 }));
    assert.equal(result.calls[0].who, over);
    assert.equal(result.calls[0].topic, "pressure");
    outputs.push(result.calls[0].text);
  }
  assert.equal(new Set(outputs).size, 3);
});

test("all authored topics have fitting lines for every voice and no missing placeholders", () => {
  for (const [topic, story] of Object.entries(BOOTH_STORIES)) {
    for (const lines of story.lines) {
      const texts = lines.map(line => line.replace(/\{(?:b|w)\}/g, "LA BONSHANE").replace(/\{[^}]+\}/g, "123"));
      assert.ok(texts.some(fitsBox), `${topic} has no fitting line`);
      assert.ok(texts.every(text => !/\{[^}]*\}/.test(text)));
    }
    for (const line of story.reply ?? []) assert.ok(fitsBox(line), `${topic} reply overflows`);
  }
});

test("chase topics share a cooldown rather than repeating with different adjectives", () => {
  const editor = new BoothEditor();
  const inn = innings({ target: 200, runsNeeded: 100, requiredRate: 10 });
  assert.equal(edit(editor, ball(), inn).calls[0].topic, "chaseSteep");
  inn.legal++;inn.requiredRate = 6;
  assert.equal(edit(editor, ball(), inn).calls.length, 0);
});

test("a catch on a no-ball or free hit is not treated as a lost wicket", () => {
  for (const extra of [{ freeHit: true }, { extra: { type: "nb", runs: 1 } }]) {
    const editor = new BoothEditor();
    const result = edit(editor, ball({ dropped: "SLIP", ...extra }), innings());
    assert.equal(editor.drops.length, 0);
    assert.ok(result.calls.every(call => call.topic !== "drop"));
  }
});

test("context uses the actual ball's batter and requires a wide line for width criticism", () => {
  const memory = { drops: [], quiet: 0, dots: 0 };
  const inn = innings({ striker: 1, bat: [
    { p: { short: "ORIGINAL" }, eye: 0.8, balls: 40 },
    { p: { short: "NEXT" }, eye: 0, balls: 0 },
  ] });
  assert.ok(boothContext(ball(), inn, memory).some(o => o.topic === "setBatter"));
  const straight = boothContext(ball({ boundary: 4, runsBat: 4, seenBall: { line: "stumps" } }), inn, memory);
  assert.ok(!straight.some(o => o.topic === "width"));
  const wide = boothContext(ball({ boundary: 4, runsBat: 4, seenBall: { line: "wide" } }), inn, memory);
  assert.ok(wide.some(o => o.topic === "width"));
});

test("byes reaching the boundary do not become a bat-contact or width story", () => {
  const options = boothContext(ball({ boundary: 4, runsBat: 0, contact: "none", total: 4,
    extra: { type: "b", runs: 4 }, seenBall: { line: "wide" } }), innings(), { drops: [], quiet: 0, dots: 0 });
  assert.ok(options.every(o => o.topic !== "width" && o.topic !== "luckyBoundary"));
});

test("banter is eligible only after a real lull and never over a big event", () => {
  const memory = { drops: [], quiet: 12, dots: 0 };
  assert.ok(boothContext(ball(), innings(), memory).some(o => o.topic === "lull"));
  for (const rec of [ball({ wicket: { batter: 0 } }), ball({ boundary: 4 }), ball({ extra: { type: "wd" } })]) {
    assert.ok(!boothContext(rec, innings(), memory).some(o => o.topic === "lull"));
  }
  assert.ok(!boothContext(ball(), innings(), { ...memory, quiet: 11 }).some(o => o.topic === "lull"));
});

test("unrenderable lines, invalid speakers and duplicate replies are filtered", () => {
  const result = new BoothEditor().edit(ball({ moment: { kind: "hundred" } }), "HUNDRED", names, rng, () => false);
  assert.deepEqual(result.calls, []);
  assert.equal(safeBoothCalls([{ who: 0, text: "{b}" }, { who: -1, text: "HELLO" }], "").length, 0);
  assert.equal(safeBoothCalls([{ who: 0, text: "PATIENCE." }, { who: 1, text: "Patience!" }], "").length, 1);
});

test("booth editing leaves HPD, match state and all simulation records unchanged", () => {
  let checked = 0;
  let spoken = 0;
  for (const pitch of ["green", "dust", "cracked"]) for (const target of [null, 80]) {
    const create = () => new Match(australia(), england(), pitch, 15, new Rng(43), "bat", { target });
    const match = create();
    const control = create();
    const editor = new BoothEditor();
    while (!match.inn.isOver) {
      const rec = match.simBall().rec;
      const reference = control.simBall().rec;
      const state = match.rng.state;
      const snapshot = JSON.stringify(rec);
      const name = match.inn.bat[rec.wicket?.batter ?? rec.striker].p.short;
      const result = editor.edit(rec, rec.call, { batter: name, bowler: match.inn.bowl[rec.bowler].p.short },
        { random: () => .25, chance: () => true }, fitsBox, { inn: match.inn });
      assert.equal(match.rng.state, state);
      assert.equal(JSON.stringify(rec), snapshot);
      assert.deepEqual(rec, reference);
      assert.ok(result.calls.some(call => call.topic === "ballCall"), "Uncalled ball");
      for (const call of result.calls) {
        assert.ok(fitsBox(call.text));
        assert.ok(!repeatsHpd(call.text, rec.call));
        spoken++;
      }
      checked++;
    }
    assert.equal(control.inn.isOver, true);
    assert.equal(match.inn.runs, control.inn.runs);
  }
  assert.ok(checked > 100 && spoken > 20, `${checked} balls, ${spoken} comments`);
});
