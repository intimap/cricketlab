// The text font (engine/font-glyphs.js): every glyph is whole, figures line up in columns, and text is
// measured by its letters' own widths.
import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, GAP, HEIGHT } from "../src/engine/font-glyphs.js";

// engine/text.js draws to the screen's canvas; only its measuring is used here.
globalThis.document ??= { createElement: () => ({ getContext: () => ({}) }), getElementById: () => null };
const { textWidth, wrapText } = await import("../src/engine/text.js");

test("every glyph is seven rows that fit its width, with ink in it", () => {
  for (const [ch, g] of Object.entries(GLYPHS)) {
    assert.equal(g.rows.length, HEIGHT, ch);
    assert.ok(g.w >= 1 && g.w <= 7, `${ch} is ${g.w} wide`);
    for (const row of g.rows) assert.ok(row < 1 << g.w, `${ch} overflows its width`);
    if (ch !== " ")
      assert.ok(
        g.rows.some((r) => r),
        `${ch} is blank`,
      );
  }
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?'\"-+/()&*%#=<>_|~ []") assert.ok(GLYPHS[ch], ch);
});

test("figures are all one width, so columns of numbers line up; letters take their own", () => {
  const widths = new Set([..."0123456789"].map((d) => GLYPHS[d].w));
  assert.equal(widths.size, 1);
  assert.ok(GLYPHS.I.w < GLYPHS.O.w && GLYPHS.O.w < GLYPHS.M.w);
  assert.equal(textWidth("IM"), GLYPHS.I.w + GAP + GLYPHS.M.w);
  assert.equal(textWidth("im"), textWidth("IM"), "small letters are drawn as capitals");
  assert.equal(textWidth("AB", 2), textWidth("AB") * 2);
  assert.equal(textWidth(""), 0);
});

test("ordinary sentences take about the room the old six-pixel letters did, and wrapping fits the box", () => {
  const line = "WOAKESLEY IN FROM THE MEMBERS END -- A GOOD AREA, FOURTH STUMP -- INSIDE EDGE ONTO THE PAD";
  const was = line.length * 6 - 1;
  assert.ok(Math.abs(textWidth(line) - was) < was * 0.08, `${textWidth(line)} against ${was}`);
  const lines = wrapText(line, 30);
  assert.ok(lines.length >= 3 && lines.every((l) => textWidth(l) <= 30 * 6));
  assert.equal(lines.join(" "), line);
});

test("the field font: capitals and figures seven rows tall, measured and wrapped in its own widths", async () => {
  const { FIELD_GLYPHS } = await import("../src/engine/font-field.js");
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
    const g = FIELD_GLYPHS[ch];
    assert.ok(g && g.rows.length === HEIGHT && g.rows.some((r) => r), ch);
    for (const row of g.rows) assert.ok(row < 1 << g.w, `${ch} overflows its width`);
  }
  assert.equal(new Set([..."0123456789"].map((d) => FIELD_GLYPHS[d].w)).size, 1);
  assert.equal(textWidth("OK", 1, "field"), FIELD_GLYPHS.O.w + GAP + FIELD_GLYPHS.K.w);
  assert.equal(textWidth("ok", 1, "field"), textWidth("OK", 1, "field"));
  // A symbol it hasn't its own of comes from the text font.
  assert.equal(textWidth("!", 1, "field"), textWidth("!"));
  const lines = wrapText("BOWLING, BIG FELLA! HE HAD NO IDEA ABOUT THAT ONE", 28, "field");
  assert.ok(lines.length >= 2 && lines.every((l) => textWidth(l, 1, "field") <= 28 * 6));
});
