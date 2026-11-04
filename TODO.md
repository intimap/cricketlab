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

## 1. The HD-2D look (first pass done, branch `stream1-look`)

- Pixel players and grounds with modern light on top, at 640x360.
- First: time-of-day grading, sun-direction shadows (players, stumps), floodlight bloom at night. Later: animated
  crowd. Not planned: depth of field, weather.
- Every effect is cheap or pre-baked per time of day and can be switched off; check against a Pi 5 budget.
- Art: Claude builds templates and generators; the user supplies hero art (stadiums, scenery).
- Done: per-time grading, dusk and night skies (stars), dimmed scenery, floodlight glow from `lamps` on the art
  layers, cast silhouette shadows in the close view and sun-leaning shadows in the wide view, and the EFFECTS
  setting (AUTO steps down to SIMPLE when the first seconds draw slowly).
- Still to come: an MCG night painting (hero art: the day painting is relit by colour for now), check the look on
  the Pi 5, the animated crowd, and the ground-art templates and generators for new fictional grounds.

## 2. The batter rebuild (first pass done, branch `stream2-batter`)

- Problems to fix: stiff with no weight transfer, strokes don't read, proportions and silhouette, transitions
  that snap.
- Keep the 3D skeleton and IK (one rig, both views, 28 strokes); draw it as pixel art at sprite size (palette,
  1px outline) instead of smooth limbs. Grow into drawn parts placed on the rig (paper-doll) where that helps.
- Re-author all 28 strokes from biomechanics, reviewed on frame sheets. Reference stills from the user later,
  for the strokes that still look wrong.
- Skins as data, a small JSON entry each: team (kit colours, helmet, pads, bat stickers, sponsor patch) and
  player (skin, hair, beard, height, build, extras). Signature stances later.
- A mirror flag for left-handers in the rig (the sim side is stream 4).
- Done: keyframes on smooth curves (speed carried through contact), S-curve blends in and out of the stance,
  `tools/batter-snaps.mjs` and a test against jolts, the body sinking into strokes, a pixel-art outline on the
  striker, `render/skins.js` (team grip, glove trim, pads; player build; the left-hander mirror).
- Still to come: proportions and silhouette (needs your eye on frame sheets), the reverse sweep and scoop (their
  bat turns back at contact: which way round should it go?), drawn parts on the rig, more team skins.

## 3. Fielding (first pass done, branch `stream3-fielding`)

- Make keeper and outfield catches happen (6 keeper chances and no outfield catches in 60 AI innings).
- Spectacle: visible dives and stops, direct hits, relays you can follow.
- Optional presses when bowling, the AI acting if you don't: catch timing (a good press helps, a bad one
  hurts), throw choice (striker's or bowler's end), direct-hit aim on a run-out.
- Fielder character from the existing ratings: commentary, a name tag over whoever's involved, and fielding
  cards in the field editor.
- Done: edges carry (keeper catch chances 13 -> 76 per 30 innings), riskier AI running inside every run-out
  target, the catch press and throw call (`sim/fielding-calls.js`), name tags over the fielder involved.
- Still to come: outfield catches (skied shots are still rare: 53 in 30 innings), the direct-hit aim, fielding
  cards in the field editor, commentary on fielders' arms and hands, visible dives and relays; and the batting
  is more fragile now catches carry (36.9 balls per wicket, was 41.8): worth a look.
- Riskier AI running, by format, by batter and by match situation (chasing late and behind the rate most of
  all). Targets, run-outs as a share of dismissals, AI vs AI: 40+ overs 4-5%, 20 overs 6-8%, 10 overs 8-10%;
  nervous runners about half that, cavalier ones about 1.5x.

## 4. Left-handers in the sim (done, branch `stream4-lefthanders`)

- Mirror geometry, field placings, shot areas, the LBW line, wides and the commentary's off/leg words.
  Checked with `sim-report`.
- Done: six left-handers in the two XIs; the sim works in the striker's frame and a delivery is mirrored into
  it (a right-armer's outswinger comes into a left-hander, an off-break turns away); the computer's spinners
  aim off for the turn; the field crosses over; the camera mirrors it all back. Still to come: the field
  crossing over visibly between balls, around-the-wicket choices against left-handers, commentary on it.

## 5. Commentary and GUI (first pass done, branch `stream5-commentary`)

- Commentary adds value three ways: gameplay information, drama, personality.
- What it reveals (a weakness, a plan, why the field moved) also flashes as a short tag on screen, e.g. LOOSE
  OUTSIDE OFF on the batter's card.
- A readability pass on the GUI and HUD. Text size stays as it is for now.
- Done: scouting (`sim/scouting.js`): a hint, then the weakness given away and tagged under the batter's panel
  when bowling; batting, the box reads the computer's plan for each new over with a READ: tag on screen; the
  partnership is labelled STAND. Still to come: drama and personality beyond the existing banks, more of the GUI
  pass (the bottom ticker, the bowling setup panel), commentary on fielders and left-handers.

## Tests and weather (first pass done, branch `test-weather`)

- Done: five-day Tests (90 overs a day, lunch, tea and stumps, the draw), declarations and the follow-on (the
  computer captain decides; the player is advised and chooses), the weather (five kinds, by ground, rolled each
  Test morning) on the pitch, the swing and the outfield, a weather report before play, rain costing overs.
- Then: rain stopping play (overs off a Test day, cut overs and a revised target in limited overs), the light
  changing through the day (by session in a Test, by innings in a long game), each weather's own light and sky,
  and a team-selection screen (your side and the computer's, with flags and XIs).
- Still to come: bad light, light rain while play goes on, a gloomier painting for each ground under cloud,
  around-the-wicket and field changes for the Test situation (attacking fields for a declaration, saving the draw).
- AI-vs-AI Tests (`tools/test-report.mjs`, 20 Tests): 20% drawn, over on day 3.8 on average, 2.86 rpo, 54.5 balls
  a wicket. England's batting is weaker than Australia's (3.5 vs 4.6 rpo in sim-report-style innings): worth a look.

## Bowling (agreed November 2026, branch `bowling`)

From a review and a grilling round. What bothers most: the bowler's run-up and action look wrong (big); the
release meter is the only skill (moderate); setting up every ball is slow; you can't tell why a ball worked.
Measured before (20 computer innings of 50 overs each, player bowling): perfect releases with the same ball
5.40 rpo and 64.6 balls a wicket; mixing it up 5.30 rpo, 33.2 balls a wicket; human-like misses 29 extras an
innings (18 wides, 11 no-balls); all bouncers never finished an over. The computer's own bowling: 4.72 rpo,
37.3 balls a wicket.

Decisions:

- Target: a good player who mixes it up does about what the computer's bowlers do (4.5-4.8 rpo, a wicket every
  30-35 balls over 50 overs). A missed release gives a loose ball (short and wide, there to be hit) more than
  extras: about a third of the extras.
- The bouncer law (Law 41.6): a third bouncer in an over is a no-ball and a warning; after a final warning the
  bowler is taken off for the innings. Warnings on screen and from the box.
- Keyboard only for now.
- The bowler gets a 3D skeleton like the batter's (shared rig maths, pixel-art drawing, outline, both ends), one
  action per style (fast, swing, medium, off-spin, leg-spin), reviewed on frame sheets and in slow motion.
- Left-arm bowlers: left-arm fast/swing and orthodox spin. Stork (AUS) and Janssen (SA) left-arm fast;
  Ravindran, Santna (NZ) and Maharajh (SA) orthodox. England none for now.
- The run-up is three taps: two on the last two strides set the rhythm (on the beat gives full pace and a
  tighter line), the third at the delivery stride is the release (length, no-ball). High effort tightens the
  beats but rewards more. Spinners tap on a slower beat. Aftertouch is earned: only after on-beat taps.
- The keeper or captain suggests the next ball in the setup panel, from the computer's own plan, using only
  what you know (a weakness once given away, the balls he's seen); Enter accepts.
- Seeing the battle: a pitch map of the last 12 balls to this batter in the setup panel, a word after each ball
  on how he read it (SURPRISE!, LINED IT UP, ON HIS WEAKNESS, DIDN'T PICK IT), and an end-of-over summary when
  bowling (Space skips).
- The ring around the ball in flight: its colour is the length (purple yorker, green full, gold good, red
  short), its side the swing or turn. Batting, it shows your batter's read from when he reads it (the decoy if
  he doesn't pick it); bowling, the truth after release. The delivery label leaves the score bar while you bat
  and appears after he's played it, with the speed gun.
- Assists, EASY / NORMAL / HARD (default NORMAL), on the where-and-when page and in the pause menu:

  |                      | EASY                            | NORMAL              | HARD                |
  | -------------------- | ------------------------------- | ------------------- | ------------------- |
  | Rhythm taps          | wide beats, a miss costs little | as designed         | narrow beats        |
  | Gold zone            | wider                           | as now              | narrower            |
  | Aim after running in | landing marker stays            | crosshair stays     | crosshair hides     |
  | Ring batting         | true path from release          | your batter's read  | off                 |
  | Ring bowling         | truth after release             | truth after release | truth after release |
  | Suggestion           | shown and selected              | shown               | shown               |

  High-score entries show the easiest level used in the match.

Done (first pass, branch `bowling`): all seven streams below. Balance after them, a good player bowling
sensible plans against the computer's batting (tools/bowling-report.mjs, 120 innings of 50 overs): 4.76 rpo and
34.5 balls a wicket, inside the target; the computer's own bowling unchanged at 4.68 rpo (sim-report).

Found on the way, for a decision: the computer's right-arm bowlers bowl their right-hander's lines to
left-handers, which the angle carries well wide (a planned off-stump ball crosses the crease 0.46 m outside off
to a left-hander, 0.11 m to a right-hander). Allowing for it (as left-armers and the keeper's advice now do,
`aimAllowance` in sim/delivery.js) takes the computer's bowling from 4.68 to 4.45 rpo and 37.9 to 27.8 balls a
wicket in sim-report, because Australia's top order has several left-handers: a big change to everyone's batting,
so it's left for you to choose. Still to come: around-the-wicket choices for the computer, a left-armer's own
footmarks, per-player quirks in the action (data hooks), drawn celebrations and appeals on the new rig.

Streams, in order, each ending in a play-test:

1. Fixes: the bouncer law, misses giving loose balls, balance to the target.
2. The bowler's 3D action, five styles.
3. The three-tap run-up, synced to the action, with earned aftertouch.
4. Seeing the battle: the suggestion, the pitch map, the read words, the over summary, the label.
5. The ring around the ball.
6. Assists and scores.
7. Left-arm bowlers.

## Later

- Fictional names and art before any pub install.
- Cabinet: attract mode, credits, a quick pub-match format, joystick and buttons.
- Better touch controls; multiplayer; signature stances; DualShock 4 support.

## Not applicable to the game (yet)

Drinks breaks, DLS (rain shortens a limited-overs game only before the start), net run rate, venue records and
career stats: the game has none of these to talk about.
