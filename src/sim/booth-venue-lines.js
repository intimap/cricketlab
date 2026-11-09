import { byCase } from "./lines.js";
/**
 * Scene-setting at the start of an innings: the ground and the pitch, said once. Facts only: the game
 * has no days, sessions or weather. Ground ids are render/grounds.js's; the scene passes them in.
 */

const VENUE = byCase("venue");
VENUE.parklandsBoards = VENUE.parklands;
VENUE.parklandsNew = VENUE.parklands;

const PITCH = byCase("pitch");

const LIGHT = byCase("light");

/** The innings' opening scene-setter: the ground, and on the first innings the pitch. */
export function venueCall(groundId, pitchId, light, firstInnings, pick) {
  const venue = VENUE[groundId] ? pick(VENUE[groundId]) : "";
  const pitch = firstInnings && PITCH[pitchId] ? pick(PITCH[pitchId]) : "";
  const parts = [venue, pitch || (LIGHT[light] ? pick(LIGHT[light]) : "")].filter(Boolean);
  return parts.join(" ");
}
