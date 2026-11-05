// How the player's batting fares against the computer's bowling: 50-over innings batted by scripted players
// (how well they time it, which shots and feet they choose), against the computer's own batting (sim-report).
//   node tools/batting-report.mjs [innings per row]       ROWS=0,2 for just those rows, FROM=61 to start later
// Each ball the scripted player picks the shot a sensible batter would (the computer's choice for that ball),
// then plays it with the player's timing window and a timing error drawn from his profile.
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { NORMAL_CHARGE } from "../src/sim/batting.js";
import { PLAYER_TIMING_WINDOW, POWER_CHARGE } from "../src/sim/shot-timing.js";

const n = Number(process.argv[2] ?? 20);
const pitches = ["green", "dust", "cracked"];
const front = (shot) =>
  shot.type === "cutpull" ? { ...shot, type: "drive" } : shot.type === "defend" ? { ...shot, foot: "front" } : shot;
const back = (shot) =>
  shot.type === "drive" || shot.type === "loft"
    ? { ...shot, type: "cutpull" }
    : shot.type === "defend"
      ? { ...shot, foot: "back" }
      : shot;

/** Each row: a name, his timing (sd of the error, s), and how he changes the sensible shot (feet, power). */
const rows = [
  ["perfect timing", 0, (s) => s],
  ["good timing", 0.025, (s) => s],
  ["average timing", 0.05, (s) => s],
  ["good timing, power on every attack", 0.025, (s) => s, true],
  ["good timing, always forward", 0.025, front],
  ["good timing, always back", 0.025, back],
];

const only = process.env.ROWS?.split(",").map(Number);
const from = Number(process.env.FROM ?? 1);
for (const [name, sd, choose, power] of rows.filter((_, i) => !only || only.includes(i))) {
  const t = { runs: 0, legal: 0, wkts: 0, fours: 0, sixes: 0, middled: 0, edged: 0, played: 0, how: {} };
  for (let seed = from; seed < from + n; seed++) {
    const m = new Match(australia(), england(), pitches[seed % 3], 50, new Rng(seed), "bat");
    const inn = m.inn;
    const hand = new Rng(seed * 7 + 3);
    for (let i = 0; !inn.isOver && i < 4000; i++) {
      if (m.needOver) m.startOver();
      const { intent, releaseError } = m.aiPlan();
      const d = m.deliver(intent, releaseError);
      const sensible = choose(m.aiShot(d));
      const attacking = sensible.type !== "defend" && sensible.type !== "leave";
      const shot = {
        ...sensible,
        charge: attacking ? (power ? POWER_CHARGE : NORMAL_CHARGE) : 0,
        timingError: sd ? hand.normal(0, sd) : 0,
        windowMult: PLAYER_TIMING_WINDOW,
      };
      const play = m.resolve(intent, d, shot, false);
      play.live.setup.aiRunning = true;
      for (let k = 0; !(play.live.dead && play.live.t >= play.live.deadAt) && k++ < 2000; ) play.live.step(0.02);
      const kind = play.res.contact.kind;
      if (shot.type !== "leave") t.played++;
      if (kind === "middle") t.middled++;
      if (kind === "thinEdge" || kind === "thickEdge" || kind === "insideEdge" || kind === "topEdge" || kind === "bottomEdge")
        t.edged++;
      const { rec } = m.finish(play);
      t.runs += rec.total;
      if (rec.legal) t.legal++;
      if (rec.wicket) {
        t.wkts++;
        t.how[rec.wicket.how] = (t.how[rec.wicket.how] ?? 0) + 1;
      }
      if (rec.boundary === 4) t.fours++;
      if (rec.boundary === 6) t.sixes++;
    }
  }
  const out = Object.entries(t.how)
    .sort((a, b) => b[1] - a[1])
    .map(([how, k]) => `${how} ${Math.round((100 * k) / Math.max(1, t.wkts))}%`)
    .join(", ");
  console.log(
    `${name.padEnd(36)} ${((6 * t.runs) / t.legal).toFixed(2)} rpo  ${(t.legal / Math.max(1, t.wkts)).toFixed(1)} balls/wkt  ` +
      `${((6 * (t.fours + t.sixes)) / Math.max(1, t.legal)).toFixed(2)} boundaries/over  ` +
      `middled ${Math.round((100 * t.middled) / Math.max(1, t.played))}% edged ${Math.round((100 * t.edged) / Math.max(1, t.played))}%  out: ${out}`,
  );
}
