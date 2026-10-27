/**
 * What each commentator says about the situations MomentTracker spots, in
 * their own voices: Bunnings dry and sparing, Lorry beside himself, Grog
 * with an opinion on everything.
 * Placeholders: {b} batter, {w} bowler, {n} the number that matters, {k} a
 * count in words (wickets in a collapse). Pace and movement are left to the
 * speed gun on the HUD; the commentators just react to them.
 */
export const MOMENT_LINES = {
  hatTrick: {
    bunnings: [
      "THREE IN THREE. {w} HAS A HAT-TRICK. YOU WON'T SEE MANY OF THOSE.",
      "A HAT-TRICK. {w} WILL REMEMBER THIS DAY FOR A VERY LONG TIME.",
    ],
    lorry: ["HAT-TRICK! HAT-TRICK! I DON'T BELIEVE IT! {w} HAS DONE IT!", "THREE IN THREE! THE PLACE HAS GONE MAD!"],
    grog: [
      "A HAT-TRICK FOR {w}! THREE BALLS, THREE WICKETS. SENSATIONAL.",
      "HE'S DONE IT! THEY'LL TALK ABOUT THIS ONE FOR YEARS.",
    ],
  },
  twoInTwo: {
    bunnings: ["TWO IN TWO. AND {w} IS ON A HAT-TRICK.", "ANOTHER ONE. HAT-TRICK BALL TO COME. EVERYONE IN CLOSE, I'D IMAGINE."],
    lorry: ["TWO IN TWO! HE'S ON A HAT-TRICK! IT'S ALL HAPPENING!", "ANOTHER ONE! HAT-TRICK BALL! I CAN HARDLY BREATHE!"],
    grog: [
      "TWO IN TWO. NOW, WHAT FIELD DO YOU SET FOR THE HAT-TRICK BALL?",
      "{w} HAS TWO IN TWO. I'D HAVE EVERYONE AROUND THE BAT.",
    ],
  },
  fiveFor: {
    bunnings: ["FIVE WICKETS FOR {w}. A MARVELLOUS SPELL OF BOWLING.", "THAT'S FIVE. {w}'S NAME GOES ON THE HONOURS BOARD."],
    lorry: ["FIVE! FIVE WICKETS! WHAT A PERFORMANCE FROM {w}!", "IT'S FIVE FOR {w}! THEY'RE ON THEIR FEET FOR HIM!"],
    grog: ["FIVE FOR {w}. HE'S READ THIS PITCH BETTER THAN ANYONE.", "A FIVE-WICKET HAUL. THAT IS CLASS BOWLING."],
  },
  outInNineties: {
    bunnings: [
      "OUT FOR {n}. SO CLOSE. CRICKET CAN BE A CRUEL GAME.",
      "{b} FALLS FOR {n}. HE'LL SIT QUIETLY IN THE ROOM AFTER THAT.",
    ],
    lorry: ["OH NO! OUT FOR {n}! SO CLOSE TO A HUNDRED!", "HEARTBREAK! {b} GOES FOR {n}! I FEEL FOR HIM!"],
    grog: ["{b} GOES FOR {n}. NERVES. PURE NERVES.", "OUT IN THE NINETIES. HE GOT TENSE, AND IT SHOWED."],
  },
  goldenDuck: {
    bunnings: ["FIRST BALL. {b} WON'T WANT TO SEE THE REPLAY.", "A GOLDEN DUCK. A LONG WALK FOR VERY LITTLE."],
    lorry: ["FIRST BALL! GONE FIRST BALL! WHAT A START!", "GOLDEN DUCK! HE DIDN'T EVEN GET TO TAKE GUARD PROPERLY!"],
    grog: ["FIRST BALL. WHAT A DELIVERY TO WELCOME HIM WITH.", "A GOLDEN DUCK. THE BOWLER HAD HIM BEFORE HE'D SETTLED."],
  },
  longDuck: {
    bunnings: ["{n} BALLS AND NOT A RUN. AND NOW HE'S GONE.", "A DUCK, AFTER ALL THAT DIGGING IN. {n} BALLS OF IT."],
    lorry: ["{n} BALLS FOR NOTHING! AND HE'S GONE!", "ALL THAT EFFORT, {n} BALLS, AND NOT A SINGLE RUN!"],
    grog: ["{n} BALLS FOR NOUGHT. A BATTLE HE LOST IN THE END.", "HE GRAFTED FOR {n} BALLS. NOTHING TO SHOW FOR IT."],
  },
  duck: {
    bunnings: [
      "NOUGHT. {b} GOES WITHOUT TROUBLING THE SCORERS.",
      "OUT FOR A DUCK. NOT HIS DAY.",
      "{b} DEPARTS WITHOUT SCORING. A DIFFICULT DAY.",
    ],
    lorry: ["OUT FOR NOUGHT! A DUCK!", "GONE FOR A DUCK! OH DEAR, OH DEAR!", "NOTHING! NOT A RUN! OFF HE GOES!"],
    grog: [
      "A DUCK. THAT'S A BIG BLOW FOR THEM.",
      "NO RUNS FOR {b}. SHORT AND NOT SWEET.",
      "{b} GOES FOR NOUGHT. HE NEVER LOOKED SETTLED.",
    ],
  },
  collapse: {
    bunnings: [
      "{k} WICKETS FOR {n} RUNS. THIS IS BECOMING A COLLAPSE.",
      "ANOTHER ONE. {k} FOR {n}. THE INNINGS IS COMING APART.",
    ],
    lorry: ["ANOTHER ONE! IT'S A COLLAPSE! {k} FOR {n}!", "THEY'RE FALLING LIKE NINEPINS! {k} WICKETS FOR {n}!"],
    grog: ["{k} FOR {n}. THIS IS A PROPER COLLAPSE.", "THE WHEELS ARE COMING OFF. {k} WICKETS FOR {n} RUNS."],
  },
  standBroken: {
    bunnings: [
      "AND THAT BREAKS A STAND OF {n}. VITAL WICKET.",
      "{n} RUNS TOGETHER, AND NOW IT'S OVER. THE BREAKTHROUGH.",
      "THE STAND IS OVER AT {n}. A MOST WELCOME WICKET.",
    ],
    lorry: [
      "THE PARTNERSHIP IS BROKEN! {n} RUNS AND IT'S OVER!",
      "FINALLY! THEY'VE BROKEN THE STAND OF {n}!",
      "{n} RUNS TOGETHER AND IT'S FINALLY OVER! THE BOWLERS ARE JUMPING!",
    ],
    grog: [
      "THAT BREAKS A STAND OF {n}. THE MOST IMPORTANT WICKET OF THE DAY.",
      "A {n}-RUN PARTNERSHIP OVER. GAME ON AGAIN.",
      "THEY'D PUT ON {n}. THAT WICKET COULD CHANGE THE MATCH.",
    ],
  },
  bigKnockEnds: {
    bunnings: ["{b} GOES FOR {n}. A FINE INNINGS ENDS.", "THAT'S THE END OF A VERY GOOD KNOCK. {n} RUNS."],
    lorry: ["{b} GOES FOR {n}! WHAT AN INNINGS IT'S BEEN!", "THE BIG FISH! {b} GONE FOR {n}!"],
    grog: ["{b} OUT FOR {n}. A VERY IMPORTANT INNINGS.", "THAT ENDS IT. {n} FROM {b}. HE'LL BE CROSS NOT TO GO ON."],
  },
  bowlerThird: {
    bunnings: ["THREE FOR {w} NOW. HE'S BOWLING VERY NICELY.", "{w} HAS HIS THIRD. A GOOD DAY AT THE OFFICE."],
    lorry: ["THAT'S THREE FOR {w}! HE'S ON FIRE!", "THREE WICKETS! {w} IS RUNNING RIOT!"],
    grog: ["THREE NOW FOR {w}. HE'S IN A LOVELY RHYTHM.", "{w}'S THIRD. HE'S HITTING THE DECK HARD."],
  },
  nearRunout: {
    bunnings: [
      "HE'S IN. JUST. THAT WAS VERY TIGHT.",
      "SAFE, BY THE WIDTH OF A BAT. THAT WAS CLOSER THAN HE'D LIKE.",
      "A DIVE, A THROW, AND HE'S JUST IN. EXCITING STUFF.",
    ],
    lorry: [
      "OH! HE'S JUST MADE IT! THAT WAS SO CLOSE!",
      "SAFE! BY A WHISKER! MY HEART!",
      "HE'S DIVED IN! JUST IN TIME! WHAT A SCRAMBLE!",
    ],
    grog: [
      "THAT WAS FRIGHTFULLY CLOSE. A YARD QUICKER AND HE'S GONE.",
      "HE'S SCRAMBLED IN. THAT RUN WAS NEVER REALLY ON.",
      "THEY MUST STOP THAT. TWO YARDS SHORT AND THAT'S A WICKET.",
    ],
  },
  shyMissed: {
    bunnings: [
      "A SHY AT THE STUMPS... AND A MISS. HIT, AND HE WAS GONE.",
      "MISSED. HAD THAT HIT, WE'D BE TALKING ABOUT A RUN OUT.",
    ],
    lorry: ["HE'S HAD A SHY! MISSED! HE WAS GONE IF THAT HIT!", "MISSED THE STUMPS! OH, WHAT A CHANCE THAT WAS!"],
    grog: ["MISSED! HIT THAT AND HE WAS A YARD SHORT.", "A SHY AND A MISS. THE FIELDER WILL KICK HIMSELF."],
  },
  droppedOn: {
    bunnings: [
      "DROPPED ON {n}. THAT COULD BE VERY COSTLY.",
      "{b} REPRIEVED ON {n}. WE'LL SEE WHAT THAT COSTS.",
      "THAT WENT DOWN. {b} SURVIVES ON {n}.",
    ],
    lorry: [
      "DROPPED ON {n}! OH, YOU CAN'T DO THAT!",
      "{b} DROPPED ON {n}! HE'LL MAKE THEM PAY!",
      "OH, HE'S SPILLED IT! {b} GETS A LIFE ON {n}!",
    ],
    grog: [
      "DROPPED ON {n}. MARK MY WORDS, THAT WILL COST THEM.",
      "A LIFE FOR {b} ON {n}. YOU CAN'T GIVE CHANCES LIKE THAT.",
      "THAT'S GONE STRAIGHT THROUGH HIS HANDS. {b} LIVES ON, ON {n}.",
    ],
  },
  offTheMark: {
    bunnings: ["AND {b} IS OFF THE MARK. AFTER {n} BALLS. WELL DONE.", "{n} BALLS, AND FINALLY A RUN. THE CROWD APPRECIATES IT."],
    lorry: ["HE'S OFF THE MARK! {n} BALLS! LISTEN TO THAT CHEER!", "AT LAST! OFF THE MARK AFTER {n} BALLS!"],
    grog: ["OFF THE MARK AFTER {n} BALLS. LOOK AT THE RELIEF ON HIS FACE.", "FINALLY OFF THE MARK. {n} BALLS. NOW HE CAN PLAY."],
  },
  droughtEnds: {
    bunnings: [
      "AT LAST. HIS FIRST RUNS IN {n} BALLS.",
      "{n} DOT BALLS, AND FINALLY HE GETS ONE AWAY.",
      "A RUN, AT LAST. {n} BALLS IN THE MAKING.",
    ],
    lorry: [
      "FINALLY! RUNS! {n} BALLS WITHOUT ONE!",
      "THERE IT IS! THE FIRST RUNS IN {n} BALLS!",
      "HE'S GOT ONE! FINALLY! {n} BALLS!",
    ],
    grog: [
      "{n} BALLS WITHOUT A RUN, AND NOW ONE. HE NEEDED THAT.",
      "THAT'S HIS FIRST SCORING SHOT IN {n} BALLS.",
      "{n} BALLS WAITING. THAT'S THE PRESSURE OFF HIM, FOR NOW.",
    ],
  },
  backToBack: {
    bunnings: [
      "BACK-TO-BACK BOUNDARIES. {w} WILL BE THINKING ABOUT HIS LENGTH.",
      "ANOTHER ONE. TWO IN TWO FOR {b}.",
      "TWO BOUNDARIES IN TWO BALLS. {b} HAS DECIDED TO PLAY.",
    ],
    lorry: [
      "ANOTHER ONE! BACK-TO-BACK! WHAT A PLAYER!",
      "TWO IN A ROW! HE'S GOING AFTER HIM!",
      "BANG! AND AGAIN! {b} IS IN THE MOOD!",
    ],
    grog: [
      "BACK-TO-BACK. {w} HAS LOST HIS LENGTH.",
      "ANOTHER BOUNDARY. THE CAPTAIN NEEDS A WORD WITH {w}.",
      "TWO IN TWO. HE'S PICKING {w} OFF AT WILL.",
    ],
  },
  threeInARow: {
    bunnings: ["THREE IN A ROW. {b} IS ON THE CHARGE.", "AND ANOTHER. {w} IS GETTING A HIDING."],
    lorry: ["THREE IN A ROW! THREE! HE'S TAKING HIM APART!", "AND ANOTHER! IT'S RAINING BOUNDARIES!"],
    grog: ["THREE IN A ROW! TAKE HIM OFF, I SAY.", "THREE ON THE BOUNCE. HE'S GOT {w} EXACTLY WHERE HE WANTS HIM."],
  },
  pressureReleased: {
    bunnings: ["AND THAT RELEASES THE PRESSURE. {n} DOT BALLS, THEN THAT.", "THE DAM BREAKS. A BOUNDARY AFTER {n} DOTS."],
    lorry: ["THERE IT IS! {n} DOT BALLS AND THEN BANG!", "THE SHACKLES ARE OFF! WHAT RELIEF FOR THEM!"],
    grog: ["THAT RELEASES THE PRESSURE. {n} DOTS AND THEN A BOUNDARY.", "PRESSURE OFF. HE'S WAITED {n} BALLS FOR THAT ONE."],
  },
  intoNineties: {
    bunnings: ["{b} MOVES INTO THE NINETIES. THE NERVOUS TIME.", "{n} NOW. HE'LL BE COUNTING EVERY RUN FROM HERE."],
    lorry: ["{n}! THE NERVOUS NINETIES! I CAN'T WATCH!", "INTO THE NINETIES! COME ON, {b}!"],
    grog: ["{n} NOW. THIS IS WHERE YOU FIND OUT ABOUT A PLAYER.", "INTO THE NINETIES. I'D JUST KEEP PLAYING NATURALLY."],
  },
  bigOver: {
    bunnings: [
      "{n} FROM THE OVER. {w} WILL BE GLAD TO SEE THE BACK OF THAT.",
      "AN EXPENSIVE OVER. {n} RUNS FROM IT.",
      "{n} RUNS FROM THAT OVER. THE SCOREBOARD IS MOVING NOW.",
    ],
    lorry: [
      "{n} FROM THE OVER! WHAT CARNAGE!",
      "{n} RUNS! {w} HAS BEEN SMASHED ALL OVER THE PARK!",
      "WHAT AN OVER! {n} RUNS! THE BATTERS ARE FLYING!",
    ],
    grog: [
      "{n} OFF THE OVER. THAT'S SHIFTED THE MOMENTUM.",
      "AN OVER TO FORGET FOR {w}. {n} RUNS.",
      "{n} FROM IT. THAT'S A BAD OVER, PLAIN AND SIMPLE.",
    ],
  },
  winningRuns: {
    bunnings: ["AND THAT'S THE WINNING RUNS. {b} FINISHES IT. MARVELLOUS.", "THEY'VE DONE IT. THE MATCH IS WON."],
    lorry: ["THEY'VE WON IT! THEY'VE WON IT! {b} HITS THE WINNING RUNS!", "IT'S ALL OVER! WHAT A FINISH!"],
    grog: ["THAT'S THE GAME. {b} HAS TAKEN THEM HOME.", "VICTORY. AND I SAID THEY'D CHASE IT."],
  },
  equation: {
    bunnings: ["{n} NEEDED FROM {k} BALLS. INTERESTING.", "THE EQUATION NOW: {n} FROM {k}."],
    lorry: ["{n} OFF {k}! IT'S ALL HAPPENING!", "{n} NEEDED, {k} BALLS LEFT! I CAN'T BEAR IT!"],
    grog: ["{n} FROM {k}. IT'S IN THE BALANCE.", "THEY NEED {n} OFF {k}. ONE BIG OVER CHANGES EVERYTHING."],
  },
  jaffa: {
    bunnings: ["WHAT A DELIVERY. {b} NEVER HAD A CHANCE WITH THAT.", "AN ABSOLUTE PEACH. YOU CAN ONLY APPLAUD THE BOWLER."],
    lorry: ["OH, WHAT A BALL! A JAFFA! HE'S BEATEN HIM ALL ENDS UP!", "UNPLAYABLE! ABSOLUTELY UNPLAYABLE!"],
    grog: [
      "THAT'S A JAFFA. NOTHING {b} COULD HAVE DONE ABOUT THAT ONE.",
      "WORLD-CLASS DELIVERY FROM {w}. THAT'S THE BALL OF THE DAY.",
    ],
  },
  rapid: {
    bunnings: ["THAT WAS QUICK. VERY QUICK.", "{w} IS SLIPPING THEM DOWN NOW. THAT HURRIED HIM."],
    lorry: ["THAT IS RAPID! HE'S FLYING IN! LOOK AT THE KEEPER'S GLOVES!", "WHOA! THAT WAS SERIOUS PACE!"],
    grog: ["GENUINE PACE. THE BATTERS DON'T LIKE THAT ONE BIT.", "{w} IS REALLY CRANKING IT UP NOW."],
  },
  bigSwing: {
    bunnings: ["THAT SWUNG A LONG WAY. LOVELY SHAPE.", "HANGING IN THE AIR, THEN BENDING LATE. MARVELLOUS."],
    lorry: ["LOOK AT THAT SWING! IT'S BANANA-SHAPED!", "IT'S SWINGING LIKE A BOOMERANG OUT THERE!"],
    grog: ["THE CONDITIONS ARE PERFECT FOR {w}. IT'S HOOPING.", "PROPER SWING BOWLING. LATE AND BIG."],
  },
  bigTurn: {
    bunnings: ["THAT SPUN A LONG WAY. THE PITCH IS STARTING TO HELP.", "BIG TURN THERE. {b} WILL HAVE NOTICED THAT."],
    lorry: ["IT'S TURNED A MILE! LOOK AT THAT!", "SQUARE! IT'S SPUN SQUARE!"],
    grog: ["THAT'S A BIG RIP FROM {w}. IT GRIPPED AND WENT.", "IT'S TURNING SHARPLY NOW. BATTING IS GETTING HARD."],
  },
  fifty: {
    bunnings: ["FIFTY FOR {b}. {n} BALLS. A VERY TIDY INNINGS.", "{b} RAISES HIS BAT. FIFTY, AND WELL EARNED."],
    lorry: ["FIFTY! FIFTY FOR {b}! UP GOES THE BAT!", "HE'S GOT HIS FIFTY! {n} BALLS OF IT! WONDERFUL!"],
    grog: [
      "FIFTY FOR {b}. NOW HE MUST GO ON AND MAKE IT COUNT.",
      "A HALF-CENTURY OFF {n} BALLS. HE'S PLAYED THE CONDITIONS SUPERBLY.",
    ],
  },
  hundred: {
    bunnings: [
      "A HUNDRED FOR {b}. {n} BALLS. OFF COMES THE HELMET. MARVELLOUS.",
      "THERE IT IS. {b}'S HUNDRED. THOROUGHLY DESERVED.",
    ],
    lorry: [
      "HUNDRED! HE'S DONE IT! A CENTURY FOR {b}! THE CROWD ARE GOING WILD!",
      "IT'S A HUNDRED! WHAT A KNOCK! {n} BALLS OF PURE CLASS!",
    ],
    grog: [
      "A CENTURY FOR {b}. THAT IS A PROPER TEST MATCH HUNDRED.",
      "HE'S GOT HIS HUNDRED. {n} BALLS. I SAID THIS MORNING HE WAS IN FORM.",
    ],
  },
  partnership: {
    bunnings: [
      "THAT'S A {n} PARTNERSHIP. THEY'RE BUILDING SOMETHING HERE.",
      "{n} FOR THE STAND. THE BOWLERS NEED A BREAKTHROUGH.",
    ],
    lorry: ["{n} PARTNERSHIP! THESE TWO ARE MAGNIFICENT!", "THE {n} STAND IS UP! WHAT A PAIR!"],
    grog: [
      "A {n} PARTNERSHIP. THE CAPTAIN NEEDS TO THINK OF SOMETHING.",
      "{n} FOR THE STAND. THEY'VE TAKEN THE GAME AWAY A LITTLE.",
    ],
  },
  teamMilestone: {
    bunnings: [
      "AND THAT BRINGS UP THE {n}. A USEFUL TOTAL BUILDING.",
      "{n} UP FOR THE BATTING SIDE. STEADY PROGRESS.",
      "THE {n} COMES UP. THE SCOREBOARD TICKS OVER.",
    ],
    lorry: [
      "THAT'S THE {n} UP! LISTEN TO THE CROWD!",
      "{n} ON THE BOARD! WHAT AN EFFORT FROM THESE BATTERS!",
      "{n}! THEY'VE BROUGHT UP {n}!",
    ],
    grog: [
      "THE {n} IS UP. NOW THEY NEED TO KICK ON.",
      "{n} FOR THE INNINGS. A PLATFORM, IF THEY'RE SENSIBLE.",
      "{n} ON THE BOARD. THE BOWLERS HAVE WORK TO DO.",
    ],
  },
  tightSpell: {
    bunnings: ["{w} HAS GONE FOR JUST {n} IN THIS SPELL. MISERLY.", "QUITE A SPELL FROM {w}. {n} RUNS, AND NOT MANY EASY BALLS."],
    lorry: ["{w} IS GIVING NOTHING AWAY! {n} RUNS FROM ALL THOSE OVERS!", "WHAT CONTROL FROM {w}! THEY CAN'T SCORE OFF HIM!"],
    grog: ["{n} RUNS OFF {w}'S OVERS. THAT'S HOW YOU BUILD PRESSURE.", "{w} HAS BEEN SUPERB. HE'S DRYING UP ONE END COMPLETELY."],
  },
  maiden: {
    bunnings: [
      "A MAIDEN. {w} HAS GIVEN NOTHING AWAY.",
      "NO RUNS FROM THE OVER. TIGHT, DISCIPLINED STUFF.",
      "SIX BALLS, NO RUNS. {w} IS RIGHT ON THE MONEY.",
    ],
    lorry: [
      "A MAIDEN! NOT A RUN! WONDERFUL BOWLING!",
      "MAIDEN OVER! THE PRESSURE IS ON NOW!",
      "NOT A SINGLE RUN FROM THAT OVER! MARVELLOUS!",
    ],
    grog: [
      "A MAIDEN. THAT'S PRESSURE BOWLING.",
      "NOTHING OFF THE OVER. {w} IS SQUEEZING THEM.",
      "A MAIDEN FROM {w}. HE'S HITTING THE SAME SPOT EVERY BALL.",
    ],
  },
  maidenAgain: {
    bunnings: ["BACK-TO-BACK MAIDENS. {w} IS STRANGLING THEM.", "ANOTHER MAIDEN. WONDERFUL CONTROL."],
    lorry: ["ANOTHER MAIDEN! THIS IS GRIPPING STUFF!", "BACK-TO-BACK MAIDENS! THEY CAN'T GET IT AWAY!"],
    grog: ["ANOTHER MAIDEN. SOMEBODY HAS TO TAKE A RISK SOON.", "BACK-TO-BACK MAIDENS. THE BATTERS ARE STUCK."],
  },
  dotsBuilding: {
    bunnings: ["THAT'S {n} DOT BALLS IN A ROW. THE PRESSURE IS BUILDING.", "{n} WITHOUT A RUN NOW. SOMETHING HAS TO GIVE."],
    lorry: ["{n} DOTS IN A ROW! SOMETHING'S GOING TO HAPPEN!", "{n} BALLS WITHOUT A RUN! THE TENSION!"],
    grog: [
      "{n} DOTS IN A ROW. THE BOWLERS ARE RIGHT ON TOP.",
      "THAT'S {n} BALLS WITHOUT A RUN. THEY'VE GOT TO ROTATE THE STRIKE.",
    ],
  },
  beatenAgain: {
    bunnings: [
      "BEATEN AGAIN. {w} HAS HIM IN ALL SORTS.",
      "AND AGAIN. {b} SIMPLY CAN'T LAY A BAT ON IT.",
      "PLAY AND MISS. AGAIN. {w} WILL BE GETTING FRUSTRATED.",
    ],
    lorry: [
      "BEATEN AGAIN! HE'S GOT NO IDEA!",
      "AGAIN! HE'S PLAYING AND MISSING ALL OVER THE PLACE!",
      "PLAYED AND MISSED! AGAIN! HOW HAS THAT NOT HIT THE EDGE?",
    ],
    grog: [
      "BEATEN AGAIN. {b} IS GROPING OUTSIDE OFF STUMP.",
      "AND AGAIN. {w} HAS FOUND THE WEAKNESS.",
      "HE CAN'T PICK IT. {w} JUST NEEDS TO KEEP PUTTING IT THERE.",
    ],
  },
};

/** Moments big enough that a second voice might chime in, and the mood of the reply. */
export const TALKING_POINTS = {
  winningRuns: "drama",
  hatTrick: "drama",
  twoInTwo: "drama",
  fiveFor: "drama",
  outInNineties: "drama",
  collapse: "drama",
  standBroken: "drama",
  bigKnockEnds: "drama",
  longDuck: "drama",
  nearRunout: "drama",
  shyMissed: "drama",
  droppedOn: "drama",
  fifty: "batting",
  hundred: "batting",
  partnership: "batting",
  threeInARow: "batting",
  bigOver: "batting",
  maidenAgain: "pressure",
  tightSpell: "pressure",
  dotsBuilding: "pressure",
};

/** A second voice picking up the first. {prev} = the first speaker's first name. */
export const REPLIES = {
  bunnings: {
    drama: ["QUITE A MOMENT, {prev}.", "I COULDN'T AGREE MORE, {prev}."],
    batting: ["WELL PUT, {prev}. MARVELLOUS STUFF.", "LOVELY TO WATCH, {prev}."],
    pressure: ["QUITE SO, {prev}. NOTHING TO HIT.", "PATIENCE WILL BE THE KEY, {prev}."],
  },
  lorry: {
    drama: ["YOU'RE NOT WRONG, {prev}! WHAT A GAME!", "{prev}, IT'S ALL HAPPENING OUT THERE!"],
    batting: ["ABSOLUTELY, {prev}! WHAT A PLAYER!", "{prev}, I'M ON THE EDGE OF MY SEAT!"],
    pressure: ["THE TENSION, {prev}! I CAN'T STAND IT!", "SOMETHING'S GOT TO GIVE, {prev}!"],
  },
  grog: {
    drama: ["I SAID THAT THIS MORNING, {prev}.", "THAT'S TEST CRICKET FOR YOU, {prev}."],
    batting: ["SPOT ON, {prev}. HE'S PLAYING BEAUTIFULLY.", "AND IT'S COME AT THE RIGHT TIME, {prev}."],
    pressure: ["SPOT ON, {prev}. IT'S ALL ABOUT PRESSURE.", "THEY'VE GOT TO ROTATE THE STRIKE, {prev}."],
  },
};
