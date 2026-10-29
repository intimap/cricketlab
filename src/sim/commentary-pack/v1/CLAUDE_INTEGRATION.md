# Integrate Cricket Lab commentary pack 1.0

## Task

Integrate the three JSON content banks in this folder into Cricket Lab's commentary. Keep the change focused on text selection and its final display. Follow the repository's applicable instructions and work on a feature branch. Leave the result ready for the owner's play-test and review.

This pack was authored against `intimap/cricketlab`, branch `main`, commit `d2f773a7761345e58fa58cd77e5b2c581c97573e` (inspected 30 October 2026 in Melbourne). Re-read the current code first. If field meanings have changed, update an adapter and report the difference; do not silently reinterpret the content conditions.

## Read these files

- `src/sim/match.js`: `finish()` builds the completed `rec` and attaches `moment`, `commentary` and `call`.
- `src/sim/commentary.js`: existing stock calls, match memory and selection.
- `src/sim/describe.js`: existing composable descriptions, currently limited to certain middle contacts.
- `src/sim/commentators.js`: `boothCall()` currently replaces many detailed descriptions with short reactions.
- `src/scenes/match.js`: `callFromBooth()` and the scheduling path used by the actual screen.
- `src/render/booth.js`: layout and reading time; keep the existing rendering model.
- This pack's `field_mapping.json`, `schema.json`, `examples.json` and `tools/reference_matcher.mjs`.

## Content contract

`ball_calls` entries are primary factual descriptions. `speaker: neutral` is a content role, not a fourth commentator: the on-duty commentator can speak the chosen line. `commentator_lines` are optional personality reactions. `match_context` supplies optional follow-ups for existing `rec.moment.kind` events. The IDs `bunnings`, `lorry` and `grog` match the repository's existing speakers.

All entries have stable `id`, `category`, `speaker`, `requires`, `text`, `repeat_group`, `weight`, `priority` and `cooldown_balls` fields. Categories in this pack are routing labels; they are not necessarily names of the old LINES arrays. Never append all strings to an old array while dropping their predicates.

### Match conditions

- `requires` is a map from a dotted path to a condition. All conditions must be true.
- The roots are `rec` (the completed ball record) and `facts` (documented pure adapter values).
- A scalar is strict equality. Explicit JSON null is different from an absent field. A missing path always fails, even for `not_in` or `truthy: false`.
- An operator object supports `in`, `not_in`, `gte`, `gt`, `lte`, `lt` and `truthy`. All operators in the object must pass. Comparisons require finite numbers; do not coerce strings or null to numbers.
- `in` and `not_in` compare primitive values strictly. `truthy` uses JavaScript Boolean(value) on an existing field.
- The only derived fact required by v1 is `facts.swing_abs_m`. Set it to `Math.abs(rec.movement.swing)` only when that source is a finite number; otherwise leave it absent.
- Treat JSON as data. Do not evaluate strings as code.

### Placeholders

The supported tokens are `{b}`, `{w}`, `{f}`, `{r}`, `{s}`, `{n}` and `{k}`. Their exact meanings are in `field_mapping.json`.

Resolve player names using the recorded striker/bowler/wicket indices, not whichever batter is now on strike after scoring. For a run-out, the dismissed batter may be the non-striker. Snapshot names before starting another innings or scene. Existing fielder values are commonly position/role labels; do not replace them with a guessed player identity.

Retain numeric zero: a dropped batter can be on 0. A missing required placeholder makes that template ineligible. Reject unresolved tokens. The context number `n` means different things in different moments; for a fifty/hundred it currently counts balls in the source detector, not the milestone score. The supplied milestone lines deliberately do not quote it.

### Selection and repetition

1. Filter to entries matching the requested bank, speaker and every predicate, with all placeholders renderable.
2. Pick the highest matching `priority`. This favours a specific edge result or shot label over a generic score description.
3. Within that tier, prefer IDs not used within their `cooldown_balls`. Track delivered balls, including illegal deliveries, as the commentary counter.
4. Prefer repeat groups absent from the last four selections for that bank. Groups intentionally span speakers so changing voice does not reset a familiar idea.
5. Choose using `weight` and a presentation-only random generator.
6. For a mandatory primary call only, if every matching line is on cooldown, relax that line cooldown and use the least recently used candidate. Relaxing wording freshness must never relax facts or priority.
7. For an optional reaction/context line, exhausted cooldown means skip it. Pass `allowCooldownRelaxation: false` if adopting the reference selector.
8. Record history once, after the line is actually scheduled. Do not consume history for rejected candidates or repeated draw calls. Reset at a new match; retain through an innings change.

The reference matcher illustrates these rules and has no link to the game. Adapt it to the existing architecture rather than treating it as a replacement engine module.

## Connect the actual output

- Preserve `rec.call` and the score bar's concise factual summary, including precise runs/extras. This first pack has short event-only extras/drop lines, so that summary remains necessary.
- For the commentary box, use a matching primary `ball_calls` entry when available. If none matches, use the existing factual `rec.call` or an equally factual fallback. Do not force an approximate match.
- Let the duty commentator speak the primary line. Prevent the old `boothCall()` branches from immediately discarding it for a generic boundary/wicket reaction.
- When a supported `rec.moment` is present, a matching context line may be the second scheduled call. It adds the milestone or pressure story while the first line retains what happened on the ball.
- Without a context line, occasionally append a personality reaction. Start around 15 percent of eligible balls and tune for reading time. Do not attach a reaction automatically to every ball.
- Keep at most two scheduled messages from this path. Preserve the existing between-over chat/jokes, with one combined scheduling limit so chat cannot stack behind two ball calls.
- Reuse existing wrapping, uppercase conversion and duration rules. If a long player name makes a candidate too long, prefer a shorter matching line; avoid cutting off the result or introducing new UI.
- Avoid duplicate old moment/reaction calls after a pack line has already covered that role. Preserve existing unsupported moments as fallbacks; this pack does not cover them all.

## Scope and accuracy

No changes to ball physics, batting balance, AI decisions, scoring rules, controls or graphical assets are needed. Add no runtime dependency, external AI call or build step. Keep result-affecting `match.rng` completely separate from presentation selection. `MomentTracker` must still be read once per delivered ball, before scoring, as the existing model expects.

All v1 active predicates use existing ball-record facts plus one numerical adapter. The shot catalogue is descriptive and does not add moves. Precise slip passing points, dives, direct hits and running mix-ups are deferred: the current simulation has some useful events, but they need a deliberate, documented summary before lines can assert them.

Dropped-wicket language is explicitly disabled on no-balls and free hits. A zero-run edge does not prove the ball fell short. A maiden does not prove six team dot balls. A single does not guarantee that the partner faces next when the over ends. Preserve these restrictions.

## Acceptance checks

1. Run `node tools/validate.mjs` from the content folder and any appropriate repository checks. Do not modify gameplay merely to make a template eligible.
2. Run `node tools/check_repo.mjs /absolute/path/to/cricketlab` for an offline probe. Its transcript is a candidate output example, not proof the actual box uses the new banks.
3. After wiring, exercise the final `boothCall()` / scheduling path. Cover leaves, blocks, one/two/three, edges for zero/one/two/four, misses, boundaries, caught/bowled, extras, drops, pad contacts and milestones.
4. Confirm a detailed primary line survives the personality layer. Confirm the result and text agree; no unresolved placeholders, invented positions or invalid missed-wicket claims on no-balls/free hits.
5. Compare the same seeded simulation with commentary content enabled and disabled. Ball outcomes, scores, wickets and match RNG state must be identical.
6. Check long display names and ordinary long passages for repetition and reading time. Check the actual game according to the repository's play-test instructions before merging.

Report counts loaded, fallback and repeat behaviour, exact checks run, and any unsupported events. Do not claim that offline data checks verify the browser UI. This archive does not itself modify, merge or deploy the game.
