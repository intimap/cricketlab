/**
 * The box's lines for moments (sim/moments.js) beyond the big ones in booth-stories.js: ducks, maidens,
 * big overs, the chase equation, jaffas and the like. Voice order: dry Bunnings, excitable Lorry,
 * tactical Grog. {b} batter, {w} bowler, {n} and {k} the moment's numbers.
 */
export const MOMENT_STORIES = {
  goldenDuck: {
    rest: 0,
    lines: [
      ["FIRST BALL. {b} WON'T WANT TO SEE THAT AGAIN.", "A GOLDEN DUCK. THE LONG WALK FEELS LONGER."],
      ["FIRST BALL! {b} IS ON HIS WAY FOR A GOLDEN DUCK!", "GONE FIRST BALL! WHAT A START FOR {w}!"],
      ["{w} HAD A PLAN FOR {b} FROM BALL ONE. EXECUTED.", "NO TIME TO SETTLE. THAT'S WHY YOU ATTACK A NEW BATTER."],
    ],
  },
  longDuck: {
    rest: 0,
    lines: [
      ["{n} BALLS AND NOTHING TO SHOW FOR IT. HARD WORK UNREWARDED.", "{b} BATTLED {n} BALLS FOR NO RUN."],
      ["ALL THAT EFFORT! {n} BALLS AND {b} GOES FOR NOUGHT!", "{n} DELIVERIES OF RESISTANCE, AND IT ENDS IN A DUCK!"],
      ["{n} BALLS WITHOUT SCORING. THE PRESSURE TOLD IN THE END.", "SURVIVAL WITHOUT SCORING ONLY LASTS SO LONG. {n} BALLS."],
    ],
  },
  duck: {
    rest: 0,
    lines: [
      ["{b} GOES WITHOUT SCORING.", "A DUCK FOR {b}. NOT HIS DAY."],
      ["NOUGHT! {b} DOESN'T TROUBLE THE SCORERS!", "{b} GONE FOR A DUCK! THE BOWLERS ARE ON TOP!"],
      ["{b} NEVER GOT GOING. THE BOWLERS GAVE HIM NOTHING TO HIT.", "NO RUNS FOR {b}. HE COULDN'T FIND A WAY TO ROTATE STRIKE."],
    ],
  },
  bowlerThird: {
    rest: 0,
    lines: [
      ["THREE FOR {w}. A VERY USEFUL DAY'S WORK.", "{w} HAS HIS THIRD."],
      ["THAT'S THREE FOR {w}! HE'S ON A ROLL!", "THREE WICKETS FOR {w}! THIS SPELL IS SPECIAL!"],
      ["{w} NOW HAS THREE. THE CAPTAIN WILL KEEP HIM ON.", "THIRD WICKET FOR {w}. HE'S FOUND THE RIGHT LENGTH FOR THIS SURFACE."],
    ],
  },
  shyMissed: {
    rest: 6,
    lines: [
      ["A SHY, AND A MISS. THE BATTER WAS IN TROUBLE THERE.", "HAD THAT HIT, HE WAS GONE."],
      ["HE MISSED THE STUMPS! THAT WAS OUT IF IT HITS!", "SO CLOSE! A DIRECT HIT AND HE WAS GONE!"],
      ["THE RIGHT IDEA TO SHY. THE BACKING UP WAS THE PROBLEM.", "WORTH THE SHY AT THAT RANGE. THE BATTERS TOOK A BIG RISK."],
    ],
  },
  threeInARow: {
    rest: 6,
    lines: [
      ["THREE IN A ROW. {w} IS UNDER SOME PRESSURE.", "ANOTHER ONE. THREE BOUNDARIES ON THE TROT."],
      ["THREE IN A ROW! {b} IS TEARING INTO {w}!", "AND AGAIN! THAT'S THREE BOUNDARIES IN A ROW!"],
      ["THREE BOUNDARIES. {w} NEEDS TO CHANGE SOMETHING: LENGTH OR FIELD.", "{b} HAS TAKEN THE INITIATIVE. THREE ON THE BOUNCE."],
    ],
  },
  backToBack: {
    rest: 6,
    lines: [
      ["BACK-TO-BACK BOUNDARIES FOR {b}.", "TWO IN A ROW."],
      ["TWO IN TWO! {b} IS AWAY!", "BACK TO BACK! THE CROWD IS UP!"],
      ["TWO BOUNDARIES. {w} HAS DRIFTED ONTO {b}'S STRENGTHS.", "BACK TO BACK. THAT CHANGES THE MOOD OF THE OVER."],
    ],
  },
  intoNineties: {
    rest: 0,
    lines: [
      ["{b} MOVES INTO THE NINETIES. {n} NOW.", "{n} FOR {b}. THE NINETIES."],
      ["INTO THE NINETIES! {b} IS ON {n}!", "{b} ON {n}! THE HUNDRED IS IN SIGHT!"],
      [
        "{n}. THIS IS WHERE BATTERS TIGHTEN UP. KEEP PLAYING THE BALL.",
        "{b} ON {n}. THE FIELD WILL COME IN TO STOP THE SINGLES.",
      ],
    ],
  },
  teamMilestone: {
    rest: 0,
    lines: [
      ["THE {n} COMES UP.", "{n} ON THE BOARD."],
      ["THAT BRINGS UP THE {n}!", "{n} UP FOR THE BATTING SIDE!"],
      ["{n} UP. NOW THE QUESTION IS HOW MANY MORE THEY CAN BUILD.", "THE {n} IS UP. A PLATFORM, IF THEY KEEP WICKETS IN HAND."],
    ],
  },
  equation: {
    rest: 6,
    lines: [
      ["{n} NEEDED FROM {k} BALLS.", "THE EQUATION: {n} FROM {k}."],
      ["{n} FROM {k}! THIS IS WHERE IT GETS INTERESTING!", "THEY NEED {n} OFF {k}! GAME ON!"],
      [
        "{n} FROM {k}. ONE BIG OVER CHANGES EVERYTHING; ONE QUIET ONE ENDS IT.",
        "{n} OFF {k}. THEY NEED BOUNDARIES, NOT JUST SINGLES.",
      ],
    ],
  },
  bigOver: {
    rest: 0,
    lines: [
      ["{n} FROM THE OVER. EXPENSIVE.", "AN OVER {w} WILL WANT TO FORGET. {n} FROM IT."],
      ["{n} OFF THE OVER! THAT'S A BIG ONE!", "WHAT AN OVER! {n} RUNS FROM IT!"],
      [
        "{n} FROM THE OVER. THE CAPTAIN MIGHT HAVE A WORD ABOUT THAT LENGTH.",
        "{n} RUNS. ONE OVER LIKE THAT SWINGS THE MOMENTUM.",
      ],
    ],
  },
  tightSpell: {
    rest: 18,
    lines: [
      ["{w} IS GIVING NOTHING AWAY.", "A MISERLY SPELL FROM {w}."],
      ["{w} HAS BEEN SUPERB! JUST {n} RUNS!", "WHAT CONTROL FROM {w}! NOTHING TO HIT!"],
      [
        "{w}'S FIGURES TELL THE STORY. {n} RUNS, AND THE BATTERS ARE STUCK.",
        "{w} HAS BOWLED TO HIS FIELD ALL SPELL. THAT'S HOW YOU BUILD PRESSURE.",
      ],
    ],
  },
  maiden: {
    rest: 6,
    lines: [
      ["A MAIDEN FROM {w}.", "NOTHING FROM THE OVER. A MAIDEN."],
      ["A MAIDEN! {w} HAS TIED THEM DOWN!", "SIX BALLS, NO RUNS! A MAIDEN FOR {w}!"],
      ["A MAIDEN. {w} KEPT IT IN THE CORRIDOR ALL OVER.", "A MAIDEN OVER. THE PRESSURE IS QUIETLY BUILDING."],
    ],
  },
  maidenAgain: {
    rest: 6,
    lines: [
      ["ANOTHER MAIDEN FROM {w}. BACK-TO-BACK.", "TWO MAIDENS IN A ROW FOR {w}."],
      ["BACK-TO-BACK MAIDENS! {w} IS SQUEEZING THEM!", "ANOTHER MAIDEN! THE BATTERS CAN'T GET HIM AWAY!"],
      ["CONSECUTIVE MAIDENS. SOMEONE WILL HAVE TO TAKE A RISK SOON.", "TWO MAIDENS. THAT'S WHERE WICKETS COME FROM."],
    ],
  },
  beatenAgain: {
    rest: 6,
    lines: [
      ["BEATEN AGAIN. {n} TIMES THIS OVER.", "{b} BEATEN AGAIN. HE HASN'T LAID BAT ON THAT."],
      ["BEATEN AGAIN! {w} IS ALL OVER {b}!", "AND AGAIN! {b} IS GROPING!"],
      [
        "{n} TIMES BEATEN THIS OVER. {b} IS PLAYING AT DELIVERIES HE COULD LEAVE.",
        "{w} IS FINDING THE EDGE OF THE BAT, JUST NOT THE EDGE ITSELF.",
      ],
    ],
  },
  jaffa: {
    rest: 12,
    lines: [
      ["A VERY GOOD BALL. {n} CENTIMETRES, {k}.", "THAT ONE DID TOO MUCH FOR ANYBODY."],
      ["WHAT A DELIVERY! {n} CENTIMETRES {k}!", "AN ABSOLUTE JAFFA! UNPLAYABLE!"],
      [
        "{n} CENTIMETRES {k} AT THAT PACE. YOU CAN'T PLAN FOR THAT ONE.",
        "THE BATTER PLAYED THE RIGHT LINE. THE BALL CHANGED IT.",
      ],
    ],
  },
  rapid: {
    rest: 36,
    lines: [
      ["{n} KILOMETRES AN HOUR. QUICK.", "THAT WAS {n} ON THE SPEED GUN."],
      ["{n} K'S! THAT'S SERIOUS PACE!", "LOOK AT THAT ON THE SPEED GUN! {n}!"],
      ["{n} KM/H. THE BATTER HAS FRACTIONS OF A SECOND AT THAT SPEED.", "{n}. GENUINE PACE MAKES EVERY DECISION HARDER."],
    ],
  },
  bigSwing: {
    rest: 36,
    lines: [
      ["THAT SWUNG {n} CENTIMETRES. QUITE A LOT.", "PLENTY OF SWING THERE: {n} CENTIMETRES {k}."],
      ["{n} CENTIMETRES OF SWING! IT'S HOOPING!", "LOOK AT IT MOVE! {n} CENTIMETRES {k}!"],
      ["{n} CENTIMETRES {k} IN THE AIR. THE BATTER HAS TO PLAY LATE.", "SWING LIKE THAT AND YOU WANT SLIPS IN. {n} CENTIMETRES."],
    ],
  },
  bigTurn: {
    rest: 36,
    lines: [
      ["THAT TURNED {n} CENTIMETRES.", "BIG TURN: {n} CENTIMETRES {k}."],
      ["{n} CENTIMETRES OF TURN! IT'S SPINNING SQUARE!", "IT'S RAGING! {n} CENTIMETRES {k}!"],
      [
        "{n} CENTIMETRES {k} OFF THE PITCH. THE SURFACE IS HELPING THE SPINNERS NOW.",
        "TURN LIKE THAT BRINGS THE CLOSE CATCHERS INTO PLAY.",
      ],
    ],
  },
  weaknessHint: {
    rest: 0,
    lines: [
      ["{b} DIDN'T LOOK COMFORTABLE THERE, {how}.", "NOT ENTIRELY HAPPY {how}, {b}."],
      ["OOH! {b} WAS ALL AT SEA {how}!", "LOOK AT THAT! {b} HAS NO IDEA {how}!"],
      ["WATCH {b} {how}. THERE MIGHT BE SOMETHING IN THAT.", "{w} WILL HAVE NOTICED THAT. {b} {how}."],
    ],
  },
  weaknessWorkedOut: {
    rest: 0,
    lines: [
      ["WE'VE SEEN ENOUGH OF {b} NOW. HE'S NOT HAPPY {how}.", "{b} HAS BEEN IN A WHILE. THEY'LL HAVE NOTICED HIM {how}."],
      ["THEY'VE WORKED {b} OUT! HE'S NOT SURE {how}!", "I'VE SEEN IT TOO! {b} IS SHAKY {how}!"],
      ["FOUR OVERS IN, THE PLAN WRITES ITSELF: AT {b} {how}.", "THEY'VE HAD A GOOD LOOK AT {b}. ATTACK HIM {how}."],
    ],
  },
  weaknessShown: {
    rest: 0,
    lines: [
      ["THAT'S TWICE NOW {how}. A WEAKNESS, I'D SAY.", "{b} HAS A PROBLEM {how}. IT'S PLAIN NOW."],
      ["AGAIN! {b} JUST CANNOT COPE {how}!", "THERE IT IS AGAIN! {b} IS IN ALL SORTS {how}!"],
      ["THAT'S THE PLAN, THEN: KEEP AT {b} {how}.", "TWICE IN TROUBLE {how}. BOWL THERE AND KEEP BOWLING THERE."],
    ],
  },
};

/** The moment kinds above, with how highly the box ranks each against other stories. */
export const MOMENT_PRIORITY = {
  goldenDuck: 96,
  longDuck: 92,
  duck: 86,
  shyMissed: 82,
  threeInARow: 74,
  equation: 72,
  bowlerThird: 70,
  jaffa: 68,
  intoNineties: 66,
  maidenAgain: 64,
  backToBack: 63,
  bigOver: 62,
  teamMilestone: 60,
  maiden: 58,
  tightSpell: 55,
  beatenAgain: 52,
  bigSwing: 47,
  bigTurn: 47,
  rapid: 45,
};
