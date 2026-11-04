// How AI-vs-AI Test matches play out: results, draws, declarations, follow-ons and how long they last.
//   node tools/test-report.mjs [matches]
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { declareAdvised } from "../src/sim/test-match.js";

const n = Number(process.argv[2] ?? 20);
const pitches = ["green", "dust", "cracked"];
const grounds = ["lords", "theG", "scg", "lakshmi"];
const tally = { draw: 0, innings: 0, runs: 0, wkts: 0, tie: 0, declared: 0, followOn: 0 };
const scores = [[], [], [], []];
let days = 0;
let legal = 0;
let runs = 0;
let wickets = 0;
let stoppages = 0;
let rainLost = 0;
for (let seed = 1; seed <= n; seed++) {
  const m = new Match(australia(), england(), pitches[seed % 3], 0, new Rng(seed), "bat", {
    test: true,
    ground: grounds[seed % 4],
  });
  for (;;) {
    while (!m.inn.isOver) {
      const { rec, applied } = m.simBall();
      if (rec.legal) legal++;
      runs += rec.total;
      if (rec.wicket) wickets++;
      if (applied.rain) {
        stoppages++;
        rainLost += applied.rain.lost;
      }
      // The player batting takes the computer's advice.
      if (applied.overEnded && m.human === "bat" && declareAdvised(m)) m.declare();
    }
    if (m.inn.declared) tally.declared++;
    scores[m.innings.length - 1].push(m.inn.runs);
    if (!m.hasNextInnings) break;
    m.nextInnings();
    // Both sides on the computer: it sets the fields (the "player" side would keep its own).
    m.human = "bat";
  }
  if (m.followedOn) tally.followOn++;
  const r = m.result;
  days += m.clock.day;
  if (!r) console.log(`seed ${seed}: no result?`, m.innings.length, m.inn.isOver);
  else if (r.draw) tally.draw++;
  else if (r.text.includes("innings")) tally.innings++;
  else if (r.text.includes("wicket")) tally.wkts++;
  else if (r.text.includes("tied")) tally.tie++;
  else tally.runs++;
  console.log(
    `seed ${String(seed).padStart(2)}: ${r?.text ?? "-"}; day ${m.clock.day}; ` +
      m.innings.map((i) => `${i.batTeam.abbr} ${i.runs}/${i.wkts}${i.declared ? "d" : ""}`).join(", "),
  );
}
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0) : "-");
console.log(
  `\n${n} Tests: ${tally.draw} drawn, ${tally.innings} innings wins, ${tally.runs} by runs, ${tally.wkts} by wickets, ${tally.tie} tied`,
);
console.log(`${tally.declared} declarations, ${tally.followOn} follow-ons, finished on day ${(days / n).toFixed(1)} on average`);
console.log(`${stoppages} rain stoppages costing ${rainLost} overs (${(rainLost / n).toFixed(0)} a Test)`);
console.log(
  `innings averages: ${scores.map(avg).join(" / ")}; ${((6 * runs) / legal).toFixed(2)} rpo, ${(legal / wickets).toFixed(1)} balls/wkt`,
);
