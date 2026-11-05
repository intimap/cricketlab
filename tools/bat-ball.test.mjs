import test from "node:test";
import assert from "node:assert/strict";
import { collide, effectiveMass, faceTilt, restitution, strike, DEFAULT_BAT } from "../src/sim/bat-ball.js";
import { batImpact } from "../src/sim/bat-impact.js";
import { stepBall } from "../src/sim/ball-roll.js";

// A 135 km/h ball, climbing a little as it reaches the bat.
const ball = { x: 0, y: 1.5, z: -37.5 };
const impactAt = (dx = 0) => batImpact({ dx, dy: 0, timing: 0, type: "drive", sweetWidth: 0.033 });
const drive = (options = {}) => strike({ ball, bearing: 30, tilt: -1, speed: 12.4, impact: impactAt(), ...options });
const speedOf = (v) => Math.hypot(v.x, v.y, v.z);
const bearingOf = (v) => (Math.atan2(v.x, v.z) * 180) / Math.PI;
const elevationOf = (v) => (Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180) / Math.PI;

test("the bat's weight counts most at its balance point, less towards the toe and the handle", () => {
  const at = (along) => effectiveMass(DEFAULT_BAT, along);
  assert.equal(at(DEFAULT_BAT.balance), DEFAULT_BAT.mass);
  assert.ok(at(0.2) > at(0.05) && at(0.45) > at(0.6));
});

test("a new ball comes off the bat harder than an old one", () => {
  assert.equal(restitution(1), 0.5);
  assert.equal(restitution(0), 0.42);
  assert.ok(speedOf(drive().vel) > speedOf(drive({ hardness: 0 }).vel));
});

test("a middled drive goes where it's aimed, faster for a harder swing", () => {
  for (const bearing of [-60, -20, 0, 30, 80])
    assert.ok(
      Math.abs(
        bearingOf(drive({ bearing }).vel) -
          bearingOf({ x: Math.sin((bearing * Math.PI) / 180), z: Math.cos((bearing * Math.PI) / 180) }),
      ) < 0.5,
    );
  const normal = speedOf(drive().vel);
  const full = speedOf(drive({ speed: 27 }).vel);
  assert.ok(normal > 25 && normal < 32, `normal drive ${normal}`);
  assert.ok(full > 40 && full < 50, `full swing ${full}`);
});

test("turning the face turns the shot, and an open face lifts it", () => {
  assert.ok(bearingOf(drive({ turn: 5 }).vel) > 35);
  assert.ok(bearingOf(drive({ turn: -5 }).vel) < 25);
  assert.ok(elevationOf(drive({ tilt: 10 }).vel) > elevationOf(drive().vel) + 10);
});

test("edges go finer the thinner they are, and the outside edge carries", () => {
  let last = bearingOf(drive().vel);
  for (const dx of [0.04, 0.06, 0.08, 0.095]) {
    const impact = impactAt(dx);
    const out = strike({ ball, bearing: 30, tilt: -1, speed: 12.4, impact, offset: { x: impact.across, y: 0 } }).vel;
    assert.ok(bearingOf(out) > last, `${dx}: ${bearingOf(out)} after ${last}`);
    assert.ok(elevationOf(out) > 2);
    last = bearingOf(out);
  }
  // The inside edge goes the other way, round to fine leg.
  const inside = impactAt(-0.095);
  assert.ok(
    bearingOf(strike({ ball, bearing: 30, tilt: -1, speed: 12.4, impact: inside, offset: { x: inside.across, y: 0 } }).vel) <
      -120,
  );
});

test("an edge's deflection doesn't jump where the middle of the bat ends", () => {
  const face = 0.033;
  const at = (dx) => {
    const impact = impactAt(dx);
    return strike({ ball, bearing: 30, tilt: -1, speed: 12.4, impact, offset: { x: impact.across, y: 0 } }).vel;
  };
  const a = at(face - 1e-7);
  const b = at(face + 1e-7);
  assert.ok(Math.abs(bearingOf(a) - bearingOf(b)) < 0.05 && Math.abs(speedOf(a) - speedOf(b)) < 0.05);
});

test("soft hands take the pace off a block", () => {
  const block = (soft) => speedOf(strike({ ball, bearing: 0, tilt: -5, speed: 2.5, impact: impactAt(), soft }).vel);
  assert.ok(block(0.6) < block(0) * 0.8);
  assert.ok(block(0.6) < 10);
});

test("a ball sliding down the face gets topspin, up it backspin; moving apart there's no contact", () => {
  const n = { x: 0, y: 0, z: 1 };
  const bat = { x: 0, y: 0, z: 15 };
  assert.ok(collide({ x: 0, y: -4, z: -30 }, bat, n, 1, 0.5).spin > 20);
  assert.ok(collide({ x: 0, y: 4, z: -30 }, bat, n, 1, 0.5).spin < -20);
  assert.deepEqual(collide({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: 0 }, n, 1, 0.5), { vel: { x: 0, y: 0, z: 5 }, spin: 0 });
});

test("only a clearly early shot lifts the face, and a loft lifts it more with power", () => {
  assert.equal(faceTilt("drive", null, 0.5, 0.35, 0.5), faceTilt("drive", null, 0.5, 0.35, 0));
  assert.ok(faceTilt("drive", null, 0.5, 0.35, 1.7) > faceTilt("drive", null, 0.5, 0.35, 0) + 10);
  assert.ok(faceTilt("loft", null, 0.5, 1, 0) > faceTilt("loft", null, 0.5, 0.35, 0));
});

test("topspin keeps a ball's pace at the bounce and backspin checks it", () => {
  const bounce = (spin) => {
    const b = { pos: { x: 0, y: 0.001, z: 5 }, vel: { x: 0, y: -4, z: 25 }, spin, bounced: false };
    stepBall(b, 0.01, 0.5);
    return b.vel.z;
  };
  assert.ok(bounce(60) > bounce(0) && bounce(0) > bounce(-60));
});
