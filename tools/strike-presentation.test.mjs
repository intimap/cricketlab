import test from "node:test";
import assert from "node:assert/strict";
import { updateStrikePresentation, STRIKE_CLOSE_HOLD } from "../src/scenes/strike-presentation.js";

const scene = (options = {}) => ({ now: 1.1, cur: { strikeAt: 1 }, timeScale: 0.3, cam: "auto", view: "close", ...options });

test("a struck ball immediately returns to full pace during the close follow-through", () => {
  const s = scene();
  updateStrikePresentation(s);
  assert.equal(s.timeScale, 1);
  assert.equal(s.view, "close");
});

test("auto cuts wide after the shorter launch hold without retaining slow motion", () => {
  const s = scene({ now: 1 + STRIKE_CLOSE_HOLD + 0.001 });
  updateStrikePresentation(s);
  assert.equal(s.view, "wide");
  assert.equal(s.timeScale, 1);
});

test("manual close and wide cameras keep their selection and full strike pace", () => {
  for (const view of ["close", "wide"]) {
    const s = scene({ now: 3, cam: view, view });
    updateStrikePresentation(s);
    assert.equal(s.view, view);
    assert.equal(s.timeScale, 1);
  }
});

test("unstruck deliveries and soft blocks keep their existing presentation", () => {
  for (const cur of [null, { strikeAt: null }, { strikeAt: undefined }]) {
    const s = scene({ cur, timeScale: 1 });
    updateStrikePresentation(s);
    assert.equal(s.view, "close");
    assert.equal(s.timeScale, 1);
  }
});
