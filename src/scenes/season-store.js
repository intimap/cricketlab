import { load, save } from "../engine/storage.js";
import { SEASON_VERSION } from "../sim/season.js";

/**
 * The season in this browser (sim/season.js is the season itself): saved after every match, so the menu's
 * CONTINUE SEASON picks it up where it was left. A season saved by an older version of the game is ignored.
 */

const KEY = "season";

export function loadSeason() {
  const season = load(KEY, null);
  return season?.version === SEASON_VERSION ? season : null;
}

export const saveSeason = (season) => save(KEY, season);
export const hasSeason = () => loadSeason() !== null;
