import test from "node:test";
import assert from "node:assert/strict";
import { allGroups, LINE_FILES, VOICES, KINDS, FORMATS, textOf, voiceLines, anyLines, exchangesFor } from "../src/sim/lines.js";
import { SITUATIONS, COMMON_FACTS, RUNUP_CHARS } from "../src/sim/situations.js";
import { fitsBox } from "../src/render/booth.js";
import { fitsHud } from "../src/render/call-line.js";

/**
 * The commentary's line files (src/sim/lines/*.json), checked so lines can be added by hand: every group
 * names a known situation, case, kind and voices; every line uses only its situation's facts and fits where
 * it's said (the HUD line for the caller, the box for remarks), filled with ordinary values.
 */

const SAMPLE = {
  b: "HEARN",
  types: "SLOWER BALLS",
  lead: "212",
  w: "WOAKES",
  end: "PAVILION END",
  nth: "SEVENTH",
  figures: "2 FOR 34",
  r: "45",
  stand: "86",
  n: "12",
  k: "3",
  need: "24",
  left: "18",
  gained: "21",
  dots: "8",
  runs: "94",
  how: "AGAINST THE SHORT BALL",
  field: "TWO SLIPS AND A GULLY",
  temp: "28",
  day: "3",
  lost: "12",
  overs: "20",
  target: "180",
  team: "AUSTRALIA",
  score: "245/6",
  chasers: "ENGLAND",
  result: "ONE RUN",
  contact: "THICK OUTSIDE EDGE",
  part: "TOE",
  shot: "COVER DRIVE",
  where: "DEEP COVER",
  boundary: "FOUR",
  event: "A WIDE",
  extra: "",
  dismissal: "CAUGHT",
  // The match memory's facts (sim/match-memory.js).
  before: "48",
  after: "71",
  swing: "23",
  toward: "bat",
  balls: "34",
  from: "41",
  to: "68",
  beaten: "3",
  times: "2",
  letoff: "THE MISSED RUN-OUT",
  kind: "drop",
  droppedOn: "12",
  nowOn: "74",
  cost: "62",
  rrr: "12.5",
  threshold: "12",
  over: "30",
  par: "152",
  diff: "14",
  light: "THE LIGHTS",
  brk: "STUMPS",
};
// The wrap-up's result is a whole sentence.
const SAMPLE_FOR = { wrapUp: { result: "AUSTRALIA WON BY 4 WICKETS" } };

const fill = (text, situation) =>
  text.replace(/\{(\w+)\}/g, (_, k) => String(SAMPLE_FOR[situation]?.[k] ?? SAMPLE[k] ?? `{${k}}`));
const where = (file, g) => `${file}.json ${g.situation}${g.case !== undefined ? `:${g.case}` : ""}`;

test("every line file has a description and groups", () => {
  for (const [name, file] of Object.entries(LINE_FILES)) {
    assert.equal(typeof file.about, "string", `${name}.json needs "about"`);
    assert.ok(Array.isArray(file.groups) && file.groups.length, `${name}.json needs "groups"`);
  }
});

test("every group names a known situation, case, kind, formats and voices", () => {
  for (const { file, group: g } of allGroups()) {
    const at = where(file, g);
    const sit = SITUATIONS[g.situation];
    assert.ok(sit, `${at}: unknown situation (add it to src/sim/situations.js)`);
    if (sit.cases) assert.ok(sit.cases.includes(g.case), `${at}: unknown case (cases: ${sit.cases.join(", ")})`);
    else assert.equal(g.case, undefined, `${at}: this situation has no cases`);
    assert.ok(KINDS.includes(g.kind), `${at}: kind must be one of ${KINDS.join(", ")}`);
    for (const f of g.formats ?? []) assert.ok(FORMATS.includes(f), `${at}: format "${f}" (use ${FORMATS.join(", ")})`);
    assert.ok(g.lines || g.exchanges, `${at}: needs "lines" or "exchanges"`);
    for (const exchange of g.exchanges ?? []) {
      const turns = Array.isArray(exchange) ? exchange : exchange.turns;
      assert.ok(Array.isArray(turns) && turns.length >= 2, `${at}: an exchange needs two turns or more`);
      for (const [voice, text] of turns) {
        assert.ok(VOICES.includes(voice), `${at}: exchange voice "${voice}" (use ${VOICES.join(", ")})`);
        assert.ok(typeof text === "string" && fitsBox(fill(text, g.situation)), `${at}: exchange line too long: "${text}"`);
        for (const [, k] of text.matchAll(/\{(\w*)\}/g)) assert.ok(COMMON_FACTS.includes(k), `${at}: {${k}} in an exchange`);
      }
      for (const f of (!Array.isArray(exchange) && exchange.formats) || [])
        assert.ok(FORMATS.includes(f), `${at}: format "${f}"`);
    }
    for (const bank of [g.lines, g.replies].filter(Boolean)) {
      for (const [voice, lines] of Object.entries(bank)) {
        assert.ok([...VOICES, "any"].includes(voice), `${at}: voice "${voice}" (use ${VOICES.join(", ")} or any)`);
        assert.ok(Array.isArray(lines) && lines.length, `${at}: ${voice} needs a list of lines`);
      }
    }
  }
});

test("every line uses only its situation's facts, and fits where it's said", () => {
  for (const { file, group: g } of allGroups()) {
    const at = where(file, g);
    const facts = new Set([...COMMON_FACTS, ...(SITUATIONS[g.situation]?.facts ?? [])]);
    const short = SITUATIONS[g.situation]?.short;
    const fits = g.kind === "call" ? fitsHud : short ? (text) => fitsBox(text) && text.length <= RUNUP_CHARS : fitsBox;
    const lines = [...Object.values(g.lines ?? {}).flat(), ...Object.values(g.replies ?? {}).flat()];
    for (const line of lines) {
      const text = textOf(line);
      assert.ok(typeof text === "string" && text.trim(), `${at}: an empty line`);
      for (const [, k] of text.matchAll(/\{(\w*)\}/g)) assert.ok(facts.has(k), `${at}: {${k}} isn't a fact here: "${text}"`);
      const place = g.kind === "call" ? "HUD line" : short ? `run-up (${RUNUP_CHARS} characters)` : "box";
      assert.ok(fits(fill(text, g.situation)), `${at}: too long for the ${place}: "${text}"`);
      if (typeof line === "object") {
        for (const f of line.formats ?? []) assert.ok(FORMATS.includes(f), `${at}: format "${f}" in "${text}"`);
        for (const k of Object.keys(line.when ?? {})) assert.ok(facts.has(k), `${at}: "when" on {${k}}, not a fact here`);
      }
    }
  }
});

test("no line is written twice for the same situation", () => {
  const seen = new Map();
  for (const { file, group: g } of allGroups()) {
    for (const [voice, lines] of Object.entries(g.lines ?? {})) {
      for (const line of lines) {
        const key = `${g.situation}|${g.case}|${voice}|${textOf(line).toUpperCase()}`;
        assert.ok(!seen.has(key), `${where(file, g)}: "${textOf(line)}" twice`);
        seen.set(key, true);
      }
    }
  }
});

test("every situation and case has something for every voice to say", () => {
  for (const [situation, { cases, exchanges }] of Object.entries(SITUATIONS)) {
    for (const c of cases ?? [undefined]) {
      const at = `${situation}${c !== undefined ? `:${c}` : ""}`;
      if (exchanges) assert.ok(exchangesFor(situation, c).length, `${at} has no exchanges`);
      if (exchanges && !anyLines(situation, c).length) continue;
      assert.ok(anyLines(situation, c).length, `${at} has no lines`);
      voiceLines(situation, c).forEach((lines, i) => assert.ok(lines.length, `${at} has nothing for ${VOICES[i]}`));
    }
  }
});
