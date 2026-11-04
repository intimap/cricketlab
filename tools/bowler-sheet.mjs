// Frame sheets of the bowler's action, from both ends, for reviewing it (render/bowler/).
//   python3 -m http.server 8000   (from the repo), then: node tools/bowler-sheet.mjs [out dir] [ppm]
import { createRequire } from "node:module";

// The machine's own Playwright (not a project dependency).
const { chromium } = createRequire(import.meta.url)("playwright");

const out = process.argv[2] ?? ".";
const ppm = process.argv[3] ?? 44;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1104, height: 640 } });
page.on("pageerror", (e) => console.error(e));
for (const end of ["striker", "bowler"]) {
  await page.goto(`http://localhost:8000/tools/sheets/bowler-sheet.html?end=${end}&ppm=${ppm}`);
  await page.waitForFunction(() => document.title === "ready");
  await page.locator("#sheet").screenshot({ path: `${out}/bowler-${end}.png` });
  console.log(`${out}/bowler-${end}.png`);
}
await browser.close();
