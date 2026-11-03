import { makeKit } from "./kit.js";

/**
 * Skins as data: how a team turns out, beyond its two colours (sim/teams.js), so a new team or player is a
 * data entry. Each team's entry is laid over its plain kit (render/kit.js makeKit); players add their own
 * look on top (playerKit): skin, hair, beard, height, build and extras.
 *
 *   pads, padShade   batting pads          grip      the bat handle's grip
 *   gloves, gloveTrim batting gloves      shirt, pants, shade  whites (cream by default)
 */
export const TEAM_SKINS = {
  AUS: { grip: "#1f5a32", gloveTrim: "#f2c230" },
  ENG: { grip: "#1d2f6b", gloveTrim: "#c8302e" },
};

/** A team's kit: its colours as a plain kit, with its skin entry (if it has one) laid over. */
export function teamKit(team) {
  return { ...makeKit(team.colour, team.colour2), ...(TEAM_SKINS[team.abbr] ?? {}) };
}

/** Limb thickness for each build: slim, average or stocky. */
export const BUILDS = { slim: 0.88, average: 1, stocky: 1.14 };
