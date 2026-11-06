// The fit tool's pixel work (tools/fit-core.mjs): paint cut to the layer's shape, holes filled from the drawn
// layer, colours snapped to a palette, and the palette itself.
import test from "node:test";
import assert from "node:assert/strict";
import { fitLayer, paletteOf, nearest } from "./fit-core.mjs";

const px = (...list) => new Uint8ClampedArray(list.flat());

test("paint is cut to the layer's shape, holes are filled from the drawn layer, the sky only when loose", () => {
  // Four pixels: the layer's (0, 1), another layer's (2), sky (3).
  const drawn = px([10, 10, 10, 255], [20, 20, 20, 255], [30, 30, 30, 255], [0, 0, 0, 0]);
  const layer = new Uint8Array([4, 4, 2, 0]);
  // Paint on the first, a hole over the second, paint over the other layer and the sky.
  const image = px([200, 0, 0, 255], [0, 0, 0, 0], [0, 200, 0, 255], [0, 0, 200, 255]);
  const fit = fitLayer({ w: 4, h: 1, image, drawn, layer, index: 4 });
  assert.deepEqual(Array.from(fit.rgba), [200, 0, 0, 255, 20, 20, 20, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(fit.stats, { shape: 2, painted: 1, filled: 1, cut: 2, colours: 1 });
  const loose = fitLayer({ w: 4, h: 1, image, drawn, layer, index: 4, loose: true });
  assert.deepEqual(Array.from(loose.rgba.slice(12)), [0, 0, 200, 255], "over the sky when loose");
  assert.equal(loose.stats.cut, 1, "never over another layer");
});

test("colours snap to the palette; the palette finds the image's own colours", () => {
  const two = [
    [250, 0, 0],
    [0, 0, 250],
  ];
  assert.deepEqual(nearest(two, 200, 30, 20), [250, 0, 0]);
  const image = px([240, 10, 5, 255], [10, 5, 240, 255]);
  const drawn = px([1, 1, 1, 255], [1, 1, 1, 255]);
  const fit = fitLayer({ w: 2, h: 1, image, drawn, layer: new Uint8Array([3, 3]), index: 3, palette: two });
  assert.deepEqual(Array.from(fit.rgba), [250, 0, 0, 255, 0, 0, 250, 255]);
  // Reds and blues, many shades of each: two colours back, one of each.
  const shades = [];
  for (let i = 0; i < 50; i++) shades.push([200 + (i % 10), 20, 20, 255], [20, 20, 200 + (i % 10), 255]);
  const palette = paletteOf(px(...shades), 2);
  assert.equal(palette.length, 2);
  assert.ok(palette.some((c) => c[0] > 190 && c[2] < 40) && palette.some((c) => c[2] > 190 && c[0] < 40));
  // Only the pixels asked for count.
  assert.deepEqual(paletteOf(px(...shades), 1, (i) => i % 2 === 1)[0][2] > 190, true);
});
