// How the player's batting fares against the computer's bowling: 50-over innings batted by scripted players
// (how well they time it, which shots and feet they choose), against the computer's own batting (sim-report).
//   node tools/batting-report.mjs [innings per row]       ROWS=0,2 for just those rows, FROM=61 to start later
//   FORMAT=t20 | odi | test (default odi: 50 overs; t20 20 overs; test the first innings of a Test)
// Each ball the scripted player picks the shot a sensible batter would (the computer's choice for that ball),
// with his profile's feet (the right ones for the length, or always the same), then plays it with the
// player's timing window and a timing error drawn from his profile. The aimed rows aim it (CONTROLS: STICK PLUS)
// at random, or at the widest gap near its line as a player would judge it from the field and the bowler's line.
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england } from "../src/sim/teams.js";
import { NORMAL_CHARGE } from "../src/sim/batting.js";
import { PLAYER_TIMING_WINDOW, POWER_CHARGE } from "../src/sim/shot-timing.js";
import { computerFeet } from "../src/sim/feet.js";
import { shotBearing, AIM_RANGE } from "../src/sim/shot-direction.js";
import { bearingOf } from "../src/sim/geometry.js";
import { angleDiff } from "../src/math.js";

const n = Number(process.argv[2] ?? 20);
const format = process.env.FORMAT ?? "odi";
const OVERS = { t20: 20, odi: 50, test: 0 };
/** He goes for power when the computer would swing this hard at it (its charges run at AI_SHOT_POWER). */
const POWER_FROM = 0.45;
const pitches = ["green", "dust", "cracked"];
/** The right feet for the length, made in good time: forward to a full one, back to a short one. */
const right = (shot, d, hand) => {
  const feet = computerFeet({
    type: shot.type,
    pitchZ: d.pitchedAt?.z ?? 0,
    line: 0,
    spinner: false,
    footwork: 1,
    settled: 1,
    aggression: 0,
    rng: hand,
  });
  return { ...shot, feet: { ...feet, across: shot.feet.across, from: null } };
};
const always = (stride) => (shot) => ({ ...shot, feet: { ...shot.feet, stride, from: null } });
/** Never moving at all: on the crease, not across it either. */
const still = (shot) => ({ ...shot, feet: { stride: "crease", across: 0, from: null } });

/** Shots the stick can aim (a sweep's side comes from the roll). */
const AIMABLE = ["drive", "loft", "cutpull", "defend"];
/** The aim (-1..1) that puts the shot nearest the middle of a gap, from its line as he'd judge it. */
function gapAim(shot, intent, inn) {
  const back = shot.type === "cutpull" ? (intent.line > 0.15 ? "cut" : "pull") : null;
  const natural = shotBearing(shot.type, intent.line, 1, back, shot.variant);
  const field = [0, ...inn.placements.slice(0, 9).map((p) => bearingOf(p.pos.x, p.pos.z))];
  const range = AIM_RANGE * (shot.type === "defend" ? 0.5 : 1);
  let best = 0;
  let bestGap = -1;
  for (let aim = -1; aim <= 1.001; aim += 0.125) {
    const gap = Math.min(...field.map((f) => Math.abs(angleDiff(natural + aim * range, f))));
    if (gap > bestGap + 0.5 || (Math.abs(gap - bestGap) <= 0.5 && Math.abs(aim) < Math.abs(best))) [best, bestGap] = [aim, gap];
  }
  return best;
}

/**
 * Each row: a name, his timing (sd of the error, s), his feet for the sensible shot, power on every attack, and
 * how he aims (STICK PLUS: "random" or "gaps"; none, the shot's own line).
 */
const rows = [
  ["perfect timing", 0, right],
  ["good timing", 0.025, right],
  ["average timing", 0.05, right],
  ["good timing, power on every attack", 0.025, right, true],
  ["good timing, on the crease", 0.025, still],
  ["good timing, always forward", 0.025, always("forward")],
  ["good timing, always back", 0.025, always("back")],
  ["good timing, aimed at random", 0.025, right, false, "random"],
  ["good timing, aimed into the gaps", 0.025, right, false, "gaps"],
];

const only = process.env.ROWS?.split(",").map(Number);
const from = Number(process.env.FROM ?? 1);
for (const [name, sd, choose, power, aiming] of rows.filter((_, i) => !only || only.includes(i))) {
  const t = { runs: 0, legal: 0, wkts: 0, fours: 0, sixes: 0, middled: 0, edged: 0, played: 0, how: {} };
  for (let seed = from; seed < from + n; seed++) {
    const m = new Match(
      australia(),
      england(),
      pitches[seed % 3],
      OVERS[format],
      new Rng(seed),
      "bat",
      format === "test" ? { test: true } : { innings: 2 },
    );
    const inn = m.inn;
    const hand = new Rng(seed * 7 + 3);
    for (let i = 0; !inn.isOver && i < 4000; i++) {
      if (m.needOver) m.startOver();
      const { intent, releaseError } = m.aiPlan();
      const d = m.deliver(intent, releaseError);
      const sensible = choose(m.aiShot(d), d, hand);
      const attacking = sensible.type !== "defend" && sensible.type !== "leave";
      const shot = {
        ...sensible,
        charge: attacking ? (power || sensible.charge >= POWER_FROM ? POWER_CHARGE : NORMAL_CHARGE) : 0,
        timingError: sd ? hand.normal(0, sd) : 0,
        windowMult: PLAYER_TIMING_WINDOW,
      };
      if (aiming && AIMABLE.includes(shot.type)) shot.aim = aiming === "random" ? hand.range(-1, 1) : gapAim(shot, intent, inn);
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
