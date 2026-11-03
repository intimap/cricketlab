import { australia, england } from "./teams.js";
import { newZealand } from "./squads/new-zealand.js";
import { southAfrica } from "./squads/south-africa.js";

/** Every team the menu offers, by its abbreviation: each a function that builds the squad. */
export const TEAMS = { AUS: australia, ENG: england, NZ: newZealand, SA: southAfrica };
export const TEAM_IDS = Object.keys(TEAMS);
