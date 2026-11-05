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

## Grounds: Parklands from the beginning (agreed November 2026, branch `parklands-new`)

From a review and a grilling round, on Parklands only. What was wrong: the close and wide views showed two
different grounds (pavilions and a picket fence close up, a concrete bowl from above); the close view's fence was
painted 32 m from the striker though the camera puts the rope 76 m away, so deep fielders would stand in the
seats; both ends showed the same backdrop; one pavilion was repeated five times; nothing moved; each view had its
own hand-tuned camera.

Decisions:

- A leafy local ground, fictional, built as PARKLANDS (NEW) beside the old one until it's signed off, then it
  replaces it. Other grounds (Parklands (Boards) included) stay as they are.
- Layout: the pavilion end (two storeys, white weatherboard, a clock gable, members' seats either side), the
  scoreboard end (a hand-turned board on a grass bank, showing the real score, banks and tents), the Old Stand
  (covered, one tier) on one side, the Hill (a grass bank, picnic crowd) on the other; a picket fence, four
  floodlight towers, trees behind, and a sightscreen at each end, white for the red ball and black for the white.
- The boundary stays a 66 m circle (no sim change). The map can carry a shape for a later ground.
- One map of the ground drives every view. The views turn with the bowling end each over, as the commentary
  already does.
- Close views: the camera stays exactly as it is; the far end is drawn at its true distance (rope at 76 m, row
  72), so fielders at the rope stand at the fence.
- Wide view: a TV camera far off and high (about 20 degrees down, long lens, nearly even scale), true perspective,
  that turns and zooms from one spot: a window on one big picture. Zoom from the whole ground to 3x on the
  square; the stands at 2x detail, the grass and pitch at 3x, past 2x only where no stands are in frame. It
  directs itself (opens on the ball and batters, follows the ball out, the whole ground between overs) and eases
  in on the square while you move a close fielder. Players switch from the block figures to the jointed figures
  at about 14 px.
- Art: pixel art at 640x360 (the wide picture at 1280x720 detail), drawn in the game from the map through the
  game's own cameras at load. Any layer can be painted over: the template tool exports each layer with guides
  (rope, horizon, HUD panels), a painted layer replaces the drawn one, and a stale one (the map changed under it)
  is flagged.
- Light: one daylight picture relit for afternoon, evening and night (masks for windows and floodlights), with
  the buildings and trees casting shadows across the outfield from their heights on the map.
- Life later: the crowd on its own layer, flag and scoreboard spots on the map; nothing moving yet.
- Assumed: weather over the new art as now; SIMPLE effects look the same (the ground is drawn once); with the
  camera locked to WIDE you watch the delivery zoomed in on the square; the HUD panels stay where they are.

In place before a second ground: the map format, the parts kit, the template tool, the ground sheet, checks (the
rope, fence and sightscreen land where the cameras say; stale paint flagged; drawing under 100 ms in the test
browser; painted layers under 500 KB), and a "making a ground" section in the README.

Stages (built together, reviewed in bulk at the end):

1. The map and cameras: every view and both ends in plain shapes, the ground sheet, the position checks.
2. The standard: the view from behind the striker at the pavilion end, midday, finished.
3. The other end, the sides and the wide picture to that standard.
4. Light and shadows: relighting, cast shadows, night, the sightscreen colour.
5. The wide camera's director, the field-placing zoom, the jointed players.
6. Paint-over templates, stale and size checks, the README section.
7. Sign-off: PARKLANDS (NEW) replaces Parklands.

Done and signed off (November 2026): all seven stages. Parklands is now the ground drawn from its map
(`PARKLANDS_SIGNED_OFF` in render/grounds.js), and for now it's the only ground on the menu (`ON_MENU`); the
others still work and come back as they're rebuilt the same way. After the review: while the ball's in play
the wide camera always keeps the whole wicket in shot with the ball or the fielder who has it, and a run bar
above the score bar shows each batter along the pitch, in or out of his ground. Still to come: painting over
any layers (the tools are ready), life in the ground (the crowd, flags), the run bar's place in the close
view (it covers the foot of the near stumps while it's up), and measuring on the Pi 5.

## Batting: the feet decide the shot (agreed November 2026, branch `batting`)

From a review and a grilling round. The aim: the batter has to respond to the ball bowled, but can still
rely on reacting; timing is king, but the wrong feet or the wrong shot hurt. Before: the shot key carried
the foot (S drive, W loft, A forward defence forward; Q attack, D defence back), a 10 cm step across the
crease, a wrong-foot penalty that was mild, and the ball came off the bat by formula (bat speed plus 42% of
the ball's pace), its direction from the line and timing and its height set per shot.

Decisions:

- Played on keyboard, touch, gamepad and an arcade stick, built round a stick: its direction is the feet,
  buttons what you do with the bat. Up is away from the camera, left and right as on screen (from behind
  the bowler, up is back). Gamepad support (the browser's) comes in this work, menus included.
- Feet: forward stride, back, forward or back and across, away to leg, down the pitch (two quick pushes
  forward, 1-2 m, against pace too; the keeper may stump you, likelier standing up), or left alone on the
  crease. They move during the ball's flight and strides take real time (about 0.2 s to plant the front
  foot): late is caught on the crease. A trigger: hold a direction in the run-up and he presses that way at
  release, a head start that costs if the ball goes the other way.
- Buttons: defend, attack, loft, improvise (sweeps, ramps, scoops by the feet), power held or tapped to arm
  it for the ball; no button leaves (feet back sways under a bouncer, feet alone ducks). Keyboard A S W D
  and Shift; touch a stick and four buttons; gamepad the stick, face buttons and a shoulder for power.
- The shot comes from the feet, the button and the ball, timing moving it finer or squarer. The whole
  matrix: drives by line, the clip and whip, cut, late cut, punch, pull, hook, glance, upper cut, inside-out
  drive, the pulls from inside the line, charging drives, sweep, slog-sweep, reverse sweep, ramps and
  scoops, paddle, switch hit, the defences, smothering, jabs and fends on the crease, sway and duck.
  Aiming where to hit it comes later (on HARD, perhaps the stick aiming once the feet lock in the swing).
- Wrong choices hurt through the geometry: the feet decide where and when the bat meets the ball (forward
  to a short one meets it climbing, back to a full one at the toes, across the line leaves the stumps or
  pads in its path); ratings only add the error. The computer bats on the same rules.
- The ball off the bat is a collision in the sim: a 156 g ball, its bounce off the bat about 0.5 new and
  0.42 old; the bat's weight where it's hit (less at the toe and splice); bat speed from soft hands to
  about 30 m/s; the face opened or closed by timing (about 3 degrees per 10 ms), tilted over or under the
  ball; a little spin (drives run on, dabs and edges die). A perfect drive off 135 km/h is about 35-40 m/s.
- Bats: each batter's has a weight (about 1.1-1.4 kg), edges and a handle length, from his ratings with
  overrides in the squads, shown on the team sheet. Heavier hits harder but swings slower.
- Feedback: a footwork word by the timing meter (GOOD STRIDE, CAUGHT ON THE CREASE, WRONG FOOT, ACROSS THE
  LINE, OUT OF REACH, ROOM TO WORK); the nets coach rates the feet.
- Assists: EASY moves the feet to the length (you choose the shot and time it), a wider window, the true
  path and a landing mark; NORMAL as designed; HARD narrower, less forgiving, no ring.
- Targets (your batting against the computer's bowling, 50 overs, tools/batting-report.mjs): good timing and
  the right feet 5-6 an over, out every 40-60 balls; good timing on the crease about 4, out every 15-25;
  good timing always forward out every 15-20; average timing and the right feet 4-5, out every 25-35. The
  computer's own batting stays where it is (sim-report 4.68 an over, a wicket every 37.9 balls).

Streams, in order, each ending in a play-test:

1. The batting report, and the collision with today's controls (the physics change on its own).
2. The feet in the sim: where and when the bat meets the ball from the feet, for both sides; the computer
   retuned to today's scoring.
3. The controls: the stick or arrows as feet, the trigger, down the pitch, four buttons, the power toggle,
   touch's stick, the gamepad.
4. The shot matrix: all the strokes, their animations, the stride drawn as you push, their names.
5. Bats: weight, edges, handle, by player, on the team sheet.
6. Assists and the footwork words.
7. Balance against the report's targets.

Stream 1 done (WIP on `batting`): `tools/batting-report.mjs` and `sim/bat-ball.js`. The computer's batting is
unchanged over 300 innings (4.62 -> 4.61 an over, 36.2 -> 36.1 balls a wicket; a few fewer fours, a few more
run outs). Your batting, 20 innings a row, before -> after: perfect timing 8.20 -> 8.01 an over and 47.7 ->
48.5 balls a wicket; good 7.63 -> 7.74, 39.9 -> 49.7; average 6.86 -> 7.35, 39.1 -> 47.9; power on every
attack 9.83 -> 11.27, 24.3 -> 34.2; always forward 7.66 -> 7.77, 44.1 -> 50.7; always back 7.57 -> 7.96, 66.7
-> 72.0. Still far too easy, and the wrong feet don't hurt yet: streams 2 and 7. The timing turn still comes
before the batter works the ball into a gap (as it did): moving it after made the computer score about 1.9
an over less, a lever for stream 7.

Stream 2 done (WIP on `batting`): `sim/feet.js`. Shots carry their feet ({ stride, across, from }). The
stride sets the contact depth and time; a late one is caught part of the way. The stance sets how high and
low the bat reaches, and the weight into the shot. A late, steep bat is above a low ball. A mistimed shot
meets the ball where it has moved to. The pads and the reach (shorter to leg) follow the feet, and a charge
brings in the stumping. The old wrong-foot penalty is gone. Today's keys give the shot's own foot, started
as you commit. The computer picks forward or back from its read, sometimes stays on the crease (heavy feet)
or charges a spinner. It is retuned to today's scoring (swing power 0.55 -> 0.6, timing spread 1.85 ->
1.6). sim-report over 300 innings: 4.62 -> 4.65 an over, 36.2 -> 38.1 balls a wicket.

| Your batting, 20 innings | After stream 1 | After stream 2 |
|---|---|---|
| good timing, right feet | 7.74 an over, out every 49.7 | 7.51, 54.2 |
| average timing, right feet | 7.35, 47.9 | 5.87, 32.0 |
| good timing, on the crease | (new row) | 5.30, 45.6 |
| good timing, always forward | 7.77, 50.7 | 7.11, 46.0 |
| good timing, always back | 7.96, 72.0 | 4.20, 46.2 |

The wrong feet now cost runs (almost no boundaries from the crease or the back foot) but not yet enough
wickets: stream 7. Its levers are the stance ranges, the stride times, the weight table and the bat's
descent, all in `sim/feet.js`.

Stream 3 done (WIP on `batting`): `scenes/bat-controls.js`, `engine/gamepad.js`, `scenes/pad-bindings.js`,
the touch stick. The arrows (stick, d-pad, touch stick) are the feet, up away from the camera. A push sets
the stride going from then, forward twice goes down the pitch, left and right go across while held, and
what's held in the run-up is the trigger. A S W D are defend, attack, loft and improvise; Shift is held for
power or tapped to arm it; no button leaves. The shot comes from the button and the feet
(`controlShot` in `sim/shot-choice.js`): attack drives forward and cuts or pulls back, improvise sweeps,
reverse-sweeps across or ramps going back. The full matrix and the sway and duck animations are stream 4.
Gamepads work in every screen, with buttons per screen. Also fixed: the bowling crosshair's up and down
were the wrong way round for a left-hander. No sim change, so the reports stand as after stream 2.

Stream 6 done next (streams 4 and 5 still to come; WIP on `batting`): `sim/footwork-words.js`. The word by
the timing meter, and the coach's FEET line, tip and grade. EASY moves the feet to the length (forward to
6.8 m, back beyond), widens the window 1.3x and marks the landing spot from release. HARD's window is 0.8x.
The landing mark when batting on NORMAL and HARD now only shows as the ball pitches. No sim change.

## Later

- Fictional names and art before any pub install.
- Cabinet: attract mode, credits, a quick pub-match format, joystick and buttons.
- Better touch controls; multiplayer; signature stances; DualShock 4 support.

## Not applicable to the game (yet)

Drinks breaks, DLS (rain shortens a limited-overs game only before the start), net run rate, venue records and
career stats: the game has none of these to talk about.
