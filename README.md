# Cricket Lab

A 16-bit style cricket game (Australia, England, New Zealand, South Africa, India, Pakistan and Sri Lanka) for the browser. Play a five-day
Test, a limited-overs match or a Classic Match, or practise in the nets, on a green top, a dust bowl or a cracked
pitch, with a physics-based ball, wearing pitch and ageing ball, the weather, AI field placings and ball-by-ball
commentary.

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

It opens on the menu with a 10-over match chosen, so Enter goes on to choosing the teams, pitch, ground and time,
and Enter again starts it. The menu also has Test matches, longer or shorter matches, Classic Matches and
practice in the nets.

To publish it, turn on GitHub Pages (Settings → Pages → Deploy from branch → `main`, `/ (root)`).

## Controls

|               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menu          | First what to play (a match, and which kind, or practice), then the teams (your side on the left, the computer's on the right: Up/Down picks a side, Left/Right its team), then where and when. Arrows to change, Enter to go on, Esc to go back                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Batting       | Space to face up. Front foot: **S** drive, **W** loft, **A** forward defence. Back foot: **Q** attack (cut, punch, pull, hook or glance, as the ball dictates), **D** defence. No key = leave. Hold **←**/**→** before playing to step 10 cm across the crease (back to guard when let go), to reach a wide one (his pads move too). The ball's line sets the direction; play late to go finer, early to go squarer. Hold **↓** with **W** to ramp over the keeper, or **↓** + **←**/**→** with **Q** to sweep / reverse sweep. Trigger attacks early to lift and load the bat (140 ms preparation, then the downswing). Hold **Shift** for a power shot (260 ms preparation; trigger earlier). **↑** / **↓** to run or turn back |
| Bowling       | Arrows set line and length (Shift = fine), number keys pick the delivery, **E** effort, **T** over/around the wicket, **F** field preset, **V** drag fielders with the mouse, **N** new ball (after 80 overs), **Enter** takes the keeper's suggested ball (shown under the setup panel). Space to run in, then Space on his last two footfalls before he leaps (the two notches on the meter: on the beat gives full pace and a tight line, off it slower and wilder; high effort tightens the beats and rewards them more) and Space at the delivery stride to release: early pitches it shorter, late fuller, very late is a no-ball. Holding ←/→ adds aftertouch only if the rhythm earned it                                 |
| Fielding      | While the ball is live (when bowling): **Space** as a catch arrives (well timed it helps, mistimed it hurts, no press leaves it to the fielder); **Z** / **X** call the throw to the keeper's or the bowler's end                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Celebrations  | Space, Enter or tap the game to skip a boundary or wicket celebration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Between balls | **O** sim an over, **P** sim 5 overs, **V** view the field. In a Test: **L** sim to the next break (lunch, tea or stumps), and batting, **C** twice to declare                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Assist        | **EASY**, **NORMAL** or **HARD** on the where-and-when page (or in the Esc menu). EASY widens the beats (a miss costs little) and the gold zone, keeps the landing spot up as you run in, shows the ring's true path when batting and picks the keeper's ball for you; HARD narrows the beats and zone, hides the aim once you run in and turns the ring off when batting. Scores show the easiest level the match was played at                                                                                                                                                                                                                                                                                                  |
| Test matches  | Five days of 90 overs, with lunch, tea and stumps. The box says when it's time to declare; after the first innings each, a lead of 200 lets the captain enforce the follow-on (arrows and Enter when it's yours, with the dressing room's advice shown)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Appeals       | **H** to appeal for LBW when bowling (appealing for nothing irritates the umpire). **R** to review a decision that goes against you, or **Space** to accept it; play stops for up to 10 seconds while you decide (two unsuccessful reviews per innings). The umpire gets one in seven or so wrong                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Anytime       | **M** sound, **G** slow motion (to watch the bowler's action and the strokes), **Esc** pause and scorecard (the camera follows the play on its own)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Sound uses the built-in Web Audio engine: layered bat contact sounds, a stereo crowd and short broadcast
cues. Esc → AUDIO MIX adjusts effects, crowd and broadcast volumes independently; arrows or tapping a bar
change its level, and settings are kept on this device. M still mutes everything.

## High scores

Every finished match, Test and Classic Match ends on an arcade high-score screen: the result (won or lost by so many
runs or wickets), a name of up to 15 letters (type it, or Up/Down to change a letter, Right for the next, Left to
take one back; on a phone, KEYBOARD opens the phone's own keyboard), then the table. Nets and single spells have no
table. Each kind of game has its own table (`match-10`, `match-20`, `test`, `classic-lastOver`...); the menu's HIGH SCORES
row shows the one for the game chosen.

Ranking: wins above ties above losses. Wins by wickets (you chased it down) come first, more wickets in hand then
more balls to spare; then wins by runs, biggest margin first. Losses by runs (you fell short chasing) rank above
losses by wickets, narrowest first. In Tests, wins by an innings come top and innings defeats bottom, and draws
sit between ties and losses. Equal results keep the order they were set in.

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

## The weather

Every match (not the nets or Classic Matches) starts with a weather report, and a Test has one each morning:
sunny, overcast, humid, hot and dry, or showers, with the commentators' take and an icon by the score. Cloud and
humidity help the ball swing; heat dries the pitch so it cracks and turns sooner, and quickens the outfield; rain
leaves a damp, seaming pitch and a slow outfield, and costs overs (a limited-overs game is cut short before the
start, down to no fewer than 5 overs a side). Each ground has its own climate, and a day's weather often carries
into the next. Cloud greys the light and fills the sky, humidity hazes it, heat sharpens it, and rain darkens it.

Rain can also stop play. The covers come on, a panel says what it cost, and Space carries on. In a Test the overs
come off the day, and a long enough stoppage ends it. In a limited-overs game both sides' overs are cut and the
side chasing gets a revised target, in proportion to the batting each side had left to use (the game's own rule
in `sim/rain.js`, not the official DLS tables).

The light changes through the day. TIME on the menu is when play starts: a Test moves on a time each session
(MIDDAY, then AFTERNOON after lunch and EVENING after tea; starting in the AFTERNOON it ends under floodlights),
back to the start each morning. A game of 20 overs a side or more plays its first innings in the starting light
and its chase in the next two. The nets, short games and Classic Matches keep the time chosen. Tests are played
with a red ball (pink if the day goes on under lights), limited-overs games with a white one and coloured kit.

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

Each computer batter has a hidden weakness (loose outside off, a compulsive hooker, hates the short ball, shaky against spin early on, or late on the full inswinger). Watch for plays and misses: the commentators will hint at it, then call it, and it's tagged under his panel once it's plain (or once he's faced 24 balls: by then your side has worked him out). Batting, they read the bowler's plan for each new over (READ: SHORT BALL COMING).

- **Memory:** bowl the same ball over and over and he lines it up. Break a pattern (three going away, then one back in; three short, then a full one) and he's more likely to edge or miss. Switch between over and around the wicket with **T** while aiming; the target stays fixed and the release angle changes.
- **Pressure:** dots and maidens build the pressure meter (below EYE in their shared panel); boundaries release it. Under pressure batters get impatient: slogs, charges and bad calls for runs.
- **Seeing the battle:** the keeper suggests each ball from the computer's own plan for the over (using his
  weakness only once it's been given away); **Enter** takes it. Under the setup panel, a pitch map of the last 12
  balls to this batter (a wicket red, a boundary gold, beaten blue, runs cream, a dot green). After each ball a
  word on how he read it (SURPRISE!, DIDN'T PICK IT, ON HIS WEAKNESS, HE'S LINED IT UP), and at the end of each
  over a summary: the balls, where they pitched, and a line on how it went. Batting, the delivery isn't on the
  score bar until he's played it; then the speed gun names it.
- **The ring:** a bold half ring round the ball in flight: its colour is the length it's going to (purple a yorker,
  green full, gold a good length, red short), its side the way it will move (both sides, fainter, when it's
  going straight on). Batting, it's your batter's read: it comes up once he's read the ball (earlier for a
  better batter with his eye in) and shows what he thinks, so a googly or slower ball he hasn't picked shows
  the decoy. Bowling, it's the truth from release.
- **Rhythm:** two taps on the bowler's last two footfalls before he leaps, then the release. An ordinary rhythm
  (about 60 ms off each beat) bowls the ball as it was; on the beat he's a touch quicker and tighter, and earns
  his aftertouch; off it he's slower and sprays it (`sim/rhythm.js`). Spinners' beats come slower.
- **Left-armers:** Stork (Australia), Janssen (South Africa), Afreedi (Pakistan) and Madushanko (Sri Lanka) bowl
  left-arm fast; Ravindran, Santna (New Zealand), Maharajh (South Africa), Jadeya (India) and Jayasuria (Sri
  Lanka) left-arm spin, which turns away from a right-hander. They run in and
  release from the other side of the stumps (the umpire stands on the other side too) and angle the ball across
  a right-hander, so aim a little straighter. Swing keeps its names by the batter: a left-armer's outswinger
  still goes away from a right-hander.
- **Release timing:** the meter starts slowly and accelerates smoothly towards the gold zone. Release there for a perfect delivery. The zone shrinks as the bowler tires. A mistimed release is a loose ball (early drops it short, late drags it full, either drifts wide of off); only very late, in the red, is a no-ball, followed by a free hit.
- **Variations:** quicks have bouncers (two an over that pass the batter above the shoulder; a third is a no-ball and a first and final warning, and the next time in the innings the bowler is taken off and someone else finishes the over), yorkers (overpitch it and it's a full toss), slower balls and cutters; spinners have an arm ball, a googly (leg-spinners), and flight (**E** cycles flighted, stock and flat). On a worn pitch, especially the dust bowl, footmarks appear outside leg (and off) and turn sharply.
- **Fields:** a new bowler starts with the field his captain would set. **F** cycles the presets and the traps (bouncer trap, leg slip, ring field); **V** lets you drag fielders.

## How the code is organised

```
index.html            page shell and key strip
assets/               venue art: each ground's layers for the close and wide views, wide perimeters, the MCG stadium
src/
  main.js             boot, asset loading, game loop, scene switching
  assets.js           every image the game loads, by id
  math.js             clamp, easing, angle helpers
  engine/             browser plumbing, no cricket in here
    screen.js         640x360 pixel frame buffer, scaling, drawing primitives
    text.js           5x7 bitmap font
    silhouette.js     cast shadows: a sprite's shape sheared onto the ground, all of a frame's in one layer
    outline.js        a sprite drawn with a 1px outline round its whole shape (the striker)
    input.js          keyboard and mouse state, polled per frame
    touch.js          on-screen buttons for phones, pressing the same keys
    audio.js          synthesised sound effects, stereo crowd and audio mix
    audio-synth.js    generic enveloped oscillator and noise voices
    storage.js        small settings kept in this browser
    scores.js         high-score tables: the artifact's shared database, or this browser
  sim/                the cricket model, no drawing in here
    geometry.js       pitch dimensions and the world coordinate system
    handedness.js     left-handers: the sim in the striker's frame, deliveries mirrored into it
    rng.js            seedable random numbers
    teams.js          squads and player ratings
    team-list.js      every team the menu offers (Australia, England, New Zealand, South Africa, India, Pakistan, Sri Lanka)
    squads/           the New Zealand, South Africa, India, Pakistan and Sri Lanka squads
    conditions.js     pitch types, pitch wear, ball wear (swing, reverse, grip)
    weather.js        the five weathers, what each does to the pitch and outfield, each ground's climate
    rain.js           rain stopping play: when, the overs lost, the revised target
    bowling-side.js   over/around release geometry and follow-through position
    delivery.js       bowling: release, swing, seam, spin, bounce, flight
    runup.js          the player's run-up and release meter: rhythm, ramp, stride surges
    bat-impact.js     blade contact coordinates, toe/splice rebound and continuous edge deflection
    shot-timing.js    shared normal/power backlift durations for input and animation
    batting.js        the shot: timing, where the bat goes, edges, LBW, bowled
    shot-choice.js    which shot suits which ball: front or back foot, the back-foot shot
    shot-direction.js where a shot goes and what it's called, finding the gap
    describe.js       where a shot went, as commentators say it, and its scoring zone
    over-review.js    a line on how an over went, from where it pitched and how he read it
    bouncer-law.js    too many bouncers: the no-ball, the warning, taking the bowler off
    rhythm.js         the player's run-up rhythm: the beats graded, and what it does to the ball
    eye.js            every batter's eye: built by well-timed shots, dented by misses and edges
    plans.js          the battle with the bowler: hidden weaknesses, memory of recent balls
    scouting.js       reading a batter's weakness from how he plays it: a hint, then given away
    ball-in-play.js   after the shot: the ball's flight, who fields it, boundaries, the outcome
    ball-roll.js      a free ball in the air and along the ground: drag, bounce, friction
    running.js        the batters' running: calling and abandoning runs, who's at risk, the computer's calls
    fielder-motion.js how fielders move: accelerating, turning, easing up, set, dive/get up, walking in
    fielder-ai.js     who chases the ball, who cuts it off, who covers the stumps
    fielder-catch.js  catches, stops and fumbles when the fielder gets to the ball
    fielder-throw.js  release time, stumps or back to the bowler (relayed from the deep), shies, wild throws; the throw arriving (run-outs)
    fielding-calls.js the player's calls while fielding: a timed press for a catch, the throw's end
    field.js          field presets and position names
    ai.js             computer bowler, field, delivery and shot choices
    innings.js        scorebook, cards, strike, bowler fatigue
    match.js          plays innings ball by ball, swaps sides, works out the result
    formats.js        game formats and Classic Match challenges (data)
    test-match.js     Tests: the five-day clock, declarations, the follow-on, the result or draw
    coach.js          the nets coach: a verdict on every ball faced or bowled
    leaderboard.js    high-score entries from a result, and how they rank
    call.js           the score bar's plain call: what was bowled, the shot, the result
    commentary.js     simulation commentary records, over summaries and sledges
    moments.js        spots situations worth talking about (droughts, pressure, near run-outs...)
    commentary-narrative.js  the innings' running story (spells, partnerships, pressure) for the box
    over-summary.js   a recap of the over just bowled
    commentators.js   commentary voices and compatible booth entry points
    booth-editor.js   every-ball call plus an optional contextual second voice
    booth-caller.js   factual outcome classification and fresh primary calls
    booth-dot-lines.js  voice-specific calls for leaves, blocks and other dots
    booth-scoring-lines.js  voice-specific runs, boundaries and extras calls
    booth-wicket-lines.js  voice-specific dismissal calls
    booth-context.js  read-only match situations and story priorities
    booth-stories.js  personality-specific analysis, reactions and banter
    booth-chat.js     between-balls chat topics for the box
    booth-policy.js   final HPD duplication and booth line validation
    booth-beats.js    the ball's beats: start of the over, the setup as he runs in, the delivery at the bat
    booth-moment-lines.js  lines for moments.js's ducks, maidens, big overs, jaffas, the equation...
    booth-drs-lines.js  the LBW decision and the review in stages: given, reviewed, tracking, verdict
    booth-venue-lines.js  scene-setting: each ground, and the pitch report at the start
    booth-law-lines.js the umpire's bouncer warnings and a bowler taken off
    booth-wrap-lines.js the box's wrap-up over the scorecard at the end of an innings or match
    booth-weather-lines.js the box on the weather, lunch, tea and stumps, and the call to declare
    field-reading.js  what the field says about the plan (slips, bat-pad, boundary riders, the ring)
    broadcast-context.js  broadcast pressure and tactics stories from the ball and the narrative
    broadcast-lines.js  each voice's broadcast and colour lines
    field-chatter.js  fielders' send-offs and chirps, in each side's own voice
    pack-voice.js     picks commentary-pack lines that are true of the ball, fresh each time
    commentary-pack/  the commentary pack (v1): its lines as JSON, with its own README, checks and integration notes
  render/             drawing, no game rules in here
    camera.js         projections for the close (either end) and wide views
    stadium-camera.js the MCG stadium image's measured wide projection
    grounds.js        grounds as data: stripe layout, colours, pitch looks, which paintings to use
    ground.js         the layer compositor: builds each view's background from a ground's data
    ground-paint.js   the compositor's kit: pitch sizes, colour helpers, noise, scenery layers, cracks
    stadium-ground.js a ground built round a stadium image (the MCG's wide view)
    light.js          times of day: tint, sky glow, stand shadows, shadow length, and each one's HD-2D look
    skins.js          skins as data: each team's kit beyond its colours, and player builds
    lighting.js       the HD-2D look: frame grading, dusk and night skies, dimmed scenery, floodlights, shadow direction
    sprites.js        the ball and its shadow; re-exports kit.js, batter/batter-rig.js and figures.js
    kit.js            kit colours, a player's looks (skin, hair, beard, height), mirroring, shadows
    figures.js        everyone else close up: bowler, keeper, fielders, umpires, runners
    figure-poses.js   where a close figure's feet and hands go for each pose
    tiny-figures.js   the wide view's tiny figures, and the pose a fielder's state shows
    bowler-motion.js  where the bowler is through a ball, on the chosen side: his action for the close view, poses for the wide
    keyframes.js      keyframed motion on smooth curves, shared by the batter's and bowler's rigs
    bowler/           the bowler
      bowler-styles.js  the five actions as data: timing, distances, angles from take-off to follow-through
      bowler-action.js  his pose through a ball: the run-up's gait, the keyed delivery, standing
      bowler-skeleton.js  joints from the pose: legs and arms solved, the bowling arm straight
      bowler-draw.js    drawing him in pixel style from either end
    batter/           the striker
      batter-rig.js     pixel-art striker drawing; re-exports poses and the projected rig for older callers
      batter-poses.js   legacy stances, pose blending and whole-body reach
      batter-skeleton.js  canonical XYZ joints, fixed-length 3D IK, planted feet and rigid hand grip
      batter-projection.js  either close-camera view of the same skeleton, limb depth order and bat faces
      rig-3d.js         vector math and two-bone hinge solves for visual rigs
      bat-mesh.js       the rigid 3D willow blade carried by the solved hands
      bat.js            draw the projected blade faces in depth order on the pixel grid
      batter-surfaces.js  rotating cloth panels and 3D boots, drawn on the pixel grid
      batter-footwork.js  shot-specific steps, planted-toe pivots, hip-led follow-through and recovery
      batter-backswing.js  higher hand lift and shoulder coil before attack contact
      batter-motion.js  the original straight drive, forward defence and pull
      batter-motion-all.js  all 28 stroke clips and the motion player
      batter-shot-extensions.js  composes authored data from batter-shots/
      batter-shots/     drive, back-foot, sweep/ramp and touch-shot pose families
      batter-catalog.js  input-family and shot-label routes to the 28 clips
    hud.js            HUD entry points, mini-map, banners, scorecard, speech bubbles
    score-bar.js      two-line batting/bowling strip with partnership and commentary
    team-flag.js      pixel team flags framing the bottom score strip
    over-balls.js     shaded delivery spheres with runs, wickets and extras
    batter-meters.js  shared eye and pressure panel
    bowling-setup.js  target-aiming panel and over/around selector
    match-broadcast.js DRS tracking, verdict cards and celebrations, and the review's timings
    ball-trail.js     the delivery's fading trail and the pitch-map landing reticle (close view)
    feedback.js       arcade feedback drawn: timing meter and callout, floating words, eased bars
    booth.js          commentator portraits and the commentary popup
    ball-ring.js      the ring round the ball in flight: length and movement
    pitch-map.js      a pitch map: where balls pitched, by what came of them
    over-summary.js   the end-of-over summary while the player bowls
    weather-icon.js   pixel weather icons (the HUD's beside the score box, and the report's)
    weather-report.js the weather report panel before play and each Test morning, and the rain stoppage's
    weather-look.js   the weather laid over a time of day: tint, sky, clouds, shadows, haze
    rain.js           rain falling, and the covers on the pitch
    team-sheet.js     a team's flag and XI on the team-selection screen
  scenes/
    menu.js           title screen
    menu-teams.js     the menu's team-selection page: your side and the computer's
    match.js          the match scene: state, phases, camera, banners
    match-update.js   one frame of the match scene: pause and camera keys, then the phase's update
    match-shadows.js  the close view's cast shadows, laid before anyone is drawn
    effects-auto.js   the effects setting; AUTO steps down to SIMPLE on a slow machine
    player-actions.js every player decision as a message (swing, bowl, review...): the one way input changes the match
    match-ball.js     a ball's life: next ball, release, dead ball, completing it, the walk back, simulating
    match-flight.js   the ball in flight: contact, the ball in play, its events, run calls
    match-setup.js    between balls: bowling setup, choosing a bowler, field editing
    match-input.js    the player's controls: shots, defence, leaving, footwork, aiming, the run-up
    match-decisions.js  LBW appeals, the umpire's decision and DRS reviews
    match-test.js     Tests and the weather in the scene: the report, breaks, declaring, the follow-on choice
    bowling-advice.js the keeper's suggested ball while the player bowls
    ball-ring.js      what the ring round the ball shows: the batter's read, or the truth
    match-ending.js   the end of an innings: the end screen's words, the wrap-up, a Classic won
    match-light.js    the light through the day, with the weather over it; the ball's colour
    assists.js        the assist level (EASY, NORMAL, HARD) and what each changes
    match-rain.js     rain stopping play in the scene: the covers, the panel, carrying on
    match-feedback.js what feedback to show and when: shot words, +/-EYE and PRESSURE, hit-stop, shake
    match-audio.js    contact timbres and broadcast sound cues
    strike-presentation.js  full-pace launch after contact and the close-to-wide broadcast cut
    celebrations.js   skipping a wicket's or boundary's celebration
    broadcast-commentary.js  the box's call for each ball
    booth-beats.js    when the box speaks: before the over, as he runs in, at the bat, the result, the review
    bowling-side.js   per-bowler side selection and setup controls
    batter-pose.js    the striker's pose through a ball: stance, trigger, backlift, strokes, follow-throughs
    batter-blend.js   how a stroke joins the stance either side of it, eased in and out
    batter-stroke.js  presentation-only selection and the existing attack/block/leave clocks
    match-view.js     drawing for the match scene: the close and wide views
    match-wide.js     the wide view: the whole ground with everyone as small figures
    match-positions.js where the non-striker and bowler are, shared by both views
    match-striker.js  where the striker is drawn, and the blade onto the ball at contact
    match-panels.js   the panels over the picture: setup, speed gun, meters, coach card, release meter, feedback
    audio-mix.js      pause-menu controls for effects, crowd and broadcast volumes
    pause-menu.js     the Esc menu: scorecard, instructions, sound
    scoreboard.js     the arcade high-score screen: name entry and the table
netlify/
  functions/scores.mjs  the shared high-score service on Netlify (/api/scores)
  score-table.mjs       its tables: checks scores, keeps each table's best 200, safe against saves at once
tools/                frame sheets (bowler-sheet.mjs, with tools/sheets/), balance reports (sim-report.mjs; bowling-report.mjs for the player's bowling, test-report.mjs for Tests, weather-report.mjs per weather), one-file build, art generators (tools/art/), tests (*.test.mjs), batter-snaps.mjs (animation jolts)
```

The rule of thumb: `sim/` knows nothing about the screen, `engine/` knows nothing about cricket, and
`scenes/` connects them.

### World coordinates

Metres. The striker's stumps are at the origin and the bowler's stumps at `z = 20.12`. `x` runs across
the pitch, positive towards the off side (the batters are right-handed), and `y` is height. Bearings are
in degrees from the striker's stumps: 0 is straight back past the bowler and positive is the off side.

### Where to start for common changes

- **Ball physics and difficulty:** `sim/delivery.js` (how balls are bowled) and `sim/batting.js` (timing
  windows, edges, LBW); which shot suits a ball in `sim/shot-choice.js`, where it goes in `sim/shot-direction.js`.
- **Player ratings and squads:** `sim/teams.js`.
- **Pitch behaviour:** `PITCH_TYPES` in `sim/conditions.js`.
- **AI tactics:** `sim/ai.js`.
- **Fielding and running:** `sim/ball-in-play.js`; the batters' running in `sim/running.js`; fielders' movement,
  choices, catching and throwing in `sim/fielder-motion.js`, `fielder-ai.js`, `fielder-catch.js` and `fielder-throw.js`.
- **What's shown on screen:** `scenes/match-view.js` (the close view) and `match-wide.js`, `match-striker.js`,
  `match-panels.js` and `render/`.
- **A new player control:** turn the key into an action in `scenes/player-actions.js` (see the rule in CLAUDE.md).
- **Left-handers:** a player's `hand` in `sim/teams.js`; the sim works in the striker's frame (`sim/handedness.js`),
  and `render/camera.js` `setFacing` mirrors it back to the world for the views. World-fixed things (bowler, umpire,
  non-striker, footmarks, the sun) are drawn at `x * viewFacing()`.
- **Fielding calls:** the player's catch press and throw call in `sim/fielding-calls.js`, sent as player actions.
- **Lighting and time of day:** each time's numbers, and its HD-2D look (`hd`), in `render/light.js`; how they're drawn in
  `render/lighting.js`. Floodlight heads are `lamps` on a ground's art layers in `render/grounds.js`. The menu's
  EFFECTS row picks AUTO, FULL, SIMPLE (grading and skies, round shadows) or OFF (the plain look).
- **Bowler animation:** each style's action is data in `render/bowler/bowler-styles.js` (the event times, distances
  and angles); `render/bowler/bowler-action.js` turns it into a pose. Review it with `node tools/bowler-sheet.mjs <dir>`
  (with a local server running) and **G** for slow motion in a match.
- **Batter animation:** which pose or stroke when, in `scenes/batter-pose.js`; the poses, skeleton and drawing in
  `render/batter/batter-poses.js`, `render/batter/batter-skeleton.js` and `render/batter/batter-rig.js`;
  the skeleton has X across the pitch, Y up and Z towards the bowler, in local rig units (94 units per 1.8 m).
  `render/batter/batter-projection.js` projects the same joints from either end; `batterJointToWorld` converts a joint
  to match-world metres for visual tools. Clips can author `frontFootZ`, `backFootZ`, `pelvisZ`, `chestZ`, `headZ`
  and `handZ`; existing clips receive inferred depth keyframes. The rigid blade mesh is in `render/batter/bat-mesh.js`,
  with pixel drawing in `render/batter/bat.js`. `render/batter/batter-footwork.js` adds shot-specific strides, toe pivots
  and hip-led follow-through; `render/batter/batter-surfaces.js` makes cloth and boots follow those turns.
  These joints are visual and do not replace simulation contact physics;
  the expanded sampler in `render/batter/batter-motion-all.js` and poses in `render/batter/batter-shots/`;
  stroke selection and timing in `scenes/batter-stroke.js`, with routes in `render/batter/batter-catalog.js`.
- **Game modes and Classic Matches:** `sim/formats.js` (challenges are plain data). AI chase and
  limited-overs tempo constants are at the top of `sim/ai.js`, with the Test-batting ones.
- **Tests and the weather:** the clock, declarations, follow-on and result in `sim/test-match.js` (check balance with
  `node tools/test-report.mjs`); each weather's effects and each ground's climate in `sim/weather.js`
  (`node tools/weather-report.mjs`); the scene's side in `scenes/match-test.js`. Rain stopping play in `sim/rain.js`
  and `scenes/match-rain.js`; how each weather looks in `render/weather-look.js`; when the light changes in
  `scenes/match-light.js`.
- **Ground art:** images live in `assets/` (layer art in `assets/close/`), listed by id in `src/assets.js`;
  grounds pick their layers in `src/render/grounds.js` (`hidden: true` keeps a ground off the menu; The Oval is
  hidden for now). `tools/art/make_scenery.py` regenerates the
  Parklands close-view layers. `python3 tools/art/make_lords.py` regenerates Lord's six close/wide scenery layers
  (requires Pillow). `python3 tools/art/make_scg.py` regenerates SCG’s six close/wide layers, with seating
  tight to the advertising boards (also Pillow). `python3 tools/art/make_lakshmi.py` generates Lakshmi Bluff’s
  eight Himalayan scenery layers; selecting this ground defaults the pitch to DUST BOWL. `tools/art/make_theg.py` makes The G's close-view layers (in `assets/theg/close/`). `python3 tools/art/make_perimeters.py` generates the five wrapping wide-view rims (the MCG's wide view is its stadium image),
  reading the boundary ellipse from `src/render/camera.js`. Each ground selects a `wide.perimeter` asset;
  these layers leave the playing area transparent and keep the full boundary above the HUD. The rim
  curves around the far side too, with the original pavilion, Media Centre and scoreboard artwork
  preserved at its existing coordinates. The generator reuses the Lord's and SCG pavilion helpers.
  The camera uses the same ellipse for fielders, ball positions and inverse field-placement coordinates; the world
  boundary stays 66 m. A ground with `light` set picks that light on the menu when chosen.
- **One-file builds:** `python3 tools/build-single.py out.html [--ref main] [--stamp]` bundles the game
  with its images inlined (needs esbuild).
- **Tests:** `npm test` runs every `tools/*.test.mjs` (node's built-in runner; no packages needed).
- **Balance checks:** `node tools/sim-report.mjs [innings] [pitch]` simulates AI-vs-AI innings and prints
  run rates, dismissals, plan figures and commentary moments.
- **Commentary:** each ball is called in beats: the start of the over and the setup before it, the delivery
  as it reaches the bat, the result joined on as one sentence, then the second voice's reset (timed by
  `scenes/booth-beats.js`, worded in `sim/booth-beats.js`, `booth-venue-lines.js`, `booth-drs-lines.js` and
  `field-reading.js`). `sim/call.js` owns the factual HUD play description (HPD). The booth (BC) is selected
  by `sim/booth-editor.js`: every ball gets a primary call from `sim/booth-caller.js`, using the established
  328-line ball-call bank and 354 additional voice-specific lines in `sim/booth-*-lines.js`. A second voice
  can add analysis from read-only situations in `sim/booth-context.js` and personality-specific stories in
  `sim/booth-stories.js`. Wording and topic memory avoid recent repetition; when a primary pool is exhausted,
  the least recently used safe line is allowed back. HPD text is never used as a fallback.
  `sim/booth-policy.js` rejects duplicate HPD text both at selection and display. The legacy duplicate generator remains removed.
  `sim/commentary.js` is a facade owning one
  narrative tracker and booth per match; it re-exports the new `LINES` and `COLOUR_LINES` banks.
  `sim/commentary-narrative.js` reads every applied ball, including AI simulations, without changing
  cricket state or drawing random numbers. It tracks each batter's legal dot streak, the current
  over, approaching milestones and observed pitch/bounce changes. `sim/broadcast-context.js`
  ranks this evidence; `sim/broadcast-lines.js` holds the three voices' wording. Pressure escalates
  after 4, 8 and 12 dots faced, once per rung per streak. Milestone and field observations have
  cooldowns; custom fields do not inherit preset claims. Selected AFTERNOON/EVENING lighting can
  prompt an observation, but there is no invented day, session or weather clock.
  `sim/booth-chat.js` provides end-of-over recaps: team runs from the over (including extras),
  bowler overs/maidens/wickets/runs, and match score. The outgoing voice recaps before the change
  of ends; long recaps use multiple panels rather than truncating figures. `getOverSummary(inn, over)`
  accepts a tracked snapshot or a zero-based completed over number. Partial starting overs are
  labelled as runs since resumption. `sim/over-summary.js` provides the older summary fallback;
  fielder send-offs and chirps are in `sim/field-chatter.js`. `sim/commentators.js` keeps portrait
  identities and compatible `boothCall`, `boothChat`, `boothJoke` entry points;
  `Commentary.remember` accepts both `(rec, inn)` and `(rec, batter, bowler)`. The v1 pack is retained as a source archive;
  only its `ball_calls.json` bank is loaded by the game.
  Run `node tools/commentary-narrative.test.mjs`, `node tools/booth-caller.test.mjs` and `node tools/booth-editor.test.mjs` to check every-ball coverage,
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

### MCG wide-view prototype

The MCG wide view uses the afternoon stadium composition in
`assets/theg/wide/afternoon-stadium.png`. `render/stadium-camera.js` defines an
orthographic camera calibrated to its inner parapet; `render/stadium-ground.js`
draws the circular field, 30 m ring, true-scale pitch and creases through that
same projection. The generated image has a pale field placeholder, which the
renderer replaces with opaque playable turf. Field editing uses the inverse
camera. Other venues retain the original wide mapping; the close batting camera
and its artwork remain separate. Selecting THE MCG defaults to AFTERNOON.

For a visual test, select THE MCG, start a match and press C twice to lock WIDE
(AUTO → CLOSE → WIDE). The true-scale pitch is deliberately smaller than the
older exaggerated wide pitch. The artwork is an afternoon composition; changing
the lighting option tints it but does not replace the baked sky or architecture.
