// How the player's bowling fares against the computer's batting: 50-over innings bowled with a choice of
// plans, release timing and fields, against the computer's own bowling (sim-report's runs per over).
//   node tools/bowling-report.mjs [innings per row]       ROWS=3,4 for just those rows
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england, isSpinner } from "../src/sim/teams.js";
import { pickBowler, pickDeliveryPlan, pickFieldPreset } from "../src/sim/ai.js";
import { rhythmOf } from "../src/sim/rhythm.js";

const n = Number(process.argv[2] ?? 20);
const pitches = ["green", "dust", "cracked"];

/** What the player bowls: the computer's own choices (a sensible player), the same ball, or bouncers. */
const PLANS = {
  // Aiming off for the turn against a left-hander, as a player watching the ball would (sim/match.js deliver).
  sensible: (inn, rng) => ({ ...pickDeliveryPlan(inn, rng).intent, byComputer: true }),
  same: (inn) => {
    const spin = isSpinner(inn.bowler.p.bowl);
    const type = inn.bowler.p.bowl.repertoire.includes("outswing") ? "outswing" : inn.bowler.p.bowl.repertoire[0];
    return { type, line: 0.22, length: spin ? 5.4 : 6.4, effort: "med" };
  },
  bouncers: (inn) =>
    isSpinner(inn.bowler.p.bowl)
      ? { type: inn.bowler.p.bowl.repertoire[0], line: 0.2, length: 5.4, effort: "med" }
      : { type: "bouncer", line: 0, length: 11, effort: "high" },
};

/**
 * The player's run-up: the share of releases in the gold zone (no error), how far the rest miss, and how far
 * his taps on the two beats miss (s, standard deviation; sim/rhythm.js grades them).
 */
const RELEASES = { perfect: [1, 0, 0], good: [0.6, 0.05, 0.035], average: [0.35, 0.08, 0.06] };

const rows = [
  ["same", "perfect", "attacking"],
  ["sensible", "perfect", "attacking"],
  ["sensible", "good", "attacking"],
  ["sensible", "good", "captain"],
  ["sensible", "average", "captain"],
  ["bouncers", "perfect", "attacking"],
];

// ROWS=1,3 runs just those rows (counting from 0).
const only = process.env.ROWS?.split(",").map(Number);
for (const [planName, releaseName, field] of rows.filter((_, i) => !only || only.includes(i))) {
  const plan = PLANS[planName];
  const [inZone, miss, beatMiss] = RELEASES[releaseName];
  const t = { runs: 0, legal: 0, wkts: 0, wd: 0, nb: 0, suspended: 0 };
  // FROM=61 starts at another seed, to run a long report in parallel halves.
  const from = Number(process.env.FROM ?? 1);
  for (let seed = from; seed < from + n; seed++) {
    const m = new Match(australia(), england(), pitches[seed % 3], 50, new Rng(seed), "bowl");
    const inn = m.inn;
    const hand = new Rng(seed * 7 + 1);
    for (let i = 0; !inn.isOver && i < 4000; i++) {
      if (m.needOver) {
        m.startOver(pickBowler(inn));
        inn.setPreset(field === "captain" ? pickFieldPreset(inn) : isSpinner(inn.bowler.p.bowl) ? "spin" : "attacking");
      }
      const planned = plan(inn, hand);
      const rhythm = rhythmOf([hand.normal(0, beatMiss), hand.normal(0, beatMiss)], planned.effort);
      const intent = { ...planned, wicketSide: "over", rhythm };
      const error = hand.chance(inZone) ? 0 : hand.normal(0, miss);
      const d = m.deliver(intent, error);
      const play = m.resolve(intent, d, m.aiShot(d), false);
      play.live.setup.aiRunning = true;
      for (let k = 0; !(play.live.dead && play.live.t >= play.live.deadAt) && k++ < 2000; ) play.live.step(0.02);
      const { rec } = m.finish(play);
      t.runs += rec.total;
      if (rec.legal) t.legal++;
      if (rec.wicket) t.wkts++;
      if (rec.extra.type === "wd") t.wd++;
      if (rec.extra.type === "nb") t.nb++;
      if (rec.bouncerWarning === "suspended") t.suspended++;
    }
  }
  const label = `${planName}, ${releaseName} release, ${field} field`.padEnd(40);
  console.log(
    `${label} ${((6 * t.runs) / t.legal).toFixed(2)} rpo  ${(t.legal / Math.max(1, t.wkts)).toFixed(1)} balls/wkt  ` +
      `${(t.wd / n).toFixed(1)} wides  ${(t.nb / n).toFixed(1)} no-balls a innings${t.suspended ? `  ${t.suspended} bowlers taken off` : ""}`,
  );
}
