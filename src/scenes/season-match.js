import { resultOf, recordResult, simRest } from "../sim/season.js";

/**
 * A season match is over (scenes/match.js leaveInnings): its result goes into the season, the round's other
 * matches are played out, and it's back to the season screen (which saves it).
 */
export function finishSeasonMatch(scene) {
  const game = scene.game;
  const season = game.season;
  const fixture = [...season.rounds, ...season.finals].flat().find((f) => f.id === scene.cfg.fixture);
  if (fixture && !season.results[fixture.id]) {
    simRest(season);
    recordResult(season, resultOf(scene.match, fixture));
  }
  game.showSeason(season);
}
