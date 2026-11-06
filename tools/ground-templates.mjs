// Templates for painting over a ground built from a map (tools/sheets/ground-templates.html): each view and
// end's layers as PNGs with a guide each, a manifest with the fingerprints, and how to put a painted one in.
//   python3 -m http.server 8000   (from the repo), then: node tools/ground-templates.mjs <out dir> [ground]
import fs from "node:fs";
import { createRequire } from "node:module";

// The machine's own Playwright (not a project dependency).
const { chromium } = createRequire(import.meta.url)("playwright");

const out = process.argv[2];
const ground = process.argv[3] ?? "parklands";
if (!out) throw new Error("usage: node tools/ground-templates.mjs <out dir> [ground]");
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error(e));
await page.goto(`http://localhost:8000/tools/sheets/ground-templates.html?ground=${ground}`);
await page.waitForFunction(() => document.title === "ready", null, { timeout: 120000 });
const t = await page.evaluate(() => window.templates);
await browser.close();
const dir = `${out}/${ground}`;
fs.mkdirSync(dir, { recursive: true });
for (const [name, url] of Object.entries(t.files)) fs.writeFileSync(`${dir}/${name}`, Buffer.from(url.split(",")[1], "base64"));
fs.writeFileSync(
  `${dir}/manifest.json`,
  JSON.stringify({ ground: t.ground, map: t.map, views: t.views, layers: Object.keys(t.files) }, null, 2),
);
const id = t.map.toLowerCase().split(" ")[0];
fs.writeFileSync(
  `${dir}/PAINTING.txt`,
  `Painting over ${t.map} (${t.ground})

Each file is one layer of one view, as the game draws it at midday: <view>-<end>-<layer>.png.
  views   close (640x360: the top 24 rows are above the screen), wide (1280x720, the whole ground at 2x),
          near (the middle of the wide view at 3x, for zooming in on the square)
  ends    0: looking at (or bowling from) the ${t.ends[0]}; 1: the ${t.ends[1]}
  layers  sky, trees, ground (past the fence), buildings, crowd, fence
The guides show what's off screen, the horizon, the rope (yellow) and fence (white), and the panels that
cover the picture (red). Paint in midday light; the game relights it for the afternoon, evening and night.
Keep to the layer's shapes: the game keeps its own depth and lighting for each pixel.

To put a painted layer in (it can be any size, painted over the template or generated from it):
  node tools/fit-painted.mjs <your image> <view>-<end>-<layer> --ground ${t.ground} --install
It scales it to the layer, cuts it to the layer's shape, fills any holes from the drawn layer, snaps the
colours to a palette (--colours n, --ground-palette, --no-palette), writes a before-and-after preview, and
puts it in (assets/venues/, src/assets.js and the map's painted list, with the fingerprint below). Leave
off --install to look at the preview first; --remove <layer> takes one out again. npm test checks it fits
the map and that the painted layers stay under 500 KB.
If the map changes, the fingerprints change: a layer painted before then is left out until repainted.

Fingerprints: ${Object.entries(t.views)
    .map(([v, x]) => `${v} ${x.fingerprint}`)
    .join(", ")}
`,
);
console.log(`${Object.keys(t.files).length} files in ${dir}`);
