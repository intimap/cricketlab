// What each weather does to a day's cricket: AI-vs-AI innings with the weather held, against none.
//   node tools/weather-report.mjs [innings per weather]
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { WEATHER, NO_WEATHER } from "../src/sim/weather.js";

const n = Number(process.argv[2] ?? 60);
const pitches = ["green", "dust", "cracked"];
for (const [id, w] of [["none", NO_WEATHER], ...Object.entries(WEATHER)]) {
  const t = { legal: 0, runs: 0, wkts: 0, fours: 0, swingOuts: 0 };
  for (let seed = 1; seed <= n; seed++) {
    const m = new Match(australia(), england(), pitches[seed % 3], 90, new Rng(seed), "bat");
    m.pitch.weather = w;
    while (!m.inn.isOver) {
      const { rec } = m.simBall();
      if (rec.legal) t.legal++;
      t.runs += rec.total;
      if (rec.wicket) t.wkts++;
      if (rec.boundary === 4) t.fours++;
    }
  }
  const rpo = (6 * t.runs) / t.legal;
  console.log(
    `${id.padEnd(9)} ${rpo.toFixed(2)} rpo  ${(t.legal / Math.max(1, t.wkts)).toFixed(1)} balls/wkt  ${(t.fours / n).toFixed(1)} fours/inns`,
  );
}
