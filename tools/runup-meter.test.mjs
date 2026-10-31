import test from "node:test";
import assert from "node:assert/strict";
import { planRunup, meterPos, releaseError, noBallPos, METER_NO_BALL, METER_FROM, METER_TRACK_FROM } from "../src/sim/runup.js";

const styles = ["fast", "swing", "medium", "offspin", "legspin"];
const efforts = ["low", "med", "high"];
const timeAt = (r, pos) => pos <= 1 ? r.dur * pos ** (1 / r.ramp) : r.dur * (1 + (pos - 1) / r.ramp);

test("all bowling styles and efforts start slowly and accelerate monotonically to the sweet spot", () => {
  for (const style of styles) for (const effort of efforts) for (const stamina of [0, 0.5, 1]) {
    const r = planRunup(style, effort, stamina, () => 0.5);
    assert.ok(r.ramp > 1);
    assert.equal(meterPos(r, 0), METER_TRACK_FROM);
    assert.equal(meterPos(r, r.dur), 1);
    let last = 0;
    for (let i = 0; i < 99; i++) {
      const speed = meterPos(r, r.dur * (i + 1) / 100) - meterPos(r, r.dur * i / 100);
      assert.ok(speed > last, `${style}/${effort}/${stamina}: marker slows at ${i}%`);
      last = speed;
    }
    assert.ok(meterPos(r, r.dur * .25) < .2);
    assert.ok(meterPos(r, r.dur * .9) > .7);
  }
});

test("the gold zone and red threshold still represent the actual release error", () => {
  for (const style of styles) for (const effort of efforts) for (const stamina of [0, 1]) {
    const r = planRunup(style, effort, stamina, () => 0.5);
    assert.equal(releaseError(r, meterPos(r, r.dur)), 0);
    for (const pos of [1 - r.zone / r.dur, 1 + r.zone / r.dur, noBallPos(r)]) {
      assert.ok(Math.abs(meterPos(r, timeAt(r, pos)) - pos) < 1e-10);
    }
    assert.ok(Math.abs(releaseError(r, noBallPos(r)) - METER_NO_BALL) < 1e-10);
    const zoneDuration = timeAt(r, 1 + r.zone / r.dur) - timeAt(r, 1 - r.zone / r.dur);
    assert.ok(zoneDuration >= .04 - 1e-8, `Gold zone too brief: ${zoneDuration}`);
  }
});

test("the late segment joins the acceleration curve without a jump in position or speed", () => {
  const r = planRunup("fast", "high", 0, () => 0.5);
  const dt = 1e-6;
  const before = (1 - meterPos(r, r.dur - dt)) / dt;
  const after = (meterPos(r, r.dur + dt) - 1) / dt;
  assert.ok(Math.abs(before - after) < 1e-5);
  assert.equal(METER_FROM, .4, "Earliest release gate changed");
  assert.equal(METER_TRACK_FROM, 0, "The slow approach is still hidden");
});
