/**
 * The commentary box: three voices who take turns at the microphone, an over
 * each. Big moments get the man on duty's own line; ordinary balls get the
 * generic description, now and then swapped for a quiet aside.
 * Placeholders: {b} batter, {w} bowler, {f} fielder, {m} milestone.
 */
export const COMMENTATORS = [
  {
    id: "bunnings",
    name: "RICHIE BUNNINGS",
    lines: {
      wicket: [
        "GOT HIM. {w} WILL BE QUIETLY PLEASED WITH THAT.",
        "AND THAT'S THE END OF {b}. A SHOT HE'D LIKE BACK.",
        "OUT. MARVELLOUS BOWLING, THAT.",
        "{b} GOES. I DON'T THINK I NEED TO ADD ANYTHING.",
      ],
      six: [
        "UP... AND INTO THE CROWD. MARVELLOUS.",
        "THAT'S GONE A VERY LONG WAY. SIX.",
        "{b} HAS PUT THAT IN THE SECOND TIER. DELIGHTFUL.",
      ],
      four: ["FOUR. AND NOBODY MOVED.", "CRISPLY STRUCK. FOUR.", "A LOVELY SHOT. THE FIELDERS SIMPLY WATCHED IT GO."],
      beaten: [
        "BEATEN. QUITE BEAUTIFULLY.",
        "PAST THE EDGE. {w} MIGHT ALLOW HIMSELF A SMILE.",
        "THAT ONE LEFT HIM. LOVELY BOWLING.",
      ],
      dropped: ["OH DEAR. {f} WILL BE HEARING ABOUT THAT ONE.", "DOWN. THAT COULD BE AN EXPENSIVE MOMENT."],
      milestone: ["{m}. AND RICHLY DESERVED.", "{m}. A MARVELLOUS EFFORT."],
      quiet: [
        "A QUIET PASSAGE. THE SEAGULLS ARE ENJOYING IT.",
        "NOTHING HAPPENING. SOMETIMES THAT'S THE BEST THING IN CRICKET.",
        "THE SHADOWS ARE LENGTHENING. MARVELLOUS LIGHT.",
      ],
    },
  },
  {
    id: "lorry",
    name: "BILL LORRY",
    lines: {
      wicket: ["GOT HIM! YES! GOT HIM!", "HE'S GONE! {b}'S GONE! WHAT A MOMENT!", "OUT! OUT! THE CROWD IS GOING BERSERK!"],
      six: ["IT'S A SIX! IT'S GONE ALL THE WAY! OH MY WORD!", "BANG! UP INTO THE STANDS! WHAT A HIT!"],
      four: ["FOUR! CRACKED AWAY! WHAT A SHOT!", "THAT'S RACED AWAY! THEY'LL NEVER CATCH THAT!"],
      beaten: ["OH! JUST MISSED! WHAT A DELIVERY!", "BEATEN! BEATEN ALL ENDS UP!"],
      dropped: ["OH NO! HE'S DROPPED IT! HE'S PUT IT DOWN!", "DROPPED! I CAN'T BELIEVE IT!"],
      milestone: ["{m}! WHAT A KNOCK! THEY'RE ON THEIR FEET!", "{m}! TREMENDOUS! ABSOLUTELY TREMENDOUS!"],
      quiet: [
        "I'VE BEEN WATCHING THE PIGEONS DOWN AT FINE LEG. LOVELY BIRDS.",
        "IT'S ALL HAPPENING! WELL, NOT RIGHT NOW. BUT IT WILL!",
      ],
    },
    // Lines for barging in on someone else's over when a wicket falls.
    jumpIn: ["GOT HIM! YES! SORRY RICHIE, GOT HIM!", "HE'S GONE! YES! I HAD TO SAY IT!", "OUT! YES! WHAT A MOMENT!"],
  },
  {
    id: "grog",
    name: "TONY GROG",
    lines: {
      wicket: [
        "AND {w} HAS DONE HIM. THAT'S A MASSIVE BLOW.",
        "{b} IS ON HIS WAY. I SAID THIS MORNING THE PITCH WOULD DO IT.",
        "THAT'S THE BREAKTHROUGH. RIGHT WHEN THEY NEEDED IT.",
      ],
      six: ["THAT IS HUGE! RIGHT OUT OF THE GROUND!", "OH, HE'S MURDERED THAT ONE!"],
      four: ["SUPERB. THE TIMING IS SWEET AS YOU LIKE.", "FOUR. THROUGH THE GAP LIKE A SPORTS CAR."],
      beaten: ["BEATEN! THAT'S DONE A LITTLE OFF THE SEAM.", "NEARLY THROUGH THE GATE. LOOK AT THAT MOVEMENT."],
      dropped: ["OH, THAT'S A SITTER! MY GRANDMOTHER HOLDS THAT.", "DROPPED. THAT COULD COST THEM DEARLY."],
      milestone: ["{m}. A TERRIFIC INNINGS.", "{m}. HE'S PLAYED BEAUTIFULLY."],
      quiet: [
        "LET'S HAVE A LOOK AT THE PITCH. I'VE GOT MY CAR KEY HERE.",
        "THE PITCH IS HOLDING UP NICELY. NOT A CRACK TO LOSE A KEY IN.",
      ],
    },
    sixSpecial: "MIND THE WINDOWS, TINO!",
  },
];

const LORRY = 1;
const GROG = 2;
/** How often Lorry barges in on a wicket in someone else's over. */
const LORRY_JUMPS_IN = 0.3;
/** Share of sixes Tony claims for his catchphrase, whoever is on. */
const GROG_SIX_SHARE = 0.3;
/** How often an ordinary ball gets a quiet aside instead of the description. */
const QUIET_CHANCE = 0.12;

/**
 * Who speaks after a ball, and what they say: { who, text }.
 * `generic` is the ball-by-ball description; `names` fills placeholders.
 */
export function boothCall(rec, milestones, generic, names, rng) {
  const duty = rec.over % COMMENTATORS.length;
  const fill = (text) =>
    text
      .replace(/\{b\}/g, names.batter)
      .replace(/\{w\}/g, names.bowler)
      .replace(/\{f\}/g, names.fielder || "THE FIELDER")
      .replace(/\{m\}/g, milestones[0] ?? "")
      .toUpperCase();
  const say = (who, kind) => ({ who, text: fill(rng.pick(COMMENTATORS[who].lines[kind])) });

  if (rec.wicket) {
    if (duty !== LORRY && rng.chance(LORRY_JUMPS_IN)) {
      return { who: LORRY, text: fill(rng.pick(COMMENTATORS[LORRY].jumpIn)) };
    }
    return say(duty, "wicket");
  }
  if (rec.dropped) return say(duty, "dropped");
  if (milestones.length) return say(duty, "milestone");
  if (rec.boundary === 6) {
    if (rng.chance(GROG_SIX_SHARE)) return { who: GROG, text: COMMENTATORS[GROG].sixSpecial };
    return say(duty, "six");
  }
  if (rec.boundary === 4) return say(duty, "four");
  if (rec.beatBat) return say(duty, "beaten");
  if (rng.chance(QUIET_CHANCE)) return say(duty, "quiet");
  return { who: duty, text: generic.toUpperCase() };
}
