# To do

Planned work, roughly in order. Each item says its expected usage (see CLAUDE.md).

## Commentary

Source: the Sideline "Cricket Commentary Guide" (ball-by-ball cycle, over structure, reading the game,
milestones, DRS). Today the box speaks once a ball, *after* the result (a primary call and sometimes a
second voice), plus an end-of-over recap. Everything below builds on that.

### 1. Voice the moments that go unsaid — Medium
`sim/moments.js` detects 36 kinds of moment; 18 are never said since the old commentary systems were
removed: golden duck, long duck, duck, bowler's third, shy missed, three in a row, back to back, into the
nineties, team milestone, chase equation, big over, tight spell, maiden, maiden again, beaten again,
jaffa, rapid, big swing, big turn. Add them to `sim/booth-context.js` with lines per voice (the v1 pack's
`match_context.json` has material to adapt). Also: a moment that ends an innings or matches an earlier
check hides a lower one (a collapse completed by a five-for is only the five-for) — allow a second-voice
mention of the other.

### 2. The four-beat ball: setup, delivery, result, reset — High
The guide's cycle, mapped to the game's phases:
- **Setup** (run-up, `runup` phase): the bowler running in, from which end, with the field or the
  situation now and then. "Cummins steams in from the Pavilion End—". Needs end names per ground in
  `render/grounds.js` data (or "from the far end" by default).
- **Delivery** (release to the bat): line, length and type, cut off by the result. "—short of a length,
  outside off—". *Decide:* when the player is batting, calling the length before he plays is a help, so
  either call it at the bat (as the ball arrives) or only when the player bowls / the AI bats.
- **Result**: today's primary call, joined on from the delivery call ("—CUT! Four!") so the three read as
  one sentence across the beats.
- **Reset** (the walk back, `return` phase): the second voice's analysis, stats, the state of the battle;
  longer in long formats, short and punchy in short ones.
The box popup (`render/booth.js`) needs to show a call that grows across the beats, and `scheduleCalls`
timings tied to phases rather than one burst after the ball.

### 3. Start of the over — Medium
Name the bowler, his figures and the field as the over begins: "Rashid to bowl his eighth—two for 23.
Two slips in place." Pairs with the end-of-over recap (`sim/booth-chat.js`), which already exists.

### 4. Reading the field and the plan — Medium
`fieldPlan` exists but is generic. Read the actual placings: slips and gully (hunting the edge), short leg
and silly point (bat-pad), deep midwicket and long-on back (expecting the pull or the slog), fine leg up
(cutting off the single). Say it at setup or reset, and when the captain changes the field.

### 5. Bowling changes, new ball and phases of the innings — Medium
- Explain a bowling change: spin on because of turn, the strike bowler back for a set batter on 87, a
  part-timer to break a stand.
- New ball: "due in three overs", then taken (the game offers it after 80 overs).
- Phases: the new-ball period, consolidation, acceleration (limited overs), death overs with required-rate
  talk; energy rising towards the death of a chase.

### 6. DRS commentary — Medium
The review is shown (`render/match-broadcast.js`) but the box is silent. Call it in stages: the finger
goes up / the batter reviews; edge or no edge; pitching, impact, hitting; the verdict, umpire's call
explained ("more than half the ball hitting to overturn").

### 7. Scene-setting and atmosphere — Medium
Venue lines per ground (the MCG crowd, Lord's, the SCG, Lakshmi Bluff's mountains), the pitch report at
the start (green top / dust bowl / cracks: the blurb exists, the box doesn't say it), the light as the
afternoon goes on. Facts only: the game has no days, sessions or weather, so no invented ones.

### 8. Energy and variety — Low to Medium
- Match energy to the moment: quieter wording through dot-ball passages, bigger at the death of a chase
  (the box is all capitals now; vary punctuation and length rather than case).
- Check each common outcome has plenty of ways to say it ("how many ways can you describe a dot ball?
  You'll need at least twenty"), starting with dots, singles and leaves.

### Not applicable to the game (yet)
Sessions and days, drinks breaks, rain and DLS, declarations and the follow-on, net run rate, venue
records and career stats: the game has none of these to talk about.
