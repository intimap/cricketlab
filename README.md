# Cricket Lab

A 16-bit style Test cricket game (Australia v England) for the browser. Bat or bowl through a spell on a
green top, a dust bowl or a cracked pitch, with a physics-based ball, wearing pitch and ageing ball,
AI field placings and ball-by-ball commentary.

Plain JavaScript modules and some images: no build step, and the game itself has no dependencies (`package.json`
is only for the Netlify score service).

## Run it

The game uses ES modules, so it has to be served over HTTP (opening `index.html` from disk won't work).
From the repo folder, either of these works:

```sh
python3 -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000. It plays with a keyboard, or with on-screen buttons on a phone or tablet. On a touch screen POWER is a
tap rather than a hold: it lights up and stays on for that ball, then switches off.

It opens on the menu with a 10-over match at Parklands Oval chosen, so Enter goes straight into it; the menu also
has Nets, Classic Matches, a single spell and longer or shorter matches.

To publish it, turn on GitHub Pages (Settings → Pages → Deploy from branch → `main`, `/ (root)`).

## Controls

|               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menu          | Arrows to change, Enter to start                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Batting       | Space to face up. Front foot: **S** drive, **W** loft, **A** forward defence. Back foot: **Q** attack (cut, punch, pull, hook or glance, as the ball dictates), **D** defence. No key = leave. Hold **←**/**→** before playing to step 10 cm across the crease (back to guard when let go), to reach a wide one (his pads move too). The ball's line sets the direction; play late to go finer, early to go squarer. Hold **↓** with **W** to ramp over the keeper, or **↓** + **←**/**→** with **Q** to sweep / reverse sweep. Hold **Shift** for a power shot (play it earlier). **↑** / **↓** to run or turn back |
| Bowling       | Arrows set line and length (Shift = fine), number keys pick the delivery, **E** effort, **F** field preset, **V** drag fielders with the mouse, **N** new ball (after 80 overs). Space to run in, Space again to release at the delivery stride: early pitches it shorter, late fuller, very late is a no-ball                                                                                                                                                                                                                                                                                                       |
| Between balls | **O** sim an over, **P** sim 5 overs, **V** view the field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Appeals       | **H** to appeal for LBW when bowling (appealing for nothing irritates the umpire). **R** to review a decision that goes against you, or **Space** to accept it; play stops for up to 10 seconds while you decide (two unsuccessful reviews per innings). The umpire gets one in seven or so wrong                                                                                                                                                                                                                                                                                                                    |
| Anytime       | **C** camera, **M** sound, **Esc** pause and scorecard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## High scores

Every finished match and Classic Match ends on an arcade high-score screen: the result (won or lost by so many
runs or wickets), a name of up to 15 letters (type it, or Up/Down to change a letter, Right for the next, Left to
take one back; on a phone, KEYBOARD opens the phone's own keyboard), then the table. Nets and single spells have no
table. Each kind of game has its own table (`match-10`, `match-20`, `classic-lastOver`...); the menu's HIGH SCORES
row shows the one for the game chosen.

Ranking: wins above ties above losses. Wins by wickets (you chased it down) come first, more wickets in hand then
more balls to spare; then wins by runs, biggest margin first. Losses by runs (you fell short chasing) rank above
losses by wickets, narrowest first. Equal results keep the order they were set in.

The tables are shared by everyone playing the same copy of the game, kept in the first of these that works:

- **claude.ai artifact:** the artifact's shared database (publish it with the `db` capability).
- **Netlify:** the site's score service, `netlify/functions/scores.mjs` at `/api/scores`, which keeps each table
  in Netlify Blobs. Netlify installs its one package (`@netlify/blobs`, in `package.json`) and deploys the
  function along with the site; there's nothing to set up.
- **Anywhere else** (a local server, a saved file), or when the viewer isn't allowed to write to the shared table:
  this browser's storage, and the table says "on this device only".

The score service checks what it's sent (known table names, a name the font can draw, a possible rank) and stamps
each score with its own clock, but anyone who can reach the site can post a score, so treat the table as a game
between friends rather than a record.

## Batting: your eye

The **EYE** meter (top left when you bat) fills as you get your eye in. Every well-timed shot fills it a little, and a perfectly
middled one fills it more; a well-timed block helps a bit. Being beaten (or bowled, or hit on the pad
playing a shot) knocks 15% off what's left and an edge 5%, while an air swing empties it; leaves and mistimed shots leave
it as it is. The fuller it is, the bigger the multiplier on every shot you play (up to x1.4): more bat
speed, and a slightly bigger timing window and sweet spot. Each batter has his own eye, so a new batter starts from
nothing, and off strike it fades slowly, by 0.05 over an over his partner faces. The computer's batters have an eye too,
built and lost by the same rules, so a set batter is harder to bowl to. The numbers, shared by both, are at the top of
`sim/eye.js`.

## Bowling: the battle

Each computer batter has a hidden weakness (loose outside off, a compulsive hooker, hates the short ball, shaky against spin early on, or late on the full inswinger). Watch for plays and misses and listen to the commentary for hints.

- **Memory:** bowl the same ball over and over and he lines it up. Break a pattern (three going away, then one back in; three short, then a full one) and he's more likely to edge or miss. The setup panel shows the last three balls he's seen.
- **Pressure:** dots and maidens build the pressure meter (PRS on the score bar); boundaries release it. Under pressure batters get impatient: slogs, charges and bad calls for runs.
- **Release timing:** release in the gold zone of the meter for a perfect delivery. The zone shrinks as the bowler tires; too late is a no-ball, followed by a free hit.
- **Variations:** quicks have bouncers (two an over, a third is a no-ball), yorkers (overpitch it and it's a full toss), slower balls and cutters; spinners have an arm ball, a googly (leg-spinners), and flight (**E** cycles flighted, stock and flat). On a worn pitch, especially the dust bowl, footmarks appear outside leg (and off) and turn sharply.
- **Fields:** **F** also cycles traps: bouncer trap, leg slip, ring field.

## How the code is organised

```
index.html            page shell and key strip
assets/               the two painted backgrounds (close and wide camera)
src/
  main.js             boot, asset loading, game loop, scene switching
  math.js             clamp, easing, angle helpers
  engine/             browser plumbing, no cricket in here
    screen.js         640x360 pixel frame buffer, scaling, drawing primitives
    text.js           5x7 bitmap font
    input.js          keyboard and mouse state, polled per frame
    touch.js          on-screen buttons for phones, pressing the same keys
    audio.js          synthesised sound effects and crowd
    storage.js        small settings kept in this browser
    scores.js         high-score tables: the artifact's shared database, or this browser
  sim/                the cricket model, no drawing in here
    geometry.js       pitch dimensions and the world coordinate system
    rng.js            seedable random numbers
    teams.js          squads and player ratings
    conditions.js     pitch types, pitch wear, ball wear (swing, reverse, grip)
    delivery.js       bowling: release, swing, seam, spin, bounce, flight
    batting.js        the shot: timing, where the bat goes, edges, LBW, bowled
    eye.js            every batter's eye: built by well-timed shots, dented by misses and edges
    ball-in-play.js   after the shot: fielders, catches, throws, running, run-outs
    field.js          field presets and position names
    ai.js             computer bowler, field, delivery and shot choices
    innings.js        scorebook, cards, strike, bowler fatigue
    call.js           the score bar's plain call: what was bowled, the shot, the result
    commentary.js     the commentary box's ball-by-ball lines, over summaries and sledges
    moments.js        spots situations worth talking about (droughts, pressure, near run-outs...)
    commentators.js   the commentary box: who speaks after each ball
    pack-voice.js     picks commentary-pack lines that are true of the ball, fresh each time
    commentary-pack/  the commentary pack (v1): its lines as JSON, with its own README, checks and integration notes
    booth-lines.js    each commentator's lines for every situation
    match.js          plays innings ball by ball, swaps sides, works out the result
    formats.js        game formats and Classic Match challenges (data)
    runup.js          the player's run-up and release meter: rhythm, ramp, stride surges
    coach.js          the nets coach: a verdict on every ball faced or bowled
    leaderboard.js    high-score entries from a result, and how they rank
  render/
    camera.js         projections for the close (either end) and wide views
    sprites.js        the ball and its shadow; re-exports kit.js, batter-rig.js and figures.js
    kit.js            kit colours, a player's looks (skin, hair, beard, height), mirroring, shadows
    batter-rig.js     the striker: key poses, skeleton (IK for knees and elbows), drawing him in kit
    figures.js        everyone else: bowler, keeper, fielders, umpires, runners, close up and tiny
    batter-motion.js  the straight drive, forward defence and pull on the batter's newer rig (more strokes to follow)
    hud.js            score bar, mini-map, banners, scorecard, speech bubbles
    booth.js          commentator portraits and the commentary popup
    grounds.js        grounds as data: stripe layout, colours, pitch looks, which paintings to use
    ground.js         the layer compositor: builds each view's background from a ground's data
  scenes/
    menu.js           title screen
    match.js          the match: phases, timing, events
    match-input.js    the player's controls: shots, defence, leaving, footwork, aiming the bowling
    match-decisions.js  LBW appeals, the umpire's decision and DRS reviews
    match-view.js     drawing for the match scene
    batter-pose.js    the striker's pose through a ball: stance, trigger, backlift, strokes, follow-throughs
    pause-menu.js     the Esc menu: scorecard, instructions, sound
    scoreboard.js     the arcade high-score screen: name entry and the table
netlify/
  functions/scores.mjs  the shared high-score service on Netlify (/api/scores)
  score-table.mjs       its tables: checks scores, keeps each table's best 200, safe against saves at once
```

The rule of thumb: `sim/` knows nothing about the screen, `engine/` knows nothing about cricket, and
`scenes/` connects them.

### World coordinates

Metres. The striker's stumps are at the origin and the bowler's stumps at `z = 20.12`. `x` runs across
the pitch, positive towards the off side (the batters are right-handed), and `y` is height. Bearings are
in degrees from the striker's stumps: 0 is straight back past the bowler and positive is the off side.

### Where to start for common changes

- **Ball physics and difficulty:** `sim/delivery.js` (how balls are bowled) and `sim/batting.js` (timing
  windows, edges, LBW).
- **Player ratings and squads:** `sim/teams.js`.
- **Pitch behaviour:** `PITCH_TYPES` in `sim/conditions.js`.
- **AI tactics:** `sim/ai.js`.
- **Fielding and running:** `sim/ball-in-play.js`.
- **What's shown on screen:** `scenes/match-view.js` and `render/`.
- **Batter animation:** which pose or stroke when, in `scenes/batter-pose.js`; the poses, skeleton and drawing in
  `render/batter-rig.js`; the newer rig's stroke clips in `render/batter-motion.js`.
- **Game modes and Classic Matches:** `sim/formats.js` (challenges are plain data). AI chase and
  limited-overs tempo constants are at the top of `sim/ai.js`.
- **Ground art:** images live in `assets/` (layer art in `assets/close/`), listed by id in `src/assets.js`;
  grounds pick their layers in `src/render/grounds.js` (`hidden: true` keeps a ground off the menu; The Oval is
  hidden for now). `tools/art/make_scenery.py` regenerates the
  Parklands close-view layers.
- **One-file builds:** `python3 tools/build-single.py out.html [--ref main] [--stamp]` bundles the game
  with its images inlined (needs esbuild).
- **Balance checks:** `node tools/sim-report.mjs [innings] [pitch]` simulates AI-vs-AI innings and prints
  run rates, dismissals, plan figures and commentary moments.
- **Commentary:** `sim/call.js` for the plain call on the score bar. The box's call of each ball, its moment lines and
  the commentators' reactions come from the commentary pack (`sim/commentary-pack/v1/`, its JSON files; each line says
  when it's true of a ball), picked by `sim/pack-voice.js` and voiced in `sim/commentators.js`. A new batch goes in as
  a new pack version (see the pack's README). `sim/moments.js` spots situations; moments the pack doesn't cover use
  each commentator's lines in `sim/booth-lines.js`.
