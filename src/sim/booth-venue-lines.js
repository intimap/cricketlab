/**
 * Scene-setting at the start of an innings: the ground and the pitch, said once. Facts only: the game
 * has no days, sessions or weather. Ground ids are render/grounds.js's; the scene passes them in.
 */

const VENUE = {
  theG: [
    "THE MCG. NOTHING QUITE LIKE IT IN CRICKET.",
    "A BIG CROWD IN AT THE MCG. WHAT A PLACE TO PLAY.",
    "THE G IS BUZZING. THE BIGGEST STAGE IN THE GAME.",
  ],
  lords: [
    "LORD'S. THE HOME OF CRICKET.",
    "THE PAVILION, THE SLOPE, THE HISTORY. IT'S LORD'S.",
    "A FULL HOUSE AT LORD'S. THE MEMBERS ARE IN THEIR SEATS.",
  ],
  scg: [
    "THE SCG. THE CROWD RIGHT ON TOP OF THE ACTION.",
    "SYDNEY. THE STANDS TIGHT TO THE BOUNDARY BOARDS.",
    "A GREAT ATMOSPHERE AT THE SCG.",
  ],
  lakshmi: [
    "LAKSHMI BLUFF. THE MOUNTAINS LOOKING DOWN ON THE GAME.",
    "CRICKET AMONG THE PEAKS. WHAT A SETTING.",
    "THE THIN AIR UP HERE AT LAKSHMI BLUFF. IT CAN CARRY.",
  ],
  parklands: [
    "A LOVELY DAY AT PARKLANDS OVAL.",
    "THE TREES, THE PICKET FENCE. PARKLANDS IS A PICTURE.",
    "A GOOD CROWD ON THE GRASS BANKS AT PARKLANDS.",
  ],
};
VENUE.parklandsBoards = VENUE.parklands;

const PITCH = {
  green: ["A BIT OF GREEN IN THIS PITCH -- THE SEAMERS WILL LOVE IT.", "GRASS ON THE SURFACE. EXPECT SEAM AND SWING EARLY."],
  dust: ["DRY AND DUSTY -- THE SPINNERS WILL BE LICKING THEIR LIPS.", "A DUST BOWL. IT'LL TURN, AND IT'LL KEEP LOW."],
  cracked: [
    "HARD AND CRACKED -- SOME WILL KEEP LOW, SOME WILL TAKE OFF.",
    "YOU CAN SEE THE CRACKS. BATTING WON'T GET ANY EASIER.",
  ],
};

const LIGHT = {
  afternoon: "THE SHADOWS STARTING TO LENGTHEN.",
  evening: "LONG SHADOWS ACROSS THE GROUND NOW.",
  night: "UNDER LIGHTS NOW.",
};

/** The innings' opening scene-setter: the ground, and on the first innings the pitch. */
export function venueCall(groundId, pitchId, light, firstInnings, pick) {
  const venue = VENUE[groundId] ? pick(VENUE[groundId]) : "";
  const pitch = firstInnings && PITCH[pitchId] ? pick(PITCH[pitchId]) : "";
  const parts = [venue, pitch || LIGHT[light] || ""].filter(Boolean);
  return parts.join(" ");
}
