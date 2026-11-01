import test from "node:test";
import assert from "node:assert/strict";
import { createNarrative, trackBall, getOverSummary, getFieldObservation } from "../src/sim/commentary-narrative.js";
import { broadcastContext, BROADCAST_STORIES } from "../src/sim/broadcast-context.js";
import { Commentary, LINES, COLOUR_LINES } from "../src/sim/commentary.js";
import { boothCall, boothChat, boothJoke } from "../src/sim/commentators.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { fitsBox } from "../src/render/booth.js";

const ball = (facts = {}) => ({
  over: 0,
  ball: 1,
  striker: 0,
  bowler: 0,
  legal: true,
  total: 0,
  runsBat: 0,
  shot: "defend",
  contact: "middle",
  quality: 0.8,
  extra: { type: null, runs: 0 },
  ...facts,
});
const innings = () => ({
  legal: 0,
  runs: 0,
  wkts: 0,
  overNo: 0,
  oversText: "0.0",
  batTeam: { abbr: "AUS" },
  bat: [
    { p: { short: "HEARN" }, runs: 0, out: false },
    { p: { short: "KAWAGA" }, runs: 0, out: false },
  ],
  bowl: [{ p: { short: "WOAKESLEY", bowl: { style: "fast" } }, balls: 0, maidens: 0, wkts: 0, runs: 0 }],
  partnership: { runs: 0 },
  pressure: 0,
  target: null,
  pitch: { wear: 0, type: { id: "green" } },
  preset: "attacking",
  customField: false,
});
const rng = { random: () => 0.25, pick: (xs) => xs[0], chance: () => true };

function feed(n, inn, facts = {}) {
  const rec = ball({ over: Math.floor(inn.legal / 6), ball: (inn.legal % 6) + 1, ...facts });
  inn.runs += rec.total;
  if (rec.legal) {
    inn.legal++;
    inn.bowl[0].balls++;
  }
  inn.overNo = Math.floor(inn.legal / 6);
  inn.oversText = `${inn.overNo}.${inn.legal % 6}`;
  trackBall(n, rec, inn);
  return rec;
}

test("dot pressure follows each batter, over boundaries, legal balls and wickets", () => {
  const n = createNarrative(),
    inn = innings();
  for (let i = 0; i < 4; i++) feed(n, inn);
  assert.equal(n.dotPressure.batter, 4);
  assert.equal(n.dotPressure.over, 4);
  feed(n, inn, { striker: 1 });
  assert.equal(n.dotPressure.batter, 1);
  feed(n, inn, { legal: false, total: 1, extra: { type: "wd", runs: 1 } });
  assert.equal(n.dotPressure.batter, 4, "a wide is not a faced delivery");
  assert.equal(n.dotPressure.over, 0);
  feed(n, inn);
  assert.equal(n.dotPressure.batter, 5);
  feed(n, inn);
  assert.equal(n.dotPressure.batter, 6);
  assert.equal(n.dotPressure.over, 1, "new over resets the over's streak");
  feed(n, inn, { total: 2, runsBat: 1, legal: false, extra: { type: "nb", runs: 1 } });
  assert.equal(n.dotPressure.batter, 0);
  feed(n, inn, { total: 1, extra: { type: "b", runs: 1 } });
  assert.equal(n.dotPressure.batter, 0, "a legal bye is not a dot ball");
  feed(n, inn, { wicket: { batter: 0, how: "bowled" } });
  assert.equal(n.batters.has(0), false);
});

test("tracking is idempotent, resets by innings, and never mutates records or innings", () => {
  const n = createNarrative(),
    inn = innings(),
    rec = ball();
  const before = JSON.stringify({ inn, rec });
  trackBall(n, rec, inn);
  trackBall(n, rec, inn);
  assert.equal(n.dotPressure.batter, 1);
  assert.equal(JSON.stringify({ inn, rec }), before);
  trackBall(n, ball(), innings());
  assert.equal(n.dotPressure.batter, 1);
  assert.equal(n.pitch.low, 0);
});

test("recaps count ALL over runs including byes, keep bowler charges distinct and snapshot figures", () => {
  const comm = new Commentary(new Rng(1)),
    inn = innings();
  const n = comm.narrative;
  feed(n, inn, { legal: false, total: 1, extra: { type: "wd", runs: 1 } });
  feed(n, inn, { legal: false, total: 3, runsBat: 2, extra: { type: "nb", runs: 1 } });
  feed(n, inn, { total: 4, extra: { type: "b", runs: 4 } });
  for (let i = 0; i < 4; i++) feed(n, inn);
  inn.bowl[0].runs = 4;
  const rec = feed(n, inn);
  const summary = getOverSummary(inn, 0);
  assert.equal(summary, "8 from the over. WOAKESLEY: 1 over, 0 maidens, 0 for 4. AUS 8/0 after 1 over.");
  const calls = boothChat(comm, inn, rng, { rec, fits: fitsBox });
  assert.ok(calls.length);
  assert.equal(calls[0].who, 0, "outgoing over's voice");
  assert.ok(calls.every((c) => fitsBox(c.text)));
  assert.deepEqual(boothChat(comm, inn, rng, { rec, fits: fitsBox }), []);
  inn.bowl[0].runs = 50;
  inn.runs = 99;
  assert.equal(getOverSummary(inn, 0), summary, "later score changes cannot rewrite a recap");
});

test("partial-over starts are labelled rather than inventing unseen runs", () => {
  const inn = innings(),
    n = createNarrative();
  inn.legal = 4;
  feed(n, inn, { total: 2, runsBat: 2 });
  feed(n, inn);
  assert.match(getOverSummary(inn, 0), /^2 since resumption\./);
});

test("milestones use post-ball cards, dismissals and actual bowler wickets", () => {
  const inn = innings(),
    n = createNarrative();
  inn.bat[0].runs = 45;
  inn.bowl[0].wkts = 4;
  let rec = feed(n, inn);
  assert.equal(n.milestones.nearFifty, true);
  assert.equal(n.milestones.huntingFive, true);
  inn.bat[0].runs = 90;
  rec = feed(n, inn);
  assert.equal(n.milestones.nervousNineties, true);
  let options = broadcastContext(rec, inn, n);
  assert.ok(options.some((o) => o.topic === "nervousNineties" && o.facts.need === 10));
  inn.bat[0].runs = 100;
  inn.bowl[0].wkts = 5;
  feed(n, inn);
  assert.equal(n.milestones.nervousNineties, false);
  assert.equal(n.milestones.huntingFive, false);
  inn.bat[0].out = true;
  inn.bat[0].runs = 94;
  rec = feed(n, inn, { wicket: { batter: 0, how: "runout" } });
  assert.deepEqual(broadcastContext(rec, inn, n), []);
});

test("pitch and light observations require evidence; custom fields do not inherit preset claims", () => {
  const inn = innings(),
    n = createNarrative();
  let rec = feed(n, inn, { bounceNote: "low" });
  assert.ok(!broadcastContext(rec, inn, n).some((o) => o.topic === "lowBounce"));
  inn.pitch = { type: { id: "cracked" }, wear: 0.4 };
  inn.bowl[0].p.bowl.style = "legspin";
  rec = feed(n, inn, { bounceNote: "high" });
  const topics = broadcastContext(rec, inn, n, "afternoon").map((o) => o.topic);
  assert.ok(topics.includes("extraBounce") && topics.includes("unevenBounce") && topics.includes("wideningCracks"));
  assert.ok(topics.includes("afternoon"));
  assert.ok(!broadcastContext(rec, inn, n, "night").some((o) => ["afternoon", "evening"].includes(o.topic)));
  inn.customField = true;
  rec = feed(n, inn, { ball: 1 });
  assert.ok(!broadcastContext(rec, inn, n).some((o) => o.topic === "fieldPlan"));
});

test("field descriptions distinguish catchers, boundary protection, spin and a ring", () => {
  assert.match(getFieldObservation("attacking", "fast"), /Three slips and a gully/);
  assert.match(getFieldObservation("defensive", "fast"), /pull/);
  assert.match(getFieldObservation("defensive", "legspin"), /sweep/);
  assert.match(getFieldObservation("spin", "offspin"), /bat-pad/);
  assert.match(getFieldObservation("ring", "fast"), /saving the single/);
  assert.equal(getFieldObservation("custom", "fast"), "");
});

test("pressure escalates at four, eight and twelve, without repeating a rung in the same streak", () => {
  const comm = new Commentary(new Rng(1)),
    inn = innings();
  const heard = [];
  for (let i = 0; i < 15; i++) {
    const rec = feed(comm.narrative, inn);
    const result = boothCall(
      rec,
      "GOOD LENGTH. DEFENDED: NO RUN.",
      { batter: "HEARN", bowler: "WOAKESLEY" },
      rng,
      comm,
      fitsBox,
      { inn, narrative: comm.narrative, commentary: comm, applied: { overEnded: inn.legal % 6 === 0 } },
    );
    heard.push(...result.calls.filter((c) => c.topic.startsWith("dotPressure")));
  }
  assert.deepEqual(
    heard.map((c) => c.topic),
    ["dotPressure4", "dotPressure8", "dotPressure12"],
  );
  assert.match(heard[2].text, /13/, "the over recap has priority on ball twelve");
  assert.ok(heard.every((c) => fitsBox(c.text)));
});

test("new authored lines fit and preserve the legacy facades", () => {
  for (const [topic, story] of Object.entries(BROADCAST_STORIES))
    for (const voice of story.lines) {
      assert.ok(
        voice.some((line) =>
          fitsBox(
            line
              .replace(/\{b\}|\{w\}/g, "LA BONSHANE")
              .replace(/\{field\}/g, getFieldObservation("attacking", "fast"))
              .replace(/\{[^}]+\}/g, "12"),
          ),
        ),
        topic,
      );
    }
  assert.ok(LINES.leaveWide && LINES.leaveClose && LINES.defendPressure && COLOUR_LINES.unevenBounce);
  const comm = new Commentary(new Rng(1)),
    inn = innings(),
    rec = ball();
  comm.remember(rec, inn.bat[0], inn.bowl[0]);
  assert.equal(comm.narrative.dotPressure.batter, 1);
  assert.equal(boothJoke([["bunnings", "QUIET IN THE BOX."]])[0].who, 0);
});

test("live editor gives over recaps precedence and simulated passages keep narrative accurate", () => {
  const match = new Match(australia(), england(), "green", 15, new Rng(43), "bat");
  let done;
  while (match.inn.legal < 5) done = match.simBall();
  do {
    done = match.simBall();
  } while (!done.applied.overEnded && !match.inn.isOver);
  const state = match.rng.state,
    snapshot = JSON.stringify(done.rec);
  const { rec } = done;
  const calls = boothCall(
    rec,
    rec.call,
    { batter: match.inn.bat[rec.striker].p.short, bowler: match.inn.bowl[rec.bowler].p.short },
    rng,
    match.comm,
    fitsBox,
    { inn: match.inn, commentary: match.comm, narrative: match.comm.narrative, applied: done.applied },
  ).calls;
  assert.ok(calls.some((c) => c.topic === "overSummary"));
  assert.ok(calls.every((c) => fitsBox(c.text)));
  assert.equal(match.rng.state, state);
  assert.equal(JSON.stringify(rec), snapshot);
  assert.equal(match.comm.narrative.over.number, rec.over);
});

test("recap panels preserve complete figures with long names and never duplicate the over", () => {
  const comm = new Commentary(new Rng(1)),
    inn = innings();
  inn.bowl[0].p.short = "LA BONSHANE";
  for (let i = 0; i < 6; i++) feed(comm.narrative, inn);
  const recap = getOverSummary(inn, 0).toUpperCase();
  const calls = boothChat(comm, inn, rng, { fits: (text) => text.length <= 64 && fitsBox(text) });
  assert.ok(calls.length > 1);
  assert.equal(calls.map((c) => c.text).join(" "), recap);
  assert.ok(calls.every((c) => fitsBox(c.text)));
  assert.deepEqual(boothChat(comm, inn, rng), []);
});

test("facade callers retain pack-owner identity and expose the old picks result", () => {
  const owner = {},
    rec = ball({ shot: "leave", contact: "none" });
  const first = boothCall(rec, "", { batter: "HEARN", bowler: "WOAKESLEY" }, rng, owner, fitsBox);
  const next = boothCall(rec, "", { batter: "HEARN", bowler: "WOAKESLEY" }, rng, owner, fitsBox);
  assert.deepEqual(first.picks, []);
  assert.ok(first.calls.length && next.calls.length);
  assert.notEqual(first.calls[0].text, next.calls[0].text);
});

test("the nervous-nineties observation is said once per batter and clears at the hundred", () => {
  const comm = new Commentary(new Rng(1)), inn = innings();
  inn.bat[0].runs = 94;
  const calls = [];
  for (let i = 0; i < 3; i++) {
    const rec = feed(comm.narrative, inn);
    calls.push(...boothCall(rec, "", { batter: "HEARN", bowler: "WOAKESLEY" }, rng, comm, fitsBox,
      { inn, narrative: comm.narrative }).calls);
  }
  const nervous = calls.filter(c => c.topic === "nervousNineties");
  assert.equal(nervous.length, 1);
  assert.match(nervous[0].text, /94/);
  assert.match(nervous[0].text, /6/);
  inn.bat[0].runs = 100;
  const rec = feed(comm.narrative, inn);
  assert.ok(!broadcastContext(rec, inn, comm.narrative).some(o => o.topic === "nervousNineties"));
});

test("the match facade resets narrative at change of innings but retains the booth identity", () => {
  const match = new Match(australia(), england(), "green", 10, new Rng(43), "bat");
  const booth = match.booth;
  match.simBall();
  assert.equal(match.comm.narrative.innings, match.inn);
  match.beginInnings(england(), australia(), 100);
  assert.equal(match.booth, booth);
  assert.equal(match.comm.narrative.lastOver, null);
  assert.equal(match.comm.narrative.dotPressure.batter, 0);
  assert.equal(match.comm.chatMemory.size, 0);
});
