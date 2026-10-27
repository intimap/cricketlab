// Balance report: simulates many AI-vs-AI innings and prints the numbers
// worth tuning against. Pure Node, no browser.
//
//   node tools/sim-report.mjs            100 innings, mixed pitches, 90 overs
//   node tools/sim-report.mjs 300 dust   300 innings on one pitch type
//
// Compare before/after a change: same seeds every run, so differences are the change.
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { PITCH_TYPES } from "../src/sim/conditions.js";

const innings = Number(process.argv[2] ?? 100);
const pitchArg = process.argv[3];
const pitchIds = pitchArg ? [pitchArg] : Object.keys(PITCH_TYPES);

const t = { balls: 0, legal: 0, runs: 0, wkts: 0, fours: 0, sixes: 0, nb: 0, wd: 0, dots: 0, scores: [] };
const how = {};
const moments = {};
const plans = {};
for (let seed = 1; seed <= innings; seed++) {
  const m = new Match(australia(), england(), pitchIds[seed % pitchIds.length], 90, new Rng(seed), "bat");
  while (!m.inn.isOver) {
    const plan = m.inn.overPlan;
    const { rec } = m.simBall();
    t.balls++;
    if (rec.legal) t.legal++;
    t.runs += rec.total;
    if (rec.total === 0 && rec.legal) t.dots++;
    if (rec.boundary === 4 && rec.runsBat === 4) t.fours++;
    if (rec.boundary === 6) t.sixes++;
    if (rec.extra.type === "nb") t.nb++;
    if (rec.extra.type === "wd") t.wd++;
    if (rec.wicket) {
      t.wkts++;
      how[rec.wicket.how] = (how[rec.wicket.how] ?? 0) + 1;
    }
    if (rec.moment) moments[rec.moment.kind] = (moments[rec.moment.kind] ?? 0) + 1;
    if (plan) {
      const p = (plans[plan] ??= { balls: 0, runs: 0, wkts: 0 });
      p.balls++;
      p.runs += rec.total;
      if (rec.wicket) p.wkts++;
    }
  }
  t.scores.push(m.inn.runs);
}

const f = (n, d = 2) => n.toFixed(d);
const per = (n) => f(n / innings);
t.scores.sort((a, b) => a - b);
console.log(`${innings} innings  (${pitchIds.join(", ")})`);
console.log(
  `runs/over ${f((6 * t.runs) / t.legal)}   balls/wicket ${f(t.legal / Math.max(1, t.wkts), 1)}   ` +
    `median score ${t.scores[Math.floor(innings / 2)]}   dot% ${f((100 * t.dots) / t.legal, 1)}`,
);
console.log(`per innings: fours ${per(t.fours)}  sixes ${per(t.sixes)}  no-balls ${per(t.nb)}  wides ${per(t.wd)}`);
console.log(
  "dismissals: " +
    Object.entries(how)
      .sort((a, b) => b[1] - a[1])
      .map(([k, c]) => `${k} ${f((100 * c) / t.wkts, 1)}%`)
      .join("  "),
);
console.log(
  "bowling plans: " +
    Object.entries(plans)
      .sort((a, b) => b[1].balls - a[1].balls)
      .map(([k, p]) => `${k} ${f((6 * p.runs) / p.balls)}rpo/${f(p.balls / Math.max(1, p.wkts), 0)}bpw`)
      .join("  "),
);
console.log(
  "moments per innings: " +
    Object.entries(moments)
      .sort((a, b) => b[1] - a[1])
      .map(([k, c]) => `${k} ${per(c)}`)
      .join("  "),
);
