import { australia, england } from "./teams.js";
import { newZealand } from "./squads/new-zealand.js";
import { southAfrica } from "./squads/south-africa.js";
import { india } from "./squads/india.js";
import { pakistan } from "./squads/pakistan.js";
import { sriLanka } from "./squads/sri-lanka.js";
import { westIndies } from "./squads/west-indies.js";

/** Every team the menu offers, by its abbreviation: each a function that builds the squad. */
export const TEAMS = {
  AUS: australia,
  ENG: england,
  NZ: newZealand,
  SA: southAfrica,
  IND: india,
  PAK: pakistan,
  SL: sriLanka,
  WI: westIndies,
};
export const TEAM_IDS = Object.keys(TEAMS);
