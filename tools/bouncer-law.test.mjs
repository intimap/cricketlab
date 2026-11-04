import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england, isSpinner } from "../src/sim/teams.js";
import { warningCall } from "../src/sim/booth-law-lines.js";
import { fitsBox } from "../src/render/booth.js";

/** Bowl one ball of `intent` with a perfect release, on the computer for everything else. */
function bowl(m, intent) {
  const d = m.deliver(intent, 0);
  const play = m.resolve(intent, d, m.aiShot(d), false);
  play.live.setup.aiRunning = true;
  for (let k = 0; !(play.live.dead && play.live.t >= play.live.deadAt) && k++ < 2000; ) play.live.step(0.02);
  return m.finish(play);
}

const seamer = (inn) => inn.bowl.findIndex((b) => !isSpinner(b.p.bowl));
const bouncer = { type: "bouncer", line: 0, length: 11, effort: "high", wicketSide: "over" };

test("a third bouncer in an over is a no-ball and a warning, the next time the bowler is taken off", () => {
  const m = new Match(australia(), england(), "green", 50, new Rng(4), "bowl");
  const inn = m.inn;
  const first = seamer(inn);
  m.startOver(first);
  const calls = [];
  for (let i = 0; i < 12 && !inn.bowl[first].suspended && !inn.isOver; i++) {
    const { rec } = bowl(m, bouncer);
    if (rec.bouncerWarning) calls.push(rec.bouncerWarning);
    // Carry on with the same bowler into his next over (skipping the rule against bowling two running).
    if (m.needOver && !inn.bowl[first].suspended) {
      inn.lastOverBowler = -1;
      m.startOver(first);
    }
  }
  assert.deepEqual(calls, ["warning", "suspended"]);
  assert.ok(!inn.canBowl(first));
  assert.ok(m.needOver, "someone else finishes the over");
});

test("a side that has run out of bowlers can still bowl", () => {
  const m = new Match(australia(), england(), "green", 50, new Rng(5), "bowl");
  const inn = m.inn;
  for (const b of inn.bowl) b.suspended = true;
  assert.ok(inn.bowl.some((_, i) => inn.canBowl(i)));
});

test("a ball that gets up past the shoulder counts as a bouncer, a back-of-a-length one doesn't", () => {
  const m = new Match(australia(), england(), "green", 50, new Rng(6), "bowl");
  m.startOver(seamer(m.inn));
  m.deliver({ type: "seam", line: 0.2, length: 8.5, effort: "med" }, 0);
  assert.equal(m.inn.overBouncers, 0);
  m.deliver(bouncer, 0);
  assert.equal(m.inn.overBouncers, 1);
});

test("the box's warning lines fit", () => {
  for (const kind of ["warning", "suspended"])
    for (const who of [0, 1, 2])
      for (const n of [0, 1]) assert.ok(fitsBox(warningCall(who, kind, { w: "Atkinsonne" }, (l) => l[n])));
});
