import { storiesIn } from "./lines.js";

/**
 * The box's lines for moments (sim/moments.js) beyond the big ones in booth-stories.js: ducks, maidens,
 * big overs, the chase equation, jaffas and the like. Voice order: dry Bunnings, excitable Lorry,
 * tactical Grog. {b} batter, {w} bowler, {n} and {k} the moment's numbers. The words are in sim/lines/moments.json.
 */
export const MOMENT_STORIES = storiesIn("moments");

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
