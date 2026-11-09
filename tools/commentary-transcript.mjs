// What the commentators say through a simulated match, and how often the box speaks.
//   node tools/commentary-transcript.mjs [t20|odi|test] [seed]     the transcript, then the counts
//   node tools/commentary-transcript.mjs t20 1 quiet                just the counts
// Each ball: the caller's call (on the HUD line in the game), then the box's remarks from the other two, with
// the run-up remark and the start-of-over remark where there is one. Presentation dice are seeded so a run
// can be repeated. A whole match is played (both innings; a Test to its end), as the computer against itself.
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { boothCall } from "../src/sim/commentators.js";
import { kindOf } from "../src/sim/lines.js";
import { COMMENTATORS } from "../src/sim/commentators.js";
import { declareAdvised } from "../src/sim/test-match.js";
import { fitsBox } from "../src/render/booth.js";
import { fitsHud } from "../src/render/call-line.js";

const [format = "t20", seedArg = "1", mode = ""] = process.argv.slice(2);
const seed = Number(seedArg);
const quiet = mode === "quiet";
const overs = { t20: 20, odi: 50, test: 0 }[format];
const m = new Match(australia(), england(), ["green", "dust", "cracked"][seed % 3], overs, new Rng(seed), "bat", {
  ...(format === "test" ? { test: true } : { innings: 2 }),
});
// Presentation dice, seeded.
const dice = new Rng(seed * 7919 + 1);
const rng = { random: () => dice.next(), chance: (p) => dice.next() < p, pick: (xs) => xs[Math.floor(dice.next() * xs.length)] };
const name = (who) => COMMENTATORS[who].name.split(" ").pop().padEnd(8);
const say = (line) => quiet || console.log(line);

const tally = { balls: 0, spoken: 0, runup: 0, overStart: 0, exchanges: 0, kinds: {}, topics: {} };
const count = (topic) => {
  tally.topics[topic] = (tally.topics[topic] ?? 0) + 1;
  const kind = topic === "overSummary" ? "recap" : kindOf(topic.replace(/\d+$/, ""));
  tally.kinds[kind] = (tally.kinds[kind] ?? 0) + 1;
};

for (;;) {
  const inn = m.inn;
  say(`\n=== ${inn.batTeam.name} BATTING (${format.toUpperCase()}) ===`);
  while (!inn.isOver) {
    if (m.needOver) m.startOver();
    const caller = inn.overNo % 3;
    const editor = m.comm.booth;
    if (inn.ballInOver === 0) {
      const remark = editor.overStart(inn, m, { caller, rng, fits: fitsBox });
      if (remark) {
        tally.overStart++;
        count(remark.topic);
        say(`        [over] ${name(remark.who)} ${remark.text}`);
      }
    }
    const runup = editor.runup(inn, { caller, rng, fits: fitsBox });
    if (runup) {
      tally.runup++;
      count(runup.topic);
      say(`        [run-up] ${name(runup.who)} ${runup.text}`);
    }
    const { rec, applied } = m.simBall();
    const names = { batter: inn.bat[rec.wicket ? rec.wicket.batter : rec.striker].p.short, bowler: inn.bowl[rec.bowler].p.short };
    const { calls } = boothCall(rec, rec.call, names, rng, m.comm, fitsBox, {
      inn,
      match: m,
      applied,
      fitsCall: fitsHud,
      commentary: m.comm,
      narrative: m.comm.narrative,
    });
    tally.balls++;
    const primary = calls.find((c) => c.topic === "ballCall");
    const box = calls.filter((c) => c !== primary);
    if (box.some((c) => c.topic !== "overSummary")) tally.spoken++;
    if (box.some((c, i) => i > 0 && c.topic === box[i - 1].topic && c.topic !== "overSummary")) tally.exchanges++;
    say(`${rec.over}.${rec.ball}  ${name(rec.over % 3)} ${primary?.text ?? "-"}`);
    for (const c of box) {
      count(c.topic);
      say(`        ${name(c.who)} ${c.text}`);
    }
    if (applied.overEnded && m.clock && m.human === "bat" && declareAdvised(m)) m.declare();
  }
  if (!m.hasNextInnings) break;
  m.nextInnings();
  m.human = "bat";
}

const pct = (n) => `${((100 * n) / tally.balls).toFixed(0)}%`;
console.log(`\n${format.toUpperCase()}, seed ${seed}: ${m.result?.text ?? ""}`);
console.log(`${tally.balls} balls; the box remarked on ${tally.spoken} (${pct(tally.spoken)}), not counting recaps.`);
console.log(`Run-up remarks ${tally.runup}, start-of-over remarks ${tally.overStart}, exchanges ${tally.exchanges}.`);
console.log(
  `By kind: ${Object.entries(tally.kinds)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(", ")}`,
);
console.log(
  `Most said: ${Object.entries(tally.topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([k, n]) => `${k} ${n}`)
    .join(", ")}`,
);
