import test from "node:test";
import assert from "node:assert/strict";
import { bowlingGeometry, bowlerFieldingHome } from "../src/sim/bowling-side.js";
import { bowlDelivery } from "../src/sim/delivery.js";
import { Ball, Pitch, PITCH_TYPES } from "../src/sim/conditions.js";
import { Rng } from "../src/sim/rng.js";
import { selectedWicketSide, activeWicketSide, updateBowlingSide } from "../src/scenes/bowling-side.js";
import { pressKey, releaseKey, endFrame, mouse } from "../src/engine/input.js";
import { bowlerPose } from "../src/render/bowler-motion.js";
import { Match } from "../src/sim/match.js";
import { australia, england } from "../src/sim/teams.js";

const skills = style => ({ style, pace: 0.8, accuracy: 0.8, swing: 0.6, seam: 0.6, spin: 0.8, consistency: 0.8 });
const delivery = (style, wicketSide) => {
  const pitch = new Pitch(PITCH_TYPES.green);
  const rng = new Rng(43);
  const intent = { type: style === "fast" ? "seam" : style, line: 0.22, length: 6.4, effort: "med" };
  if (wicketSide) intent.wicketSide = wicketSide;
  const d = bowlDelivery(intent, skills(style), 1, new Ball(pitch.type.abrasion), pitch, 0, rng);
  return { d, state: rng.state };
};
const tapKey = key => pressKey(key);
const clear = key => { releaseKey(key); endFrame(); };

test("the default and explicit over-wicket deliveries have identical trajectories and dice", () => {
  for (const style of ["fast", "offspin", "legspin"]) {
    const a = delivery(style);
    const b = delivery(style, "over");
    assert.deepEqual(a.d.samples, b.d.samples);
    assert.deepEqual(a.d.release, b.d.release);
    assert.equal(a.state, b.state);
  }
});

test("around changes the release angle, keeping the aiming point, action and random draws", () => {
  for (const style of ["fast", "offspin", "legspin"]) {
    const over = delivery(style, "over");
    const around = delivery(style, "around");
    assert.ok(over.d.release.x > 0 && around.d.release.x < 0);
    assert.notEqual(over.d.release.vx, around.d.release.vx);
    assert.equal(over.d.release.y, around.d.release.y);
    assert.equal(over.d.speed, around.d.speed);
    assert.equal(over.d.spinKick, around.d.spinKick);
    assert.equal(over.d.swingAcc, around.d.swingAcc);
    assert.equal(over.d.pitchedAt.z, around.d.pitchedAt.z);
    assert.ok(Math.abs(over.d.pitchedAt.x - around.d.pitchedAt.x) < 0.03);
    assert.ok(Math.abs(over.d.atCrease.x - around.d.atCrease.x) > 0.05);
    assert.equal(over.state, around.state);
    assert.deepEqual(around, delivery(style, "around"));
  }
});

test("side selection toggles by keyboard or pointer, is per bowler, and locks during a run-up", () => {
  const scene = { phase: "setup", inn: { currentBowler: 0 } };
  assert.equal(selectedWicketSide(scene), "over");
  tapKey("KeyT");updateBowlingSide(scene);clear("KeyT");
  assert.equal(selectedWicketSide(scene), "around");
  scene.inn.currentBowler = 1;
  assert.equal(selectedWicketSide(scene), "over");
  mouse.x = 20;mouse.y = 99;mouse.pressed = true;updateBowlingSide(scene);endFrame();
  assert.equal(selectedWicketSide(scene), "around");
  scene.inn.currentBowler = 0;
  assert.equal(selectedWicketSide(scene), "around");
  scene.cur = { intent: { wicketSide: "around" } };scene.phase = "runup";
  tapKey("KeyT");updateBowlingSide(scene);clear("KeyT");
  assert.equal(selectedWicketSide(scene), "around");
  scene.bowlingSides.set(0, "over");
  assert.equal(activeWicketSide(scene), "around");
});

test("the run-up, release pose and follow-through stay on the selected side", () => {
  for (const spinner of [false, true]) for (const side of ["over", "around"]) {
    const lane = bowlingGeometry(spinner, side);
    const scene = { spinner, phase: "setup", cur: null };
    assert.equal(bowlerPose(scene, side).x, lane.startX);
    scene.phase = "runup";scene.cur = { tRun: 2, runupDur: 2, runupStartZ: 33 };
    assert.equal(bowlerPose(scene, side).x, lane.bodyX);
    scene.phase = "flight";scene.cur.t = 0;
    assert.equal(bowlerPose(scene, side).x, lane.bodyX);
    assert.ok(lane.umpireX * lane.startX < 0, "Umpire obstructs run-up");
  }
});

test("the live fielding bowler begins on the matching side after release", () => {
  for (const side of ["over", "around"]) {
    const m = new Match(australia(), england(), "green", 10, new Rng(17), "bowl");m.startOver();
    const intent = { type: m.inn.bowler.p.bowl.repertoire[0], line: 0.22, length: 6.4, effort: "med", wicketSide: side };
    const d = m.deliver(intent, 0);
    const play = m.resolve(intent, d, { type: "leave", charge: 0, timingError: 0 }, false);
    const bowler = play.live.fielders.find(f => f.role === "bowler");
    assert.deepEqual(bowler.home, bowlerFieldingHome(m.spinner, side));
    assert.equal(Math.sign(bowler.pos.x), side === "around" ? -1 : 1);
  }
});
