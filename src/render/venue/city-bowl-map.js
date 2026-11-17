/**
 * The City Bowl as a map (venue-map.js has the format, venue-stadium.js the bowl): a big-city stadium, two
 * tiers and a roof all the way round. The members' end (end 0, bearing 0) has the members' pavilion, storeys
 * of glass over its own seats; the city end (end 1, bearing 180) the video screen, beside the sightscreen
 * where the close camera sees it. Advertising boards round the outfield, concrete beyond them, and the
 * floodlights along the roof's edge.
 *
 * At true scale the close camera sees about 10 m up at the far end: the lower tier, the boxes and the first
 * rows of the upper tier, with the rest running off the top of the picture. The TV camera sees the far side
 * whole and the near side cut away along the edge of the outfield.
 */
export const CITY_BOWL_MAP = {
  name: "CITY BOWL",
  ends: ["MEMBERS END", "CITY END"],
  boundary: 66,
  fence: { radius: 72, height: 1.05, style: "boards" },
  grass: { light: "#5fa83a", dark: "#4c9432", stripe: 4.5, beyond: "#a6a398", path: "#bdb9aa", paved: true },
  parts: [
    // The members' pavilion at end 0, the bowl round the rest.
    { kind: "bowl", from: 338, to: 22, r0: 76, members: true, full: 0.8, seed: 91 },
    { kind: "bowl", from: 22, to: 338, r0: 76, full: 0.9, seed: 92 },
    { kind: "sightscreen", bearing: 0, radius: 69.8, width: 12, height: 5 },
    { kind: "sightscreen", bearing: 180, radius: 69.8, width: 12, height: 5 },
    // The video screen at the city end, in front of the boxes.
    { kind: "scoreboard", style: "screen", bearing: 167, radius: 87.4, base: 3.2, width: 13 },
  ],
  life: { scoreboard: "scoreboard", crowd: "crowd" },
  painted: {},
};
