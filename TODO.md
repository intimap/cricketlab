# Roadmap

Agreed in a design review (November 2026). Streams run in this order; each is **High** usage (see CLAUDE.md)
unless marked, so each waits for a go-ahead before it starts. Decisions are recorded so later sessions work
from them rather than re-asking.

## What the game is

- A pub arcade game that also stands alone on desktop and mobile. Multiplayer is a later layer on top.
- Realistic sim, arcade presentation: the cricket should feel like cricket; the banners, juice and booth sell it.
- Keyboard first. Touch, joystick and arcade buttons come later; controls can be designed freely for now.
- Runs smoothly on a 2022 MacBook Air, an iPhone 14 and a **Raspberry Pi 5** (the budget-setter).
- Real names for now; go fully fictional (grounds, teams, players, booth) before any pub install. No licensed fonts.

## 0. Cleanup (done, branch `stream0-cleanup`)

- Split the files over 400 lines: `sim/batting.js`, `scenes/match.js`, `render/ground.js`, `render/figures.js`,
  `scenes/match-view.js`, `sim/ball-in-play.js` (re-export from the originals).
- Fix `tools/bat-impact.test.mjs` for the 0.046 m ball, so `npm test` is green again.
- README: drop the promised weakness hints (they return with stream 5), refresh the code map.
- Shrink the MCG stadium image (2.8 MB of the 4.1 MB assets).
- Rule: every player decision goes through one small interface, so replays, tests and a later network layer
  carry the same messages. Built as **player actions** (`scenes/player-actions.js`), since "intent" already
  means a delivery's plan; the rule is in CLAUDE.md.

## 1. The HD-2D look

- Pixel players and grounds with modern light on top, at 640x360.
- First: time-of-day grading, sun-direction shadows (players, stumps), floodlight bloom at night. Later: animated
  crowd. Not planned: depth of field, weather.
- Every effect is cheap or pre-baked per time of day and can be switched off; check against a Pi 5 budget.
- Art: Claude builds templates and generators; the user supplies hero art (stadiums, scenery).

## 2. The batter rebuild

- Problems to fix: stiff with no weight transfer, strokes don't read, proportions and silhouette, transitions
  that snap.
- Keep the 3D skeleton and IK (one rig, both views, 28 strokes); draw it as pixel art at sprite size (palette,
  1px outline) instead of smooth limbs. Grow into drawn parts placed on the rig (paper-doll) where that helps.
- Re-author all 28 strokes from biomechanics, reviewed on frame sheets. Reference stills from the user later,
  for the strokes that still look wrong.
- Skins as data, a small JSON entry each: team (kit colours, helmet, pads, bat stickers, sponsor patch) and
  player (skin, hair, beard, height, build, extras). Signature stances later.
- A mirror flag for left-handers in the rig (the sim side is stream 4).

## 3. Fielding

- Make keeper and outfield catches happen (6 keeper chances and no outfield catches in 60 AI innings).
- Spectacle: visible dives and stops, direct hits, relays you can follow.
- Optional presses when bowling, the AI acting if you don't: catch timing (a good press helps, a bad one
  hurts), throw choice (striker's or bowler's end), direct-hit aim on a run-out.
- Fielder character from the existing ratings: commentary, a name tag over whoever's involved, and fielding
  cards in the field editor.
- Riskier AI running, by format, by batter and by match situation (chasing late and behind the rate most of
  all). Targets, run-outs as a share of dismissals, AI vs AI: 40+ overs 4-5%, 20 overs 6-8%, 10 overs 8-10%;
  nervous runners about half that, cavalier ones about 1.5x.

## 4. Left-handers in the sim

- Mirror geometry, field placings, shot areas, the LBW line, wides and the commentary's off/leg words.
  Checked with `sim-report`.

## 5. Commentary and GUI

- Commentary adds value three ways: gameplay information, drama, personality.
- What it reveals (a weakness, a plan, why the field moved) also flashes as a short tag on screen, e.g. LOOSE
  OUTSIDE OFF on the batter's card.
- A readability pass on the GUI and HUD. Text size stays as it is for now.

## Later

- Fictional names and art before any pub install.
- Cabinet: attract mode, credits, a quick pub-match format, joystick and buttons.
- Better touch controls; multiplayer; signature stances; DualShock 4 support.

## Not applicable to the game (yet)

Sessions and days, drinks breaks, rain and DLS, declarations and the follow-on, net run rate, venue records and
career stats: the game has none of these to talk about.
