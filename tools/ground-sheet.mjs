// A sheet of every view of a ground built from a map, at each time of day (tools/sheets/ground-sheet.html),
// and how long each light took to draw everything.
//   python3 -m http.server 8000   (from the repo), then:
//   node tools/ground-sheet.mjs [out dir] [ground] [ball: white|red] [weather: sunny|overcast|rain|...] [lights]
import { createRequire } from "node:module";

// The machine's own Playwright (not a project dependency).
const { chromium } = createRequire(import.meta.url)("playwright");

const out = process.argv[2] ?? ".";
const ground = process.argv[3] ?? "parklandsNew";
const ball = process.argv[4] ?? "white";
const weather = process.argv[5] ?? "sunny";
const lights = process.argv[6] ?? "midday,afternoon,evening,night";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 3200, height: 1600 } });
page.on("pageerror", (e) => console.error(e));
await page.goto(
  `http://localhost:8000/tools/sheets/ground-sheet.html?ground=${ground}&ball=${ball}&weather=${weather}&lights=${lights}`,
);
await page.waitForFunction(() => document.title === "ready", null, { timeout: 120000 });
const path = `${out}/ground-sheet-${ground}-${ball}-${weather}.png`;
await page.locator("#sheet").screenshot({ path });
console.log(path, JSON.stringify(await page.evaluate(() => window.venueTimes)), "ms to draw each light's views");
await browser.close();
