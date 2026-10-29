# Cricket Lab

16-bit browser cricket game. Plain JS ES modules, no build step, no game dependencies
(`package.json` is only for the Netlify score function).

**Code map:** README.md, "How the code is organised" and "Where to start for common changes". Read that
section instead of exploring the tree. Keep it up to date when you add or move a file.

## Rules
- `sim/` never draws, `engine/` knows nothing about cricket, and `scenes/` connects them.
- Units are metres, with the striker's stumps at the origin and `z = 20.12` at the bowler's end
  (see `sim/geometry.js`).
- Anything that affects the result uses the match's `Rng` (`sim/rng.js`). `Math.random()` is only for
  presentation (commentary picks, effects, sound), so it never disturbs the match's dice. `moments.js` stays
  deterministic.
- `src/assets.js` must keep the exact `"id": new URL(...)` form, because `tools/build-single.py` rewrites it.
- Prettier with `printWidth: 130`. Match the surrounding comment style: short plain-English comments explaining why.
- Don't add dependencies or a build step.

## Checking a change
- **Balance or sim changes:** run `node tools/sim-report.mjs` before and after, and quote the AI-vs-AI runs per
  over (e.g. "4.59 -> 4.33 rpo") in the commit.
- **Syntax:** `node --check <file>` on the files you touched.
- **Browser play-test** (`python3 -m http.server 8000` + Playwright screenshots): only when I ask, or when
  the change is visual. It's slow and costly.
  - **Play-test build:** after every change, run
  `python3 tools/build-single.py /tmp/cricketlab.html --stamp` and publish it as the claude.ai artifact
  "Cricket Lab (test)", updating the same artifact each time and keeping the `db` capability. Put the link and
  the build stamp in your reply. Commit it as `WIP (for testing, not merged): <feature>` and don't merge until I say it plays right.

## Git workflow
- Work on a branch, then merge to `main` with `--no-ff`. Merge message: `Merge <feature in plain words>`.
- A commit I'm play-testing before merging: `WIP (for testing, not merged): <feature>`.
- Commit subject: what the player notices, with before/after numbers where relevant
  (e.g. "High-effort bowling costs more stamina (2.6x medium, was 1.6x)").
  Body: what changed for the player, then the balance impact.
- Add `[skip netlify]` to the merge message when I don't want a deploy yet.
- Update the README's controls table when keys change.

## How I work
- I give specific asks. Don't widen scope, refactor, or "improve" nearby code unless I ask.
- If an ask is ambiguous or a big change, give a short plan first and wait for my answer.
- Keep replies short: what changed, the numbers, and anything I need to decide.
