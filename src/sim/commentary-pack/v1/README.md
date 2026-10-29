# Cricket Lab commentary pack 1.0

First content batch for the Cricket Lab repository. The pack has 514 original templates: 328 factual ball calls across 41 categories, 96 optional reactions across the three existing commentators, and 90 contextual lines for 10 existing match moments.

The main focus is the everyday cricket: leaves, blocks, singles, edges and misses. There are also starter sets for boundaries, catches, bowled dismissals and extras. This is the first batch, not an exhaustive cricket commentary corpus.

## Use it with Claude Code

1. Extract this folder into your repository, for example as `commentary-content/v1/`.
2. Ask Claude Code to read `CLAUDE_INTEGRATION.md` and the repository's current `CLAUDE.md` or `AGENTS.md`, then integrate this pack on a feature branch.
3. Review its sample transcripts and play-test the resulting game before merging.

The JSON is authored content plus selection metadata. The current game does not automatically load it. Claude needs to add a small adapter and connect the final commentary box. The standalone reference and checks here help specify that work; no game files are replaced by this archive.

## Files

| File | Purpose |
| --- | --- |
| `ball_calls.json` | Factual calls. `neutral` means usable by whichever commentator is on duty. |
| `commentator_lines.json` | Optional Bunnings, Lorry and Grog reactions after a factual call. |
| `match_context.json` | Optional event-specific lines using the existing MomentTracker output. |
| `field_mapping.json` | Exact fields, placeholder meanings and limits of the source data. |
| `shot_vocabulary.json` | Existing attempted shot families and realised shot labels; not new gameplay moves. |
| `schema.json` | JSON Schema for all three banks. |
| `examples.json` | Positive and negative synthetic ball fixtures. |
| `READABLE_COMMENTARY.md` | All templates in an easy-to-review form. |
| `CLAUDE_INTEGRATION.md` | Integration instructions and acceptance checks. |
| `tools/reference_matcher.mjs` | Standalone reference for matching, filling tokens and choosing fresh lines. |
| `tools/validate.mjs` | Dependency-free structure, predicate, coverage and fixture checks. |
| `tools/check_repo.mjs` | Optional probe against an existing checkout's simulation. |
| `QA_REPORT.json` | Results from the included checks, before game integration. |
| `SAMPLE_TRANSCRIPT.md` | Offline candidate calls from simulated balls; not a browser play-test. |
| `manifest.json` | Counts, source snapshot, version and checksums. |

## Validation

From this folder run `node tools/validate.mjs`.

With a Cricket Lab checkout available, run `node tools/check_repo.mjs /absolute/path/to/cricketlab`.

These tools use only Node built-ins and the checked-out simulation. They do not install packages or alter the repository.

## Expand the next batch

Keep existing IDs and their meanings. Give additions new IDs; never recycle retired IDs. Increase the pack version, preserve schema version unless the contract changes, and update examples and counts. Do not turn an existing specific statement into an unconditional line.

Suggested next batches: shot-specific outcomes across the full vocabulary; confirmed fielding events; tactical callbacks; and more between-over conversations. Exact fielder-passing points and dive descriptions need genuine event/path evidence before they become eligible.
