import { makeKit } from "./kit.js";

/**
 * Skins as data: how a team turns out, beyond its two colours (sim/teams.js), so a new team or player is a
 * data entry. Each team's entry is laid over its plain kit (render/kit.js makeKit); players add their own
 * look on top (playerKit): skin, hair, beard, height, build and extras.
 *
 *   pads, padShade   batting pads          grip      the bat handle's grip
 *   gloves, gloveTrim batting gloves      shirt, pants, shade  whites (cream by default)
 *   pantsShade       the trousers' shade (the shirt's by default)
 *   numberColour     the shirt number (the cap colour by default)
 *   odi              the coloured kit worn for anything but a Test: { shirt, shade, pants, pantsShade, numberColour }
 */
export const TEAM_SKINS = {
  AUS: {
    grip: "#1f5a32",
    gloveTrim: "#f2c230",
    odi: { shirt: "#f4c430", shade: "#c79a1c", pants: "#1f6b3a", pantsShade: "#154a28", numberColour: "#1f6b3a" },
  },
  ENG: {
    grip: "#1d2f6b",
    gloveTrim: "#c8302e",
    odi: { shirt: "#2a64c4", shade: "#1c4a96", pants: "#1a3d7a", pantsShade: "#122c5a", numberColour: "#f4f4f0" },
  },
  NZ: {
    grip: "#141414",
    gloveTrim: "#b8bcc2",
    odi: { shirt: "#1b1b1b", shade: "#0b0b0b", pants: "#1b1b1b", pantsShade: "#050505", numberColour: "#e8e8e8" },
  },
  SA: {
    grip: "#0b6b3a",
    gloveTrim: "#f2b81c",
    odi: { shirt: "#128a48", shade: "#0b6436", pants: "#0b6b3a", pantsShade: "#064a28", numberColour: "#f2b81c" },
  },
};

/** A team's kit: its colours as a plain kit, its skin laid over, and its coloured kit when `coloured`. */
export function teamKit(team, coloured = false) {
  const skin = TEAM_SKINS[team.abbr] ?? {};
  return { ...makeKit(team.colour, team.colour2), ...skin, ...(coloured ? skin.odi : {}) };
}

/** Limb thickness for each build: slim, average or stocky. */
export const BUILDS = { slim: 0.88, average: 1, stocky: 1.14 };
