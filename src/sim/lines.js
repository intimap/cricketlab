import calls from "./lines/calls.json" with { type: "json" };
import results from "./lines/results.json" with { type: "json" };
import overs from "./lines/overs.json" with { type: "json" };
import stories from "./lines/stories.json" with { type: "json" };
import moments from "./lines/moments.json" with { type: "json" };
import colour from "./lines/colour.json" with { type: "json" };
import scene from "./lines/scene.json" with { type: "json" };
import reads from "./lines/reads.json" with { type: "json" };
import finishes from "./lines/finishes.json" with { type: "json" };
import banter from "./lines/banter.json" with { type: "json" };
import memory from "./lines/memory.json" with { type: "json" };
import { SITUATIONS } from "./situations.js";

/**
 * The commentary's words, from the JSON line files in sim/lines/. Each file is a list of groups:
 *
 *   { "situation": "collapse", "case": "...", "kind": "match", "formats": ["t20"],
 *     "lines": { "bunnings": [...], "lorry": [...], "grog": [...], "any": [...] }, "replies": { ... } }
 *
 * A line is a string, or { "text", "formats", "when" } to narrow it: `formats` (t20, odi, test) it suits,
 * and `when` facts it needs ({ "need": [5, 6] } a range, { "left": 1 } a value). Lines under "any" go to
 * whichever voice is speaking. The situations and their facts are listed in sim/situations.js.
 *
 * A group can also hold "exchanges": a few voices in turn, each [voice, text], said one after another
 * ([["lorry", "THAT'S THE THIRD PIE THIS OVER."], ["grog", "HE MIGHT AS WELL EAT ONE."]]), or
 * { "turns": [...], "formats": [...] } to narrow one to a format.
 */

export const LINE_FILES = { calls, results, overs, stories, moments, colour, scene, reads, finishes, banter, memory };
export const VOICES = ["bunnings", "lorry", "grog"];
export const KINDS = ["call", "shot", "bowling", "match", "players", "banter"];
export const FORMATS = ["t20", "odi", "test"];

const keyOf = (situation, kase) => `${situation}|${kase ?? ""}`;
const index = new Map();
const kinds = new Map();
for (const [file, { groups }] of Object.entries(LINE_FILES)) {
  for (const group of groups) {
    const key = keyOf(group.situation, group.case);
    const entry = index.get(key) ?? { situation: group.situation, case: group.case, files: new Set(), groups: [] };
    entry.files.add(file);
    entry.groups.push(group);
    index.set(key, entry);
    if (!kinds.has(group.situation)) kinds.set(group.situation, group.kind);
  }
}

/** The format the lines are for: "test", "t20" (twenty overs or fewer) or "odi". */
export function formatOf(inn) {
  if (!inn || inn.test || !Number.isFinite(inn.oversLimit)) return "test";
  return inn.oversLimit <= 20 ? "t20" : "odi";
}

/** A situation's kind (call, shot, bowling, match, players, banter), from its lines. */
export const kindOf = (situation) => kinds.get(situation) ?? "match";

/** A line's text. */
export const textOf = (line) => (typeof line === "string" ? line : line.text);

/** Whether a line suits this format and these facts (no format given: any; no facts given: any). */
export function suits(line, group, format, facts) {
  const formats = (typeof line === "object" && line.formats) || group.formats;
  if (format && formats && !formats.includes(format)) return false;
  const when = typeof line === "object" ? line.when : null;
  if (!when || !facts) return true;
  return Object.entries(when).every(([fact, want]) => {
    const have = facts[fact];
    if (Array.isArray(want)) return Number.isFinite(have) && have >= want[0] && have <= want[1];
    return have === want;
  });
}

function collect(situation, kase, voice, { format, facts, replies = false } = {}) {
  const out = [];
  for (const group of index.get(keyOf(situation, kase))?.groups ?? []) {
    const bank = replies ? group.replies : group.lines;
    if (!bank) continue;
    const lines = voice === null ? Object.values(bank).flat() : [...(bank[voice] ?? []), ...(bank.any ?? [])];
    for (const line of lines) if (suits(line, group, format, facts)) out.push(textOf(line));
  }
  return out;
}

/** The lines for a situation (and case), one list per voice in VOICES order; "any" lines are in every list. */
export const voiceLines = (situation, kase, options) => VOICES.map((v) => collect(situation, kase, v, options));

/** Every line for a situation (and case), whoever says it. */
export const anyLines = (situation, kase, options) => collect(situation, kase, null, options);

/** The second voice's answers for a situation, one list per voice. */
export const replyLines = (situation, kase) => VOICES.map((v) => collect(situation, kase, v, { replies: true }));

/** The exchanges for a situation (and case) in this format: lists of { who (VOICES index), text }. */
export function exchangesFor(situation, kase, { format } = {}) {
  const out = [];
  for (const group of index.get(keyOf(situation, kase))?.groups ?? []) {
    for (const exchange of group.exchanges ?? []) {
      const turns = Array.isArray(exchange) ? exchange : exchange.turns;
      const formats = (!Array.isArray(exchange) && exchange.formats) || group.formats;
      if (format && formats && !formats.includes(format)) continue;
      out.push(turns.map(([voice, text]) => ({ who: VOICES.indexOf(voice), text })));
    }
  }
  return out;
}

/** { case: lines } for a situation split by case, with `get` (anyLines or voiceLines). */
export function byCase(situation, get = anyLines) {
  return Object.fromEntries((SITUATIONS[situation]?.cases ?? []).map((c) => [c, get(situation, c)]));
}

/** The box's stories from one line file: { situation: { rest, lines (per voice), reply? } }. */
export function storiesIn(file) {
  const out = {};
  for (const { situation } of LINE_FILES[file].groups) {
    if (out[situation]) continue;
    const story = { rest: SITUATIONS[situation]?.rest ?? 12, lines: voiceLines(situation) };
    const reply = replyLines(situation);
    if (reply.some((r) => r.length)) story.reply = reply.map((r) => r[0]);
    out[situation] = story;
  }
  return out;
}

/** Every group, with the file it's in, for the checks and the lines report. */
export function allGroups() {
  return Object.entries(LINE_FILES).flatMap(([file, { groups }]) => groups.map((group) => ({ file, group })));
}
