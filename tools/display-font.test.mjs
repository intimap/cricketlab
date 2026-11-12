import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, GLYPH_ROWS, SPACE_CELLS } from "../src/render/display-glyphs.js";
import { DISPLAY_PALETTES, displayHas, displaySize } from "../src/render/display-font.js";

test("display font: every glyph is 7 rows of one width, ink and gaps only, and no two are alike", () => {
  const seen = new Map();
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    assert.equal(rows.length, GLYPH_ROWS, ch);
    assert.ok(
      rows.every((r) => r.length === rows[0].length && /^[#.]+$/.test(r)),
      ch,
    );
    assert.ok(
      rows.some((r) => r.includes("#")),
      ch,
    );
    const key = rows.join("/");
    assert.ok(!seen.has(key), `${ch} looks like ${seen.get(key)}`);
    seen.set(key, ch);
  }
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") assert.ok(GLYPHS[ch], ch);
});

test("display font: the title and the announcements are all there, and sized in whole cells", () => {
  for (const text of ["BITWICKET", "FOUR!", "SIX!", "WICKET!", "LBW!", "OUT!", "OUT", "NOT OUT"])
    assert.ok(displayHas(text), text);
  assert.ok(displayHas("four!"), "lower case is drawn as capitals");
  assert.ok(!displayHas("FOUR#"));
  // FOUR!: F, O, U, R (6 each), ! (2), four gaps, and the outline's cell either side; 7 rows plus outline and shadow.
  assert.deepEqual(displaySize("FOUR!", 3), { w: (6 * 4 + 2 + 4 + 2) * 3, h: (GLYPH_ROWS + 3) * 3 });
  assert.equal(displaySize("A A", 1).w - displaySize("AA", 1).w, SPACE_CELLS + 1);
  for (const [name, p] of Object.entries(DISPLAY_PALETTES))
    for (const part of ["top", "line", "low", "base", "edge"]) assert.match(p[part], /^#[0-9a-f]{6}$/, `${name}.${part}`);
});
