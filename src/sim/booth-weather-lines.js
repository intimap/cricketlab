/**
 * The box on the weather (the report before play, and each morning of a Test), the intervals, and the
 * dressing room's call to declare. Voice order, as in the other banks: dry Bunnings, excitable Lorry,
 * tactical Grog. Lines are filled from facts and must fit the booth's box.
 */

const WEATHER = {
  sunny: [
    ["BLUE SKY AND {temp} DEGREES. I'D BAT.", "NOT A CLOUD ABOUT. GOOD DAY FOR IT."],
    ["GLORIOUS! SUNSHINE AND RUNS, I SAY!", "WHAT A DAY FOR CRICKET! GET THE HATS ON!"],
    [
      "DRY AND SUNNY: THE PITCH WILL WEAR, AND THE SPINNERS WILL LIKE THAT LATER.",
      "FAST OUTFIELD TODAY. PIERCE THE FIELD AND IT'S FOUR.",
    ],
  ],
  overcast: [
    ["GREY AND {temp} DEGREES. THE QUICKS WON'T MIND.", "LIGHTS MAY BE NEEDED. THE BATTERS WON'T ENJOY THIS."],
    ["LOOK AT THAT CLOUD! IT'S GOING TO HOOP AROUND!", "SWING BOWLERS' WEATHER! GET THE SLIPS IN!"],
    ["UNDER CLOUD THE BALL SWINGS. PITCH IT UP AND LET IT WORK.", "LEAVE WELL OUTSIDE OFF TODAY. THE EDGES WILL CARRY."],
  ],
  humid: [
    ["MUGGY. {temp} DEGREES AND HEAVY AIR.", "STICKY OUT THERE. THE BALL MAY GO ROUND CORNERS."],
    ["IT'S LIKE A SAUNA! AND THE BALL WILL SWING!", "HUMID! THE BOWLERS WILL BE LICKING THEIR LIPS!"],
    ["HUMIDITY HELPS THE SWING, NEW BALL OR OLD. KEEP ONE SIDE SHINY.", "HEAVY AIR: THE OUTSWINGER WILL BE THE BALL TODAY."],
  ],
  hot: [
    ["{temp} DEGREES. THE FIELDERS WILL WANT SHADE.", "HOT AND DRY. THAT PITCH WILL CRACK."],
    ["A SCORCHER! {temp} DEGREES! BRING ON THE ICE CREAMS!", "BAKING HOT! THE BALL WILL FLY OFF THE BAT!"],
    [
      "HEAT LIKE THIS DRIES THE PITCH OUT: LITTLE SWING, MORE TURN AS IT GOES.",
      "SHORT SPELLS FOR THE QUICKS IN THIS HEAT. SPIN DOES THE WORK.",
    ],
  ],
  rain: [
    ["RAIN ABOUT. {temp} DEGREES AND DAMP.", "WET OUT THERE. THE COVERS HAVE BEEN BUSY."],
    ["THE RAIN! WE'LL GET SOME PLAY IN, SURELY!", "SHOWERS ABOUT! THE SEAMERS WILL LOVE IT!"],
    [
      "DAMP PITCH, SLOW OUTFIELD. THE SEAMERS WILL FIND MOVEMENT. BAT TIGHT.",
      "WET GRASS SLOWS THE BALL. RUNS WILL BE HARD WORK.",
    ],
  ],
};

/** Rain before the start, said first: overs lost today (a Test) or the game cut short. */
const RAIN_LOST = ["RAIN HAS COST US {lost} OVERS.", "{lost} OVERS LOST TO THE RAIN!", "THE RAIN HAS TAKEN {lost} OVERS."];
const RAIN_CUT = ["IT'S DOWN TO {overs} OVERS A SIDE.", "{overs} OVERS A SIDE NOW!", "REDUCED TO {overs} OVERS A SIDE."];
const DAY = ["DAY {day}.", "DAY {day}!", "DAY {day}."];

const BREAKS = {
  lunch: [
    ["LUNCH. {team} {score}.", "THAT'S LUNCH. {team} ON {score}."],
    ["LUNCH! {team} {score}! WHAT A SESSION!", "TIME FOR A SANDWICH! {team} {score}!"],
    ["LUNCH WITH {team} {score}. THE NEXT SESSION SHAPES THE DAY.", "{team} {score} AT LUNCH. THE BOWLERS GET A REST."],
  ],
  tea: [
    ["TEA. {team} {score}.", "THAT'S TEA. {team} ON {score}."],
    ["TEA! {team} {score}! ONE SESSION LEFT TODAY!", "TIME FOR A CUPPA! {team} {score}!"],
    ["TEA WITH {team} {score}. THE EVENING SESSION AWAITS.", "{team} {score} AT TEA. FRESH LEGS AFTER THE BREAK."],
  ],
  stumps: [
    ["STUMPS ON DAY {day}. {team} {score}.", "THAT'S STUMPS. {team} {score}."],
    ["STUMPS! DAY {day} DONE! {team} {score}!", "THAT'S THE DAY! {team} {score}! SEE YOU TOMORROW!"],
    ["STUMPS, DAY {day}: {team} {score}. A NIGHT'S REST FOR THE BOWLERS.", "{team} {score} AT STUMPS. THE MORNING WILL TELL."],
  ],
};

const DECLARE = [
  ["THAT LOOKS LIKE ENOUGH. TIME TO DECLARE.", "THE CAPTAIN SHOULD DECLARE. THAT'S PLENTY."],
  ["DECLARE! GET THEM IN AND BOWL AT THEM!", "SURELY THAT'S A DECLARATION! ENOUGH RUNS!"],
  ["THE LEAD IS BIG ENOUGH. DECLARE AND GIVE THE BOWLERS TIME TO WIN IT.", "TIME MATTERS NOW MORE THAN RUNS. I'D DECLARE."],
];

const RAIN_STOPS = [
  ["RAIN STOPS PLAY. ON COME THE COVERS.", "HERE COMES THE RAIN. OFF THEY GO."],
  ["IT'S POURING! EVERYONE OFF! COVERS ON!", "OH NO, THE RAIN! JUST AS IT WAS GETTING GOOD!"],
  [
    "RAIN. THE BOWLERS GET A REST AND THE BALL GETS WET. THAT CHANGES THINGS.",
    "A BREAK FOR RAIN. THE BATTERS WILL HAVE TO START AGAIN.",
  ],
];
const STOP_LOST = [
  ["{lost} OVERS LOST TO IT.", "THAT'S COST US {lost} OVERS."],
  ["{lost} OVERS GONE!", "WE'VE LOST {lost} OVERS!"],
  ["{lost} OVERS LOST. THE CAPTAINS WILL BE DOING THEIR SUMS.", "{lost} OVERS OFF THE DAY. TIME IS RUNNING SHORT."],
];
const RAIN_DAY = [
  ["NO MORE PLAY TODAY.", "THAT'S IT FOR THE DAY, I'M AFRAID."],
  ["THEY'VE CALLED IT OFF FOR THE DAY!", "NO MORE CRICKET TODAY!"],
  ["PLAY ABANDONED FOR THE DAY. THAT HELPS THE SIDE HOPING FOR A DRAW.", "NO MORE TODAY. A DAY LOST IS A DAY LESS TO WIN IT."],
];
const RAIN_TARGET = [
  ["{target} OFF {overs} OVERS NOW.", "THE TARGET IS {target} OFF {overs}."],
  ["NEW TARGET: {target} OFF {overs} OVERS!", "{target} TO WIN OFF {overs}! GAME ON!"],
  [
    "REVISED: {target} OFF {overs} OVERS. WICKETS IN HAND MATTER MORE NOW.",
    "{target} OFF {overs}. A SHORTER CHASE SUITS THE HITTERS.",
  ],
];
const RAIN_OVERS = [
  ["{overs} OVERS A SIDE NOW.", "DOWN TO {overs} OVERS A SIDE."],
  ["{overs} OVERS A SIDE!", "IT'S {overs} OVERS A SIDE NOW!"],
  ["{overs} OVERS A SIDE. THE BATTERS WILL HAVE TO GO SOONER.", "CUT TO {overs} OVERS A SIDE."],
];

const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? "")).toUpperCase();

/**
 * The voice's take on the day's weather. facts: { id, temp, day (a Test's), lost (overs lost today), overs
 * (a limited-overs game cut to) }.
 */
export function weatherCall(who, facts, pick) {
  const parts = [];
  if (facts.day) parts.push(DAY[who]);
  if (facts.lost) parts.push(RAIN_LOST[who]);
  if (facts.overs) parts.push(RAIN_CUT[who]);
  parts.push(pick((WEATHER[facts.id] ?? WEATHER.sunny)[who]));
  return fill(parts.join(" "), facts);
}

/** An interval (lunch, tea or stumps). facts: { team, score, day }. */
export function breakCall(who, brk, facts, pick) {
  return fill(pick(BREAKS[brk][who]), facts);
}

/** The dressing room (through the box) says it's time to declare. */
export function declareCall(who, pick) {
  return pick(DECLARE[who]);
}

/** Rain has stopped play: the voice's first word on it. */
export function rainStopCall(who, pick) {
  return pick(RAIN_STOPS[who]);
}

/** What the rain has cost. facts: { lost, dayOver, overs (a side, limited overs), target (the revised chase) }. */
export function rainCostCall(who, facts, pick) {
  const parts = [];
  if (facts.dayOver) parts.push(pick(RAIN_DAY[who]));
  else if (facts.lost) parts.push(pick(STOP_LOST[who]));
  if (facts.target) parts.push(pick(RAIN_TARGET[who]));
  else if (facts.overs) parts.push(pick(RAIN_OVERS[who]));
  return fill(parts.join(" "), facts);
}
