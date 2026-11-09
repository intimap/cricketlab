// How many lines the commentary has, per situation, voice and format, and where it's thin.
//   node tools/lines-report.mjs            every situation
//   node tools/lines-report.mjs thin       only the thin ones (fewer than THIN lines for a voice in a format)
//   node tools/lines-report.mjs banter     one kind only (call, shot, bowling, match, players, banter)
import { allGroups, VOICES, FORMATS, KINDS, suits } from "../src/sim/lines.js";
import { SITUATIONS } from "../src/sim/situations.js";
import packCalls from "../src/sim/commentary-pack/v1/ball_calls.json" with { type: "json" };

/** Fewer lines than this for a voice, in a format, and the voice repeats itself. */
const THIN = 3;
const arg = process.argv[2] ?? "";
const onlyThin = arg === "thin";
const onlyKind = KINDS.includes(arg) ? arg : null;

// Count per situation (and case): each voice's lines in each format, "any" lines counted for every voice.
const rows = new Map();
for (const { file, group } of allGroups()) {
  const key = `${group.situation}${group.case !== undefined ? `:${group.case}` : ""}`;
  const row = rows.get(key) ?? { key, file, kind: group.kind, counts: {} };
  for (const voice of VOICES) {
    for (const format of FORMATS) {
      const lines = [...(group.lines?.[voice] ?? []), ...(group.lines?.any ?? [])];
      const n = lines.filter((line) => suits(line, group, format)).length;
      row.counts[`${voice}.${format}`] = (row.counts[`${voice}.${format}`] ?? 0) + n;
    }
  }
  rows.set(key, row);
}

const pad = (s, n) => String(s).padEnd(n);
const num = (n) => String(n).padStart(5);
const least = (row) => Math.min(...Object.values(row.counts));
console.log(`${pad("SITUATION", 34)}${pad("KIND", 9)}${pad("FILE", 9)}${VOICES.map((v) => pad(v.toUpperCase(), 18)).join("")}`);
console.log(`${pad("", 52)}${VOICES.map(() => FORMATS.map((f) => num(f.toUpperCase())).join("") + "   ").join("")}`);
let thin = 0;
for (const row of rows.values()) {
  const isThin = row.kind !== "call" && row.kind !== "banter" && least(row) < THIN;
  if (isThin) thin++;
  if ((onlyThin && !isThin) || (onlyKind && row.kind !== onlyKind)) continue;
  const cells = VOICES.map((v) => FORMATS.map((f) => num(row.counts[`${v}.${f}`])).join("") + "   ").join("");
  console.log(`${pad(row.key, 34)}${pad(row.kind, 9)}${pad(row.file, 9)}${cells}${isThin ? " THIN" : ""}`);
}

// Totals: lines written (an "any" line once), by kind.
const byKind = Object.fromEntries(KINDS.map((k) => [k, 0]));
let written = 0;
let exchanges = 0;
for (const { group } of allGroups()) {
  const n = Object.values(group.lines ?? {}).flat().length;
  exchanges += group.exchanges?.length ?? 0;
  byKind[group.kind] += n;
  written += n;
}
console.log(`\n${written} lines in src/sim/lines/ (${KINDS.map((k) => `${k} ${byKind[k]}`).join(", ")}),`);
console.log(`${exchanges} exchanges between the voices,`);
console.log(`plus ${packCalls.entries.length} factual result calls in src/sim/commentary-pack/v1/ball_calls.json.`);
console.log(
  `${Object.keys(SITUATIONS).length} situations; ${thin} situation rows thin (a remark with fewer than ${THIN} lines for a voice in a format).`,
);
