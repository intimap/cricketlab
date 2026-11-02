# Cricket Lab

16-bit browser cricket game. Plain JS ES modules, no build step, no game dependencies
(`package.json` is only for the Netlify score function).

**Code map:** README.md, "How the code is organised" and "Where to start for common changes". Read that
section instead of exploring the tree. Keep it up to date when you add or move a file.

## Usage estimate (before starting)
Before changing anything, give one line: **Low / Medium / High**, and what drives it (files to read, checks
to run). For **High**, wait for my go-ahead.
- **Low:** one or two modules found from the code map, a small edit (a constant, text, colour, a single rule);
  `node --check` and the play-test build.
- **Medium:** one feature in one area (3–6 files), or one round of balance tuning with `sim-report`, or a visual
  change checked with one or two screenshots; plus the play-test build.
- **High:** work across `sim/`, `render/` and `scenes/`, new art, refactors, tuning towards several targets,
  outside packs, or anything needing browser play-throughs, seeded replays or debugging scripts.

Keep it lean: go straight to the module the code map names; prefer `npm test` and `sim-report` over the
browser; stop tuning at the first result inside the targets. "Syntax only", "no browser" or "no test build"
from me narrows the checks to exactly that.

## Layers
- `sim/`: maths, physics and match state. It imports nothing from canvas, DOM or audio.
- `render/`: drawing from coordinates and state it's given. Rules, physics and state changes live in `sim/`.
- `scenes/`: light orchestration, wiring input and sim state to the renderers.
- `engine/`: general utilities (screen, text, input, touch), with no cricket in it.
- **The dice:** anything that affects the result uses the match's `Rng` (`sim/rng.js`). `Math.random()` is for
  presentation only (commentary picks, effects, sound). `moments.js` stays deterministic.
- Units are metres, with the striker's stumps at the origin and `z = 20.12` at the bowler's end (`sim/geometry.js`).

## Modules
- Target 250–400 lines per file.
- A new mechanic gets its own modules: `sim/<feature>.js` for rules, `render/<feature>.js` for drawing.
  `scenes/match.js`, `scenes/match-view.js` and `render/sprites.js` only import and call them.
- When extracting from a file, re-export from the original so existing callers and test scripts keep working.
- Prefer pure functions (`lerpPose`, `blendRigs`) to class hierarchies.
- `src/assets.js` keeps the exact `"id": new URL(...)` form: `tools/build-single.py` rewrites it.
- Plain ES modules with no dependencies, so the code stays compatible with `tools/build-single.py`.
- Prettier with `printWidth: 130`. Comments are short and plain-English, explaining why.

## Animation
- Limbs respect anatomy: elbow hinge vectors and soft limits on extension, so nothing snaps, hyperextends or flips.
- Reaches follow the kinetic chain: head and spine lead and shift the weight, then the limbs extend.

## Checking a change
- **Tests:** `npm test`.
- **Syntax:** `node --check <file>` on the files you touched.
- **Sim or balance changes:** run `node tools/sim-report.mjs` before and after, and quote the AI-vs-AI runs per
  over (e.g. "4.59 -> 4.33 rpo") in the commit.
- **Play-test build** (every code change): `python3 tools/build-single.py /tmp/cricketlab.html --stamp --ref <branch>`,
  published to the claude.ai artifact "Cricket Lab (test)" (same artifact each time, keep the `db` capability).
  Put the link and the build stamp in your reply.
- **Browser play-test** (`python3 -m http.server 8000` + Playwright screenshots): for visual changes, or when I ask.

## Git workflow
- Work on a branch. Commit for play-testing as `WIP (for testing, not merged): <feature>`.
- When I say "merge", merge to `main` with `--no-ff` and the message `Merge <feature in plain words>`, adding
  `[skip netlify]` when I don't want a deploy yet.
- Commit subject: what the player notices, with before/after numbers where relevant
  (e.g. "High-effort bowling costs more stamina (2.6x medium, was 1.6x)").
  Body: what changed for the player, then the balance impact.
- When keys change, update the README's controls table.
