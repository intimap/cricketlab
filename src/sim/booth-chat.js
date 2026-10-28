/**
 * Talk in the box between overs: one voice raises something true about the
 * game so far (where a batter scores, how a bowler is going, the pitch, the
 * chase, a drop that's proving costly), and another answers. When there's
 * nothing much to say, they tell stories.
 *
 * Placeholders: {b} batter, {p} his partner, {w} bowler, {f} fielder,
 * {zone} a scoring area, {n} {r} {balls} {need} {left} numbers, {figs} a bowler's figures.
 * Pace and movement stay on the speed gun; everything else can be quoted.
 */
export const CHAT_TOPICS = {
  zone: {
    mood: "batting",
    bunnings: [
      "{b} HAS FOUND {zone} RATHER TO HIS LIKING. {n} OF HIS {r} HAVE GONE THERE.",
      "IF YOU WANT TO KNOW WHERE {b} SCORES, IT'S {zone}. {n} OF HIS {r}.",
    ],
    lorry: [
      "{zone}! {b} JUST KEEPS FINDING {zone}! {n} RUNS THERE ALREADY!",
      "HAVE YOU SEEN WHERE {b}'S HITTING IT? {zone}, OVER AND OVER!",
    ],
    grog: [
      "LOOK AT THE WAGON WHEEL. {n} OF {b}'S {r} THROUGH {zone}. THEY'VE GOT TO PLUG THAT.",
      "{b} IS FEEDING OFF ANYTHING HE CAN HIT TO {zone}. {n} OF HIS {r}. BOWL SOMEWHERE ELSE.",
    ],
  },
  tooShort: {
    mood: "bowling",
    bunnings: ["{w} HAS BEEN A SHADE SHORT THIS SPELL. THE BATTERS HAVE HAD TIME TO SEE IT.", "TOO SHORT, TOO OFTEN, FROM {w}."],
    lorry: ["{w} KEEPS BANGING IT IN! I THINK HE'S ENJOYING IT MORE THAN THE BATTERS ARE!", "SHORT, SHORT, SHORT FROM {w}!"],
    grog: [
      "{w} IS BOWLING TOO SHORT. ON THIS PITCH YOU'VE GOT TO MAKE THEM DRIVE.",
      "PITCH IT UP, {w}. HALF HIS DELIVERIES HAVE BEEN BACK OF A LENGTH OR SHORTER.",
    ],
  },
  tooFull: {
    mood: "bowling",
    bunnings: [
      "{w} HAS BEEN OFFERING A LOT TO DRIVE. GENEROUS OF HIM.",
      "PLENTY OF HALF-VOLLEYS FROM {w}. THE BATTERS AREN'T COMPLAINING.",
    ],
    lorry: ["{w} KEEPS PITCHING IT RIGHT UP! IT'S A BUFFET OUT THERE!", "FULL AGAIN FROM {w}! THEY'RE LINING UP TO DRIVE HIM!"],
    grog: [
      "{w} IS TOO FULL. HE'S CHASING THE SWING AND GIVING AWAY FREEBIES.",
      "PULL IT BACK A METRE, {w}. HE'S BOWLING HALF-VOLLEYS.",
    ],
  },
  tooWide: {
    mood: "bowling",
    bunnings: [
      "{w} IS GIVING THEM A LOT OF WIDTH. IT'S MAKING LIFE RATHER EASY.",
      "TOO WIDE FROM {w}. THEY CAN LEAVE HIM ALL DAY.",
    ],
    lorry: ["{w}'S BOWLING TO THE GULLY FIELDER! COME ON, SON, HIT THE STUMPS!", "WIDE, WIDE, WIDE! I COULD LEAVE THOSE!"],
    grog: [
      "{w} IS TOO WIDE. IF YOU MISS, YOU HIT. HE'S MAKING THEM PLAY AT NOTHING.",
      "THE STUMPS ARE THE OTHER WAY, {w}. MAKE THEM PLAY.",
    ],
  },
  onLength: {
    mood: "pressure",
    bunnings: ["{w} HAS BEEN RELENTLESS. LENGTH, LENGTH, LENGTH.", "THAT'S GOOD, HONEST BOWLING FROM {w}. NOTHING TO HIT."],
    lorry: ["{w} IS LIKE A METRONOME! SAME SPOT, EVERY BALL!", "YOU COULD PUT A HANKY DOWN WHERE {w} IS LANDING IT!"],
    grog: [
      "{w} HAS HIT THE SAME PATCH ALL SPELL. THAT'S HOW YOU BUILD PRESSURE.",
      "TEXTBOOK FROM {w}. TOP OF OFF, OVER AFTER OVER.",
    ],
  },
  expensive: {
    mood: "bowling",
    bunnings: ["{w} HAS {figs} FROM {overs} OVERS. NOT A DAY HE'LL FRAME.", "{figs} FOR {w}. EXPENSIVE."],
    lorry: [
      "{w} IS GOING EVERYWHERE! {figs}! THE CAPTAIN'S GOT A HEADACHE!",
      "{w}, {figs} OFF {overs}! THEY'RE TAKING HIM APART!",
    ],
    grog: ["{w}, {figs} OFF {overs} OVERS. TIME FOR A CHANGE, I'D SAY.", "{w} HAS GONE AT A FAIR CLIP. {figs}. GIVE HIM A REST."],
  },
  miserly: {
    mood: "pressure",
    bunnings: ["{w}: {figs} FROM {overs} OVERS. MISERLY.", "{w}, {figs} FROM {overs}. HASN'T GIVEN THEM A THING."],
    lorry: ["{w} HAS GIVEN AWAY NOTHING! {figs} FROM {overs} OVERS! UNBELIEVABLE!", "LOOK AT {w}'S FIGURES! {figs}! STINGY!"],
    grog: [
      "{w}, {figs} OFF {overs}. HE HAS STRANGLED THEM. THAT'S CONTROL.",
      "{w}'S FIGURES TELL YOU EVERYTHING. {figs} FROM {overs}.",
    ],
  },
  wickets: {
    mood: "bowling",
    bunnings: ["{w} HAS {figs}. A FINE DAY'S WORK SO FAR.", "{figs} FOR {w}. HE'S BEEN THE PICK OF THEM."],
    lorry: ["{w} HAS GOT {figs}! HE'S ON FIRE TODAY!", "WHAT A SPELL! {figs} FOR {w}!"],
    grog: ["{w}, {figs}. HE'S WORKED OUT THIS PITCH QUICKER THAN ANYONE.", "{figs}. {w} HAS BEEN THE DIFFERENCE."],
  },
  grinding: {
    mood: "pressure",
    bunnings: ["{b} HAS {r} OFF {balls} BALLS. HARD YAKKA.", "{r} FROM {balls}. {b} IS IN NO HURRY WHATSOEVER."],
    lorry: ["{b} HAS FACED {balls} BALLS FOR {r}! COME ON, HIT SOMETHING!", "{r} OFF {balls}! I'VE SEEN GLACIERS MOVE FASTER!"],
    grog: [
      "{r} OFF {balls}. {b} HAS GOT TO FIND A WAY TO ROTATE THE STRIKE OR HE'LL GET STUCK.",
      "{b} IS SCRAPPING. {r} FROM {balls}. NOT PRETTY, BUT HE'S STILL THERE.",
    ],
  },
  flowing: {
    mood: "batting",
    bunnings: ["{b} HAS {r} FROM {balls}. EVERYTHING HE TOUCHES TURNS TO RUNS.", "{r} OFF {balls} FOR {b}. EFFORTLESS."],
    lorry: ["{b} IS FLYING! {r} OFF {balls}! YOU CAN'T BOWL TO HIM!", "{r} FROM {balls}! WHAT A KNOCK THIS IS!"],
    grog: ["{r} FROM {balls}. {b} IS PUTTING THE BOWLERS UNDER REAL PRESSURE.", "{b} HAS SEIZED THE MOMENT. {r} OFF {balls}."],
  },
  partnership: {
    mood: "batting",
    bunnings: ["{b} AND {p} HAVE PUT ON {n}. A VALUABLE STAND.", "{n} TOGETHER NOW. {b} AND {p} LOOK SETTLED."],
    lorry: ["{n} FOR THIS PARTNERSHIP! {b} AND {p}! WHAT A PAIR!", "THESE TWO! {n} TOGETHER AND COUNTING!"],
    grog: [
      "{n} TOGETHER. THE FIELDING SIDE NEEDS SOMETHING SPECIAL TO SPLIT {b} AND {p}.",
      "A STAND OF {n}. {b} AND {p} ARE RUNNING HARD BETWEEN THE WICKETS.",
    ],
  },
  cruising: {
    mood: "batting",
    bunnings: ["{need} NEEDED FROM {left} BALLS. NO HURRY.", "THEY NEED {need} OFF {left}. COMFORTABLE, SO FAR."],
    lorry: ["{need} OFF {left}! THEY'RE CRUISING! UNLESS SOMETHING HAPPENS!", "ONLY {need} NEEDED! IT'S IN THE BAG! ISN'T IT?"],
    grog: ["{need} FROM {left}. ALL THEY'VE GOT TO DO IS NOT PANIC.", "{need} OFF {left}. SINGLES WILL DO IT FROM HERE."],
  },
  tight: {
    mood: "pressure",
    bunnings: ["{need} FROM {left}. THIS IS GETTING INTERESTING.", "{need} NEEDED OFF {left}. NOBODY MOVE."],
    lorry: ["{need} OFF {left}! I CAN'T WATCH! I'M WATCHING!", "{need} TO GET FROM {left}! THIS IS WHY WE LOVE THE GAME!"],
    grog: ["{need} OFF {left}. THE NEXT OVER IS EVERYTHING.", "{need} FROM {left}. ONE BIG OVER AND IT FLIPS."],
  },
  steep: {
    mood: "pressure",
    bunnings: ["{need} FROM {left}. A STEEP CLIMB.", "THEY NEED {need} OFF {left}. A LONG WAY TO GO."],
    lorry: ["{need} OFF {left}! THEY'LL NEED A MIRACLE! I BELIEVE IN MIRACLES!", "{need} STILL NEEDED! IT'S A MOUNTAIN!"],
    grog: ["{need} OFF {left}. THEY'VE GOT TO START SWINGING NOW.", "{need} FROM {left}. THE RATE HAS GOT AWAY FROM THEM."],
  },
  turning: {
    mood: "conditions",
    bunnings: [
      "THE PITCH IS TAKING TURN NOW. THE SPINNERS WILL FANCY THIS.",
      "PUFFS OF DUST WHEN IT LANDS. THAT'S A SPINNER'S PITCH.",
    ],
    lorry: ["IT'S SPINNING! IT'S SPINNING LIKE A TOP OUT THERE!", "THE DUST IS FLYING! BRING ON THE SPINNERS!"],
    grog: [
      "THE FOOTMARKS ARE COMING INTO PLAY. ANY SPINNER WORTH HIS SALT WILL AIM AT THEM.",
      "THIS PITCH HAS GONE DUSTY. IT'LL ONLY GET WORSE FOR BATTING.",
    ],
  },
  cracks: {
    mood: "conditions",
    bunnings: [
      "THOSE CRACKS ARE OPENING UP. ONE WILL SHOOT ALONG THE GROUND SOON ENOUGH.",
      "THE CRACKS ARE WIDENING. BATTING WILL GET HARDER.",
    ],
    lorry: ["LOOK AT THOSE CRACKS! YOU COULD LOSE A SMALL DOG DOWN THERE!", "THE PITCH IS FALLING APART! ANYTHING COULD HAPPEN!"],
    grog: [
      "I HAD MY KEY IN ONE OF THOSE CRACKS THIS MORNING. IT'S DEEPER NOW.",
      "HIT THE CRACKS AND THE BALL GOES ANYWHERE. BOWLERS, AIM FOR THEM.",
    ],
  },
  flat: {
    mood: "conditions",
    bunnings: [
      "THE GREEN TINGE HAS GONE. THIS LOOKS A GOOD PITCH TO BAT ON NOW.",
      "THE PITCH HAS FLATTENED OUT. THE BOWLERS WILL HAVE TO WORK.",
    ],
    lorry: ["THE GRASS HAS GONE! IT'S A ROAD! A HIGHWAY!", "THIS PITCH IS AS FLAT AS A PANCAKE NOW!"],
    grog: [
      "THE SEAM MOVEMENT HAS GONE OUT OF IT. NOW IT'S ABOUT PATIENCE.",
      "THE MOISTURE'S GONE. THE BOWLERS HAD THEIR CHANCE THIS MORNING.",
    ],
  },
  reversing: {
    mood: "conditions",
    bunnings: [
      "THE OLD BALL IS STARTING TO REVERSE. QUITE A DIFFERENT CHALLENGE.",
      "REVERSE SWING. THE BATTERS WILL HAVE TO THINK AGAIN.",
    ],
    lorry: ["IT'S REVERSING! THE BALL IS GOING THE WRONG WAY! MAGIC!", "REVERSE SWING! I LOVE IT WHEN IT DOES THAT!"],
    grog: [
      "WATCH THE SHINY SIDE. IT'S REVERSING, AND THE BATTERS HAVE TO PICK IT EARLY.",
      "THEY'VE LOOKED AFTER THAT BALL BEAUTIFULLY. NOW IT'S REVERSING.",
    ],
  },
  softBall: {
    mood: "conditions",
    bunnings: [
      "THE BALL HAS GONE SOFT. IT'S NOT DOING A GREAT DEAL.",
      "AN OLD, SOFT BALL. THE BATTERS WILL BE HAPPY ABOUT THAT.",
    ],
    lorry: ["THAT BALL'S AS SOFT AS A PILLOW NOW!", "THE BALL'S DEAD! THEY NEED A NEW ONE!"],
    grog: [
      "SOFT BALL, FLAT PITCH. THE BOWLERS ARE EARNING THEIR MONEY NOW.",
      "WITH A SOFT BALL YOU'VE GOT TO BUILD PRESSURE. DRY UP THE RUNS.",
    ],
  },
  newBallDue: {
    mood: "conditions",
    bunnings: ["THE NEW BALL IS AVAILABLE. I'D EXPECT THEM TO TAKE IT.", "THE SECOND NEW BALL IS DUE. AN IMPORTANT MOMENT."],
    lorry: ["NEW BALL'S DUE! TAKE IT! TAKE IT NOW!", "A SHINY NEW BALL IS WAITING! I'M EXCITED!"],
    grog: ["THE NEW BALL'S THERE. THEY'D BE MAD NOT TO TAKE IT.", "TAKE THE NEW BALL AND ATTACK. THAT'S WHAT I'D DO."],
  },
  dropCost: {
    mood: "drama",
    bunnings: [
      "{b} WAS DROPPED ON {n}. HE'S NOW {r}. THAT HAS PROVED COSTLY.",
      "{f} WILL BE WATCHING {b}'S SCORE TICK OVER. DROPPED ON {n}, NOW {r}.",
    ],
    lorry: ["DROPPED ON {n}! AND NOW HE'S {r}! WHAT A COSTLY DROP!", "{f} PUT HIM DOWN ON {n}! LOOK AT HIM NOW! {r}!"],
    grog: [
      "THAT DROP. {b} WAS {n} THEN, HE'S {r} NOW. CATCHES WIN MATCHES.",
      "{b}, DROPPED ON {n}, NOW {r}. {f} WON'T SLEEP TONIGHT.",
    ],
  },
};

/** When there's nothing pressing, the old stories come out. Each is told once a match. */
export const STORIES = {
  bunnings: [
    "I REMEMBER A DAY LIKE THIS IN SIXTY-ONE. THE SAME SEAGULLS, I SUSPECT.",
    "MY FIRST TEST, I WAS SO NERVOUS I PUT MY PADS ON THE WRONG LEGS. NOBODY NOTICED. MARVELLOUS.",
    "PEOPLE ASK ME WHAT MAKES A GOOD COMMENTATOR. KNOWING WHEN TO SAY NOTHING.",
    "I ONCE BOWLED A MAIDEN TO MY OWN BROTHER. MOTHER NEVER QUITE FORGAVE ME.",
    "THE BEST CATCH I EVER SAW WAS TAKEN BY A MAN IN THE CROWD. WITH HIS PIE IN THE OTHER HAND.",
    "SOMEONE HAS SENT IN A CAKE. LEMON, I'M TOLD. MOST KIND.",
  ],
  lorry: [
    "I'VE BEEN TOLD I SAY 'GOT HIM' TOO MUCH. I DON'T THINK I DO. GOT HIM!",
    "MY NAN USED TO SAY I'D NEVER MAKE IT IN CRICKET. SHE WAS RIGHT, BUT HERE I AM ANYWAY!",
    "I ONCE FELL OFF THE COMMENTARY BOX ROOF. LONG STORY. WONDERFUL VIEW, THOUGH!",
    "I'VE EATEN FOUR SAUSAGE ROLLS SINCE LUNCH. IT'S BEEN THAT KIND OF SESSION!",
    "SOMEBODY IN THE CROWD HAS A SIGN SAYING HELLO TO ME! HELLO! HELLO!",
    "I PLAYED ONE GAME FOR THE SECONDS. RAN MYSELF OUT WITHOUT FACING. STILL THINK I WAS IN!",
  ],
  grog: [
    "I TOOK MY CAR KEY TO A PITCH IN PERTH ONCE. LOST THE CAR KEY. CRACK SWALLOWED IT WHOLE.",
    "I'VE GOT A THEORY ABOUT THE WIND TODAY. IT'S COMING FROM THE MEMBERS' END. THAT MATTERS.",
    "WHEN I CAPTAINED, I'D SET THE FIELD AT BREAKFAST. NEVER CHANGED IT. WELL, ALMOST NEVER.",
    "I'VE BEEN WEARING THIS HAT FOR TWENTY YEARS. IT'S NEVER BEEN WASHED. LUCKY HAT.",
    "THE GROUNDSMAN TOLD ME THIS PITCH WOULD LAST FIVE DAYS. HE ALSO TOLD ME HE'D NEVER SEEN RAIN.",
    "MY MATE BET ME A DOLLAR I COULDN'T GO A WHOLE OVER WITHOUT MENTIONING THE PITCH. I OWE HIM A DOLLAR.",
  ],
};

/** The other voice's answer, by topic (or by the topic's mood when there's nothing specific). {prev}: who raised it. */
export const CHAT_REPLIES = {
  bunnings: {
    batting: ["QUITE SO, {prev}. HE'S SEEING IT VERY EARLY.", "HE'S MAKING IT LOOK SIMPLE, {prev}. IT ISN'T."],
    bowling: ["I SUSPECT THE CAPTAIN HAS NOTICED, {prev}.", "A WORD AT THE END OF THE OVER, PERHAPS, {prev}."],
    pressure: ["PATIENCE, {prev}. THAT'S WHAT IT COMES DOWN TO.", "SOMETHING HAS TO GIVE, {prev}. IT USUALLY DOES."],
    conditions: ["A DIFFERENT GAME NOW, {prev}.", "IT CHANGES EVERYTHING, {prev}."],
    drama: ["CRICKET HAS A LONG MEMORY, {prev}.", "THAT'S THE GAME, {prev}. CRUEL AND MARVELLOUS."],
    story: ["QUITE A STORY, {prev}.", "I'VE HEARD THAT ONE BEFORE, {prev}. IT GETS BETTER EVERY TIME.", "REALLY, {prev}."],
  },
  lorry: {
    batting: ["YOU'RE NOT WRONG, {prev}! HE'S IN THE ZONE!", "SPOT ON, {prev}! I'D PAY TO WATCH THIS!"],
    bowling: ["COME ON, SKIP! SAY SOMETHING TO HIM, {prev}!", "I'D HAVE HIM OFF, {prev}! OR ON! ONE OF THE TWO!"],
    pressure: ["THE TENSION, {prev}! I'M CHEWING MY NOTES!", "I CAN'T BEAR IT, {prev}! I LOVE IT!"],
    conditions: ["ANYTHING CAN HAPPEN NOW, {prev}! ANYTHING!", "OH, THAT'LL SPICE THINGS UP, {prev}!"],
    drama: ["I FEEL SICK FOR HIM, {prev}! SICK!", "HE'LL BE SEEING THAT IN HIS SLEEP, {prev}!"],
    story: [
      "HA! {prev}, YOU'VE TOLD ME THAT ONE THREE TIMES!",
      "THAT'S BRILLIANT, {prev}! IS IT TRUE?",
      "{prev}, YOU SHOULD WRITE A BOOK!",
    ],
  },
  grog: {
    zone: ["I'D PUT A MAN RIGHT THERE, {prev}. SIMPLE.", "BOWL A DIFFERENT LINE, {prev}. TAKE THAT SHOT AWAY."],
    tooShort: ["AND ON THIS PITCH, {prev}, SHORT IS JUST FEEDING HIM.", "PITCH IT UP AND MAKE HIM DRIVE, {prev}. EVERY TIME."],
    tooFull: ["A METRE SHORTER AND HE'S IN THE GAME, {prev}.", "YOU CAN'T BOWL HALF-VOLLEYS AT THIS LEVEL, {prev}."],
    tooWide: ["MAKE THEM PLAY, {prev}. THAT'S BOWLING 101.", "IF YOU MISS, YOU HIT, {prev}. HE'S MISSING BY A MILE."],
    batting: ["AND IT'S TIMING, {prev}. NOT POWER. TIMING.", "HE'S GOT THE BOWLERS WHERE HE WANTS THEM, {prev}."],
    bowling: ["IT'S A CAPTAINCY QUESTION NOW, {prev}.", "THE BOWLING COACH WILL HAVE THE LAPTOP OUT, {prev}."],
    pressure: ["IT'S ALL ABOUT PRESSURE, {prev}. ALWAYS HAS BEEN.", "THEY'VE GOT TO ROTATE THE STRIKE, {prev}."],
    conditions: [
      "I SAID THIS MORNING IT WOULD DO THIS, {prev}.",
      "THAT'S WHY YOU LOOK AT THE PITCH, {prev}. IT TELLS YOU EVERYTHING.",
    ],
    drama: ["CATCHES WIN MATCHES, {prev}. ALWAYS HAVE.", "THAT COULD BE THE MOMENT OF THE DAY, {prev}."],
    story: [
      "{prev}, I WAS THERE. THAT'S NOT HOW IT HAPPENED.",
      "GOOD STORY, {prev}. MOSTLY TRUE.",
      "I'VE GOT A BETTER ONE, {prev}. ANOTHER TIME.",
    ],
  },
};
