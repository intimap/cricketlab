import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/sim/match.js";
import { Rng } from "../src/sim/rng.js";
import { australia, england, styleName } from "../src/sim/teams.js";
import { southAfrica } from "../src/sim/squads/south-africa.js";
import { bowlingGeometry } from "../src/sim/bowling-side.js";
import { deliveryName } from "../src/sim/delivery.js";

/** A match with `bowlTeam` in the field, `bowlerName` bowling to the striker (made a left-hander if asked). */
function setUp(bowlTeam, bowlerName, leftHandedStriker = false) {
  const bat = england();
  bat.players[0].hand = leftHandedStriker ? "left" : "right";
  bat.players[1].hand = leftHandedStriker ? "left" : "right";
  const m = new Match(bat, bowlTeam, "dust", 50, new Rng(2), "bowl");
  m.startOver(m.inn.bowl.findIndex((b) => b.p.name === bowlerName));
  return m;
}
const mean = (m, intent, key, n = 30) => {
  let t = 0;
  for (let i = 0; i < n; i++) t += m.deliver(intent, 0)[key];
  return t / n;
};

test("a left-armer releases from the other side of the stumps", () => {
  const m = setUp(australia(), "Michael Stork");
  const d = m.deliver({ type: "seam", line: 0.2, length: 6.5, effort: "med" }, 0);
  assert.ok(d.release.x < -0.2, `${d.release.x}`);
  assert.equal(d.arm, -1);
  const right = bowlingGeometry(false, "over", 1);
  const left = bowlingGeometry(false, "over", -1);
  assert.equal(left.releaseX, -right.releaseX);
  assert.equal(left.umpireX, -right.umpireX);
});

test("his outswinger still goes away from a right-hander, his inswinger comes in", () => {
  const m = setUp(australia(), "Michael Stork");
  assert.ok(mean(m, { type: "outswing", line: 0.2, length: 6, effort: "med" }, "swingAcc") > 0);
  assert.ok(mean(m, { type: "inswing", line: 0.1, length: 6, effort: "med" }, "swingAcc") < 0);
});

test("left-arm orthodox turns away from a right-hander, into a left-hander", () => {
  const rh = setUp(southAfrica(), "Keshav Maharajh");
  assert.ok(mean(rh, { type: "offspin", line: 0.1, length: 5, effort: "med" }, "spinKick") > 0);
  const lh = setUp(southAfrica(), "Keshav Maharajh", true);
  assert.ok(mean(lh, { type: "offspin", line: 0.1, length: 5, effort: "med" }, "spinKick") < 0);
});

test("left-armers are named as such", () => {
  const stork = australia().players.find((p) => p.name === "Michael Stork").bowl;
  const kesh = southAfrica().players.find((p) => p.name === "Keshav Maharajh").bowl;
  assert.equal(styleName(stork), "LEFT-ARM FAST");
  assert.equal(styleName(kesh), "LEFT-ARM SPIN");
  assert.equal(deliveryName("offspin", kesh), "LEFT-ARM SPIN");
  assert.equal(deliveryName("offspin", australia().players.find((p) => p.bowl?.style === "offspin").bowl), "OFFSPIN");
});

test("the computer's left-arm spinner aims off for his turn against a right-hander and still finds the stumps", () => {
  const m = setUp(southAfrica(), "Keshav Maharajh");
  let wides = 0;
  for (let i = 0; i < 60; i++) {
    const { intent, releaseError } = m.aiPlan();
    const d = m.deliver(intent, releaseError);
    if (Math.abs(d.atCrease?.x ?? 0) > 0.9) wides++;
  }
  assert.ok(wides < 6, `${wides} of 60 wide`);
});
