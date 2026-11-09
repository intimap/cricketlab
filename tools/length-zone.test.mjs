import test from "node:test";
import assert from "node:assert/strict";
import { zoneBand } from "../src/render/length-zone.js";
import { lengthName } from "../src/sim/delivery.js";
import { LENGTH_CUE } from "../src/scenes/match-ball.js";

/** The ring colour sim/delivery.js's length names get (scenes/ball-ring.js). */
const COLOUR = {
  "full toss": "purple",
  yorker: "purple",
  full: "green",
  "good length": "gold",
  "back of a length": "red",
  short: "red",
};

test("each length zone covers the lengths its colour stands for, for pace and spin", () => {
  for (const spinner of [false, true]) {
    for (let z = 1.3; z < 11.4; z += 0.1) {
      const colour = COLOUR[lengthName(z, spinner)];
      const [from, to] = zoneBand(colour, spinner);
      assert.ok(z >= from - 1e-9 && z < to + 1e-9, `${spinner ? "spin" : "pace"} ${z.toFixed(1)} m: ${colour} [${from}, ${to}]`);
    }
  }
});

test("the cue flashes half a second before release", () => {
  assert.equal(LENGTH_CUE, 0.5);
});
