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
| Bowling       | Arrows set line and length (Shift = fine), number keys pick the delivery, **E** effort, **T** over/around the wicket, **F** field preset, **V** drag fielders with the mouse, **N** new ball (after 80 overs). Space to run in, Space again to release at the delivery stride: early pitches it shorter, late fuller, very late is a no-ball                                                                                                                                                                                                                                                                                                       |
| Celebrations | Space, Enter or tap the game to skip a boundary or wicket celebration |
| Between balls | **O** sim an over, **P** sim 5 overs, **V** view the field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Appeals       | **H** to appeal for LBW when bowling (appealing for nothing irritates the umpire). **R** to review a decision that goes against you, or **Space** to accept it; play stops for up to 10 seconds while you decide (two unsuccessful reviews per innings). The umpire gets one in seven or so wrong                                                                                                                                                                                                                                                                                                                    |
| Anytime       | **C** camera, **M** sound, **Esc** pause and scorecard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Sound uses the built-in Web Audio engine: layered bat contact sounds, a stereo crowd and short broadcast
cues. Esc → AUDIO MIX adjusts effects, crowd and broadcast volumes independently; arrows or tapping a bar
change its level, and settings are kept on this device. M still mutes everything.

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

- **Memory:** bowl the same ball over and over and he lines it up. Break a pattern (three going away, then one back in; three short, then a full one) and he's more likely to edge or miss. Switch between over and around the wicket with **T** while aiming; the target stays fixed and the release angle changes.
- **Pressure:** dots and maidens build the pressure meter (below EYE in their shared panel); boundaries release it. Under pressure batters get impatient: slogs, charges and bad calls for runs.
- **Release timing:** the meter starts slowly and accelerates smoothly towards the gold zone. Release there for a perfect delivery. The zone shrinks as the bowler tires; too late is a no-ball, followed by a free hit.
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
    audio.js          synthesised sound effects, stereo crowd and audio mix
    audio-synth.js    generic enveloped oscillator and noise voices
    storage.js        small settings kept in this browser
    scores.js         high-score tables: the artifact's shared database, or this browser
  sim/                the cricket model, no drawing in here
    geometry.js       pitch dimensions and the world coordinate system
    rng.js            seedable random numbers
    teams.js          squads and player ratings
    conditions.js     pitch types, pitch wear, ball wear (swing, reverse, grip)
    bowling-side.js   over/around release geometry and follow-through position
    delivery.js       bowling: release, swing, seam, spin, bounce, flight
    bat-impact.js     blade contact coordinates, toe/splice rebound and continuous edge deflection
    batting.js        the shot: timing, where the bat goes, edges, LBW, bowled
    eye.js            every batter's eye: built by well-timed shots, dented by misses and edges
    ball-in-play.js   after the shot: the ball, catches, throws, running, run-outs
    fielder-motion.js how fielders move: accelerating, turning, easing up, set, dive/get up, walking in
    fielder-ai.js     who chases the ball, who cuts it off, who covers the stumps
    fielder-catch.js  the chance of holding a catch
    fielder-throw.js  release time, which end to throw to, shies and wild throws (overthrows)
    field.js          field presets and position names
    ai.js             computer bowler, field, delivery and shot choices
    innings.js        scorebook, cards, strike, bowler fatigue
    call.js           the score bar's plain call: what was bowled, the shot, the result
    commentary.js     simulation commentary records, over summaries and sledges
    moments.js        spots situations worth talking about (droughts, pressure, near run-outs...)
    commentators.js   commentary voices and compatible booth entry points
    booth-editor.js   every-ball call plus an optional contextual second voice
    booth-caller.js   factual outcome classification and fresh primary calls
    booth-dot-lines.js  voice-specific calls for leaves, blocks and other dots
    booth-scoring-lines.js  voice-specific runs, boundaries and extras calls
    booth-wicket-lines.js  voice-specific dismissal calls
    booth-context.js  read-only match situations and story priorities
    booth-stories.js  personality-specific analysis, reactions and banter
    booth-policy.js   final HPD duplication and booth line validation
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
    bat.js            willow blade face, solid edge and toe, projected from the striker's rig
    figures.js        everyone else: bowler, keeper, fielders, umpires, runners, close up and tiny
    batter-motion.js  the original straight drive, forward defence and pull
    batter-motion-all.js  all 28 stroke clips and the expanded visual sampler
    batter-shot-extensions.js  composes authored data from batter-shots/
    batter-shots/     additional drive, back-foot, sweep/ramp and touch-shot pose families
    batter-catalog.js  input-family and shot-label routes to the 28 clips
    match-broadcast.js DRS tracking, verdict cards and celebrations
    bowling-setup.js  target-aiming panel and over/around selector
    bowler-motion.js  run-up and follow-through on the chosen side
    batter-meters.js  shared eye and pressure panel
    hud.js            HUD entry points, mini-map, banners, scorecard, speech bubbles
    score-bar.js      two-line batting/bowling strip with partnership and commentary
    team-flag.js      pixel team flags framing the bottom score strip
    over-balls.js     shaded delivery spheres with runs, wickets and extras
    ball-trail.js     the delivery's fading trail and the pitch-map landing reticle (close view)
    feedback.js       arcade feedback drawn: timing meter and callout, floating words, eased bars
    booth.js          commentator portraits and the commentary popup
    grounds.js        grounds as data: stripe layout, colours, pitch looks, which paintings to use
    ground.js         the layer compositor: builds each view's background from a ground's data
  scenes/
    menu.js           title screen
    match.js          the match: phases, timing, events
    match-audio.js    contact timbres and broadcast sound cues
    bowling-side.js   per-bowler side selection and setup controls
    match-input.js    the player's controls: shots, defence, leaving, footwork, aiming the bowling
    match-decisions.js  LBW appeals, the umpire's decision and DRS reviews
    match-feedback.js what feedback to show and when: shot words, +/-EYE and PRESSURE, hit-stop, shake
    match-view.js     drawing for the match scene
    match-broadcast.js review timing and celebration skip input
    batter-pose.js    the striker's pose through a ball: stance, trigger, backlift, strokes, follow-throughs
    batter-stroke.js  presentation-only selection and the existing attack/block/leave clocks
    audio-mix.js      pause-menu controls for effects, crowd and broadcast volumes
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
- **Fielding and running:** `sim/ball-in-play.js`; fielders' movement, choices, catching and throwing in
  `sim/fielder-motion.js`, `fielder-ai.js`, `fielder-catch.js` and `fielder-throw.js`.
- **What's shown on screen:** `scenes/match-view.js` and `render/`.
- **Batter animation:** which pose or stroke when, in `scenes/batter-pose.js`; the poses, skeleton and drawing in
  `render/batter-rig.js`; the blade's face, thickness and toe in `render/bat.js`;
  the expanded sampler in `render/batter-motion-all.js` and poses in `render/batter-shots/`;
  stroke selection and timing in `scenes/batter-stroke.js`, with routes in `render/batter-catalog.js`.
- **Game modes and Classic Matches:** `sim/formats.js` (challenges are plain data). AI chase and
  limited-overs tempo constants are at the top of `sim/ai.js`.
- **Ground art:** images live in `assets/` (layer art in `assets/close/`), listed by id in `src/assets.js`;
  grounds pick their layers in `src/render/grounds.js` (`hidden: true` keeps a ground off the menu; The Oval is
  hidden for now). `tools/art/make_scenery.py` regenerates the
  Parklands close-view layers. `python3 tools/art/make_lords.py` regenerates Lord's six close/wide scenery layers
  (requires Pillow). `python3 tools/art/make_scg.py` regenerates SCG’s six close/wide layers, with seating
  tight to the advertising boards (also Pillow). `python3 tools/art/make_lakshmi.py` generates Lakshmi Bluff’s
  eight Himalayan scenery layers; selecting this ground defaults the pitch to DUST BOWL. `tools/art/make_theg.py` makes all of The G's (the floodlit Melbourne stadium, in
  `assets/theg/`). A ground with `light` set picks that light on the menu when chosen.
- **One-file builds:** `python3 tools/build-single.py out.html [--ref main] [--stamp]` bundles the game
  with its images inlined (needs esbuild).
- **Balance checks:** `node tools/sim-report.mjs [innings] [pitch]` simulates AI-vs-AI innings and prints
  run rates, dismissals, plan figures and commentary moments.
- **Commentary:** `sim/call.js` owns the factual HUD play description (HPD). The booth (BC) is selected
  by `sim/booth-editor.js`: every ball gets a primary call from `sim/booth-caller.js`, using the established
  328-line ball-call bank and 318 additional voice-specific lines in `sim/booth-*-lines.js`. A second voice
  can add analysis from read-only situations in `sim/booth-context.js` and personality-specific stories in
  `sim/booth-stories.js`. Wording and topic memory avoid recent repetition; when a primary pool is exhausted,
  the least recently used safe line is allowed back. HPD text is never used as a fallback.
  `sim/booth-policy.js` rejects duplicate HPD text both at selection and display. The original chat helpers remain available for existing tools.
  Run `node tools/booth-caller.test.mjs` and `node tools/booth-editor.test.mjs` to check every-ball coverage,
  factual eligibility, freshness, duplicate protection and unchanged match records.

Bat contact resolves the ball against a simplified oriented blade: across its width and along its length
from toe to handle. Toe and splice contacts lose rebound speed; thin and thick edges blend their direction
and pace continuously, including inside edges. Cuts, pulls and sweeps use a horizontal blade; drives and
defence use an upright blade. This is a contact-plane approximation, independent of the drawn bat rig;
post-strike spin and a full rigid-body collision are not modelled. Run
`node tools/bat-impact.test.mjs` for contact geometry, edge continuity and seeded simulation checks.

Over/around selection is remembered per bowler for the innings and can be changed with T, the SIDE touch
button, or the SIDE row in the bowling panel. It locks when the run-up starts. The current action model
is right-arm; changing sides moves the release, run-up and follow-through rather than mirroring the arm.
The non-striker automatically stands on the opposite side of the run-up when the side is changed.
The eye/pressure panel is hidden during bowling setup and returns for the run-up.
Run `node tools/bowling-side.test.mjs` to check the side geometry, delivery angles and selection controls.
