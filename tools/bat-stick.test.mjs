import test from "node:test";
import assert from "node:assert/strict";
import { readSwing, readSwingPlus, aimOf, BACK, FULL, DROP, FLICK, AIM_DEAD, AIM_FULL } from "../src/scenes/bat-stick.js";
import { strokeFor } from "../src/sim/strokes.js";
import { aimOffset, AIM_RANGE } from "../src/sim/shot-direction.js";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { TEAMS } from "../src/sim/team-list.js";
import { NORMAL_CHARGE } from "../src/sim/batting.js";
import { PLAYER_TIMING_WINDOW } from "../src/sim/shot-timing.js";

/** Play a path of stick positions, 60 a second from t0: [x, y] each frame. Returns the shot, if one is played. */
function swing(path, { t0 = 0, armed = true, track = {}, read = readSwing } = {}) {
  let shot = null;
  path.forEach(([x, y], i) => {
    shot = read(track, { x, y, t: t0 + i / 60 }, armed) ?? shot;
  });
  return { shot, track };
}
/** STICK PLUS's reader. */
const plus = (path, options = {}) => swing(path, { ...options, read: readSwingPlus });
/** Round the edge of the stick from one angle to another (degrees: 0 the screen's right, 90 straight back). */
const roll = (from, to, frames) =>
  Array.from({ length: frames }, (_, i) => {
    const a = ((from + ((to - from) * (i + 1)) / frames) * Math.PI) / 180;
    return [Math.cos(a), Math.sin(a)];
  });
/** A smooth move from one stick position to another over `frames` frames. */
const move = (from, to, frames) =>
  Array.from({ length: frames }, (_, i) => [
    from[0] + ((to[0] - from[0]) * (i + 1)) / frames,
    from[1] + ((to[1] - from[1]) * (i + 1)) / frames,
  ]);
const hold = (at, frames) => Array.from({ length: frames }, () => at);

test("the backswing picks the shot: none a block, part an attack, to the stop the loft, to the side a sweep", () => {
  const block = swing([...hold([0, 0], 5), ...move([0, 0], [0, -1], 8)]).shot;
  assert.equal(block.button, "defend");
  const part = swing([...move([0, 0], [0, 0.6], 8), ...hold([0, 0.6], 10), ...move([0, 0.6], [0, -1], 10)]).shot;
  assert.equal(part.button, "attack");
  const full = swing([...move([0, 0], [0, 1], 8), ...hold([0, 1], 10), ...move([0, 1], [0, -1], 10)]).shot;
  assert.equal(full.button, "loft");
  const sweep = swing([...move([0, 0], [-0.9, 0.2], 8), ...hold([-0.9, 0.2], 10), ...move([-0.9, 0.2], [0, -1], 10)]).shot;
  assert.equal(sweep.button, "improvise");
  assert.equal(sweep.side, -1);
  assert.ok(FULL > BACK);
});

test("the shot is timed from the moment the stick goes forward past the middle", () => {
  const path = [...move([0, 0], [0, 0.7], 6), ...hold([0, 0.7], 30), ...move([0, 0.7], [0, -1], 10)];
  const { shot } = swing(path, { t0: 2 });
  // The frame where y first goes to -0.3 or beyond.
  const frame = path.findIndex(([, y]) => y <= -0.3);
  assert.ok(Math.abs(shot.t - (2 + frame / 60)) < 1e-9);
});

test("a flick forward is power; a firm push isn't", () => {
  const flick = swing([...move([0, 0], [0, 1], 8), ...hold([0, 1], 10), [0, 0.2], [0, -1]]).shot;
  assert.equal(flick.power, true);
  const push = swing([...move([0, 0], [0, 1], 8), ...hold([0, 1], 10), ...move([0, 1], [0, -1], 14)]).shot;
  assert.equal(push.power, false);
  assert.ok(FLICK < 14 / 60);
});

test("pulled back and let go, the bat comes down and nothing is played", () => {
  const { shot, track } = swing([...move([0, 0], [0, 0.8], 6), ...hold([0, 0.8], 10), [0, 0], ...hold([0, 0], 20)]);
  assert.equal(shot, null);
  assert.equal(track.depth, 0, "the backswing is let go");
  assert.ok(20 / 60 > DROP);
  // Then a push forward from the middle is a block, not the attack he'd let go.
  assert.equal(swing(move([0, 0], [0, -1], 8), { t0: 1, track }).shot.button, "defend");
});

test("before the ball's let go a push forward plays nothing; a backswing held through it still counts", () => {
  const track = {};
  assert.equal(swing([...move([0, 0], [0, 0.6], 6), ...move([0, 0.6], [0, -1], 6)], { armed: false, track }).shot, null);
  const held = {};
  swing([...move([0, 0], [0, 1], 6), ...hold([0, 1], 30)], { armed: false, track: held });
  assert.equal(swing([...hold([0, 1], 4), ...move([0, 1], [0, -1], 10)], { t0: 1, track: held }).shot.button, "loft");
});

test("the stick's side says which way an improvised shot goes; without it the feet do", () => {
  const forward = { stride: "forward", across: 0 };
  assert.equal(strokeFor("improvise", forward, null, false, "off").type, "reverseSweep");
  assert.equal(strokeFor("improvise", forward, null, false, "leg").type, "sweep");
  assert.equal(strokeFor("improvise", { stride: "forward", across: 0.2 }).type, "reverseSweep");
  assert.equal(strokeFor("improvise", { stride: "back", across: 0 }, null, false, "off").type, "ramp");
});

test("STICK PLUS: a roll round the back is the sweep, going the way it finishes, timed as it gets there", () => {
  // From the screen's left (180°) round the back (90°) to its right (0°).
  const path = [...move([0, 0], [-1, 0], 6), ...roll(180, 0, 24)];
  const { shot } = plus(path, { t0: 3 });
  assert.equal(shot.button, "improvise");
  assert.equal(shot.side, 1);
  // Reached the right-hand side: out to a side and near level.
  const frame = path.findIndex(([x, y]) => x >= 0.6 && y <= 0.5 * x);
  assert.ok(Math.abs(shot.t - (3 + frame / 60)) < 1e-9);
  assert.equal(shot.power, false);
  // And the other way round.
  assert.equal(plus([...move([0, 0], [1, 0], 6), ...roll(0, 180, 24)]).shot.side, -1);
  // Rolled fast, it's power (the slog-sweep).
  assert.equal(plus([...move([0, 0], [1, 0], 6), ...hold([1, 0], 4), ...roll(0, 180, 6)]).shot.power, true);
});

test("STICK PLUS: corner to corner along the bottom, or a roll that comes back to the middle, isn't a sweep", () => {
  // Straight back, to the bottom-left corner, round to the bottom-right: still just a backswing.
  const corners = plus([...move([0, 0], [0, 1], 6), ...roll(90, 135, 6), ...roll(135, 45, 12)]);
  assert.equal(corners.shot, null);
  // Half a roll, back to the middle, then the rest: broken, nothing played.
  const broken = plus([...move([0, 0], [-1, 0], 6), ...roll(180, 90, 10), ...move([0, 1], [0, 0], 4), ...roll(90, 0, 10)]);
  assert.equal(broken.shot, null);
});

test("STICK PLUS: the follow-through aims; straight back and up is the shot's own line", () => {
  const straight = plus([...move([0, 0], [0, 0.6], 8), ...hold([0, 0.6], 10), ...move([0, 0.6], [0.08, -1], 10)]).shot;
  assert.equal(straight.button, "attack");
  assert.equal(straight.aim, 0);
  // Back, round to the bottom-left corner, then pushed across to the top-right (the photo): aimed right, all the way.
  const across = plus([...move([0, 0], [0, 1], 6), ...roll(90, 135, 8), ...move([-0.71, 0.71], [0.71, -0.71], 10)]).shot;
  assert.equal(across.button, "loft");
  assert.equal(across.aim, 1);
  // From the bottom-right corner, pushed up a little to the left: aimed left, part way.
  const left = plus([...move([0, 0], [0.5, 0.6], 8), ...move([0.5, 0.6], [-0.2, -0.9], 10)]).shot;
  assert.ok(left.aim < -0.3 && left.aim > -1, `aim ${left.aim}`);
  // A block can be angled: no backswing, pushed up to the right.
  const block = plus(move([0, 0], [0.6, -0.8], 8)).shot;
  assert.equal(block.button, "defend");
  assert.ok(block.aim > 0.3);
  assert.equal(aimOf(AIM_DEAD - 1), 0);
  assert.equal(aimOf(-AIM_FULL - 10), -1);
});

test("STICK PLUS: how far back is the straight-back part, so moving round to the side isn't a loft", () => {
  // Part way back, then round the edge to the side: still an attack (the old reader would call it all the way).
  const side = plus([...move([0, 0], [0, 0.6], 6), ...move([0, 0.6], [-0.95, 0.3], 8), ...move([-0.95, 0.3], [0, -1], 8)]).shot;
  assert.equal(side.button, "attack");
  // To the stop, then round to a corner: still the loft.
  const corner = plus([...move([0, 0], [0, 1], 6), ...roll(90, 135, 6), ...move([-0.71, 0.71], [0, -1], 8)]).shot;
  assert.equal(corner.button, "loft");
  assert.ok(FULL > 0.71, "a corner alone isn't to the stop");
});

test("STICK PLUS: before the ball's let go a roll plays nothing; let go, the backswing and the roll are forgotten", () => {
  const track = {};
  assert.equal(plus([...move([0, 0], [-1, 0], 6), ...roll(180, 0, 20)], { armed: false, track }).shot, null);
  // He can roll straight back the other way once it's on its way.
  assert.equal(plus(roll(0, 180, 20), { t0: 1, track }).shot.side, -1);
  const { shot, track: dropped } = plus([...move([0, 0], [0, 0.9], 6), [0, 0], ...hold([0, 0], 20)]);
  assert.equal(shot, null);
  assert.equal(dropped.depth, 0);
  assert.ok(20 / 60 > DROP);
});

test("an aimed shot goes that way: the sim turns it off its natural line", () => {
  assert.equal(aimOffset(1), AIM_RANGE);
  assert.equal(aimOffset(-1, true), -AIM_RANGE / 2);
  assert.equal(aimOffset(null), 0);
  // The same ball, the same drive, aimed off side, straight and leg side.
  const sums = { "-1": 0, 0: 0, 1: 0 };
  let n = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const bearings = {};
    for (const aim of [-1, 0, 1]) {
      const m = new Match(TEAMS.AUS(), TEAMS.ENG(), "green", 50, new Rng(seed), "bat");
      m.startOver();
      const { intent, releaseError } = m.aiPlan();
      const d = m.deliver(intent, releaseError);
      const feet = { stride: "forward", across: 0, from: null };
      const shot = {
        type: "drive",
        charge: NORMAL_CHARGE,
        timingError: 0,
        windowMult: PLAYER_TIMING_WINDOW,
        feet,
        footwork: 0,
        aim,
      };
      const { res } = m.resolve(intent, d, shot, false);
      if (res.contact.kind !== "middle") break;
      bearings[aim] = (Math.atan2(res.contact.exit.x, res.contact.exit.z) * 180) / Math.PI;
    }
    if (Object.keys(bearings).length < 3) continue;
    n++;
    for (const aim of [-1, 0, 1]) sums[aim] += bearings[aim];
  }
  assert.ok(n >= 10, `middled ${n}`);
  assert.ok((sums[1] - sums[0]) / n > 25, "aimed to the off side");
  assert.ok((sums[0] - sums[-1]) / n > 25, "aimed to the leg side");
});
