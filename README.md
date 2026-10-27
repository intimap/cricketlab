# Cricket Lab

A 16-bit style Test cricket game (Australia v England) for the browser. Bat or bowl through a spell on a
green top, a dust bowl or a cracked pitch, with a physics-based ball, wearing pitch and ageing ball,
AI field placings and ball-by-ball commentary.

Plain JavaScript modules and two images: no build step and no dependencies.

## Run it

The game uses ES modules, so it has to be served over HTTP (opening `index.html` from disk won't work).
From the repo folder, either of these works:

```sh
python3 -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000. It needs a keyboard.

To publish it, turn on GitHub Pages (Settings → Pages → Deploy from branch → `main`, `/ (root)`).

## Controls

|               |                                                                                                                                                                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menu          | Arrows to change, Enter to start                                                                                                                                                                                                                                                                                                 |
| Batting       | Space to face up. **S** drive, **Q** cut/pull, **W** loft, **A** defend, no key = leave. Arrows held when you play aim the shot. Hold **↓** with **W** to ramp over the keeper, or **↓** + **←**/**→** with **Q** to sweep / reverse sweep. Hold **Shift** for a power shot (play it earlier). **↑** / **↓** to run or turn back |
| Bowling       | Arrows set line and length (Shift = fine), number keys pick the delivery, **E** effort, **F** field preset, **V** drag fielders with the mouse, **N** new ball (after 80 overs). Space to run in, Space again to release at the delivery stride: early pitches it shorter, late fuller, very late is a no-ball                   |
| Between balls | **O** sim an over, **P** sim 5 overs, **V** view the field                                                                                                                                                                                                                                                                       |
| Appeals       | **H** to appeal for LBW when bowling (appealing for nothing irritates the umpire). **R** to review a decision that goes against you (two unsuccessful reviews per innings)                                                                                                                                                       |
| Anytime       | **C** camera, **M** sound, **Esc** pause and scorecard                                                                                                                                                                                                                                                                           |

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
    audio.js          synthesised sound effects and crowd
  sim/                the cricket model, no drawing in here
    geometry.js       pitch dimensions and the world coordinate system
    rng.js            seedable random numbers
    teams.js          squads and player ratings
    conditions.js     pitch types, pitch wear, ball wear (swing, reverse, grip)
    delivery.js       bowling: release, swing, seam, spin, bounce, flight
    batting.js        the shot: timing, where the bat goes, edges, LBW, bowled
    ball-in-play.js   after the shot: fielders, catches, throws, running, run-outs
    field.js          field presets and position names
    ai.js             computer bowler, field, delivery and shot choices
    innings.js        scorebook, cards, strike, bowler fatigue
    commentary.js     ball-by-ball description, over summaries and sledges
    moments.js        spots situations worth talking about (droughts, pressure, near run-outs...)
    commentators.js   the commentary box: who speaks after each ball
    booth-lines.js    each commentator's lines for every situation
    match.js          plays innings ball by ball, swaps sides, works out the result
    formats.js        game formats and Classic Match challenges (data)
    runup.js          the player's run-up and release meter: rhythm, ramp, stride surges
    coach.js          the nets coach: a verdict on every ball faced or bowled
  render/
    camera.js         projections for the close (either end) and wide views
    sprites.js        batter, figures, ball
    hud.js            score bar, mini-map, banners, scorecard, speech bubbles
    booth.js          commentator portraits and the commentary popup
    grounds.js        grounds as data: stripe layout, colours, pitch looks, which paintings to use
    ground.js         the layer compositor: builds each view's background from a ground's data
  scenes/
    menu.js           title screen
    match.js          the match: phases, player input, timing, events
    match-view.js     drawing for the match scene
    pause-menu.js     the Esc menu: scorecard, instructions, sound
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
- **Game modes and Classic Matches:** `sim/formats.js` (challenges are plain data). AI chase and
  limited-overs tempo constants are at the top of `sim/ai.js`.
- **Ground art:** images live in `assets/` (layer art in `assets/close/`), listed by id in `src/assets.js`;
  grounds pick their layers in `src/render/grounds.js`. `tools/art/make_scenery.py` regenerates the
  Parklands close-view layers.
- **One-file builds:** `python3 tools/build-single.py out.html [--ref main] [--stamp]` bundles the game
  with its images inlined (needs esbuild).
- **Balance checks:** `node tools/sim-report.mjs [innings] [pitch]` simulates AI-vs-AI innings and prints
  run rates, dismissals, plan figures and commentary moments.
- **Commentary:** `sim/commentary.js` for the ball-by-ball description; `sim/moments.js` to spot a new
  kind of situation, then give each commentator lines for it in `sim/booth-lines.js`.
