// Fit a painted (or generated) image to one layer of a ground built from a map, and optionally put it in.
//   node tools/fit-painted.mjs <image> <layer> [options]      e.g. painting.png close-0-buildings
//   node tools/fit-painted.mjs --remove <layer> [--ground parklands]
// The layer is <view>-<end>-<layer> as the templates name them (tools/ground-templates.mjs). The image can be
// any size (it's scaled to the layer's); paint outside the layer's shape is cut away, holes in it filled from
// the drawn layer, and the colours snapped to a palette. It writes <layer>.png and <layer>-preview.png (the
// view as drawn, then with the fitted layer in) to --out, and says how much of the paint fell outside.
//   --ground <id>       the ground (default parklands)
//   --colours <n>       snap to n colours of the image's own (default 32)
//   --ground-palette    snap to the view's drawn colours instead (sits closest to the code's art)
//   --no-palette        keep the image's colours as they are
//   --loose             let paint go over the sky too (a taller crown, a flag), not only the layer's shape
//   --out <dir>         where to write (default ./fitted)
//   --install           also save it into assets/, list it in src/assets.js and the map's painted list
// It serves the repo itself for the browser it uses (the machine's own Playwright).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const ground = option("--ground", "parklands");
const plain = args.filter((a, i) => !a.startsWith("--") && !["--ground", "--colours", "--out", "--remove"].includes(args[i - 1]));

const { GROUNDS } = await import(path.join(ROOT, "src/render/grounds.js"));
const { viewFingerprint } = await import(path.join(ROOT, "src/render/venue/venue-paint-over.js"));
const map = GROUNDS[ground]?.venue;
if (!map) throw new Error(`${ground} isn't a ground built from a map`);

/** The map's source file, its painted list rewritten (the map is plain data, so it's printed back as such). */
function writePainted(painted) {
  const dir = path.join(ROOT, "src/render/venue");
  const file = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith("-map.js"))
    .map((f) => path.join(dir, f))
    .find((f) => fs.readFileSync(f, "utf8").includes(`name: ${JSON.stringify(map.name)}`));
  if (!file) throw new Error(`no map file for ${map.name}`);
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf("painted: {");
  let depth = 0;
  let end = start + "painted: ".length;
  for (; end < text.length; end++) {
    if (text[end] === "{") depth++;
    if (text[end] === "}" && --depth === 0) break;
  }
  const body = Object.entries(painted)
    .map(
      ([key, e]) =>
        `    ${JSON.stringify(key)}: { asset: ${JSON.stringify(e.asset)}, fingerprint: ${JSON.stringify(e.fingerprint)} },`,
    )
    .join("\n");
  fs.writeFileSync(file, text.slice(0, start) + `painted: {${body ? `\n${body}\n  ` : ""}}` + text.slice(end + 1));
  return file;
}

/** Add or drop a painted layer's line in src/assets.js (its exact `"id": new URL(...)` form). */
function writeAsset(id, add) {
  const file = path.join(ROOT, "src/assets.js");
  let text = fs.readFileSync(file, "utf8");
  const line = `  ${JSON.stringify(id)}: new URL("../assets/${id}.png", import.meta.url),\n`;
  text = text.replace(line, "");
  if (add) {
    const close = text.indexOf("\n};", text.indexOf("export const ASSET_URLS = {"));
    text = text.slice(0, close + 1) + line + text.slice(close + 1);
  }
  fs.writeFileSync(file, text);
  return file;
}

const tidy = (files) => spawnSync("npx", ["prettier", "--write", ...files], { cwd: ROOT, stdio: "ignore" });

/** Painted layers' total size for the ground (the checks hold it under 500 KB). */
function paintedKB(painted) {
  let bytes = 0;
  for (const e of Object.values(painted)) {
    const f = path.join(ROOT, "assets", `${e.asset}.png`);
    if (fs.existsSync(f)) bytes += fs.statSync(f).size;
  }
  return Math.round(bytes / 1024);
}

if (flag("--remove")) {
  const key = option("--remove");
  const painted = { ...map.painted };
  const entry = painted[key];
  if (!entry) throw new Error(`${key} isn't painted`);
  delete painted[key];
  tidy([writePainted(painted), writeAsset(entry.asset, false)]);
  const file = path.join(ROOT, "assets", `${entry.asset}.png`);
  fs.rmSync(file, { force: true });
  // And the ground's folder, once it's empty.
  for (
    let dir = path.dirname(file);
    dir !== path.join(ROOT, "assets") && fs.readdirSync(dir).length === 0;
    dir = path.dirname(dir)
  )
    fs.rmdirSync(dir);
  console.log(`removed ${key}: ${paintedKB(painted)} KB of painted layers left`);
  process.exit(0);
}

const [image, key] = plain;
if (!image || !key) throw new Error("usage: node tools/fit-painted.mjs <image> <layer> [--install] (see the top of the file)");
const out = option("--out", "fitted");
const type = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".json": "application/json",
};
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": type[path.extname(file)] ?? "application/octet-stream" }).end(fs.readFileSync(file));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
let r;
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error(e));
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/sheets/fit-painted.html`);
  await page.waitForFunction(() => document.title === "ready");
  const ext = path.extname(image).slice(1).toLowerCase().replace("jpg", "jpeg");
  const url = `data:image/${ext};base64,${fs.readFileSync(image).toString("base64")}`;
  const palette = flag("--no-palette") ? "none" : flag("--ground-palette") ? "ground" : "own";
  r = await page.evaluate(
    ([u, k, o]) => window.fitFor(u, k, o),
    [url, key, { ground, palette, colours: Number(option("--colours", 32)), loose: flag("--loose") }],
  );
} finally {
  await browser.close();
  server.close();
}
fs.mkdirSync(out, { recursive: true });
const save = (name, data) => fs.writeFileSync(path.join(out, name), Buffer.from(data.split(",")[1], "base64"));
save(`${key}.png`, r.png);
save(`${key}-preview.png`, r.preview);
const s = r.stats;
const pct = (n) => `${Math.round((100 * n) / Math.max(1, s.shape))}%`;
console.log(`${key}: ${r.source.join("x")} fitted to ${r.size.join("x")}, ${s.colours} colours`);
console.log(`  of the layer's ${s.shape} px: ${pct(s.painted)} painted, ${pct(s.filled)} filled from the drawn layer`);
console.log(
  `  ${s.cut} px of paint fell outside the shape and were cut${s.cut > s.shape * 0.1 ? " (a lot: is it lined up with the template?)" : ""}`,
);
console.log(`  wrote ${path.join(out, `${key}.png`)} and ${key}-preview.png`);
if (flag("--install")) {
  const asset = `venues/${ground}/${key}`;
  const dest = path.join(ROOT, "assets", `${asset}.png`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(out, `${key}.png`), dest);
  const painted = { ...map.painted, [key]: { asset, fingerprint: viewFingerprint(map, key.split("-")[0]) } };
  tidy([writePainted(painted), writeAsset(asset, true)]);
  const kb = paintedKB(painted);
  console.log(
    `  put in: ${path.relative(ROOT, dest)}, listed in src/assets.js and the map (${kb} KB of painted layers; 500 KB at most)`,
  );
}
