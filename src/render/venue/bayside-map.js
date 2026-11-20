/**
 * Bayside Oval as a map (venue-map.js has the format, venue-bay.js the shore): a club ground on the
 * foreshore. The clubhouse end (end 0, bearing 0) has the weatherboard clubhouse behind its terrace, the
 * scoreboard beside it and Norfolk pines behind. The bay end (end 1, bearing 180) is open to the water: the
 * picket fence, a strip of sand, then the bay to the horizon, with the pier running out and yachts at
 * their moorings. A grass bank on the right (90) looking at the clubhouse; bathing boxes and the car park
 * on the left (270).
 *
 * The sand starts 86 m out towards the bay and the sea at 94 m, so from the far end the close camera sees a
 * band of water over the top of the fence, and everything on that side stays short of the beach.
 */
export const BAYSIDE_MAP = {
  name: "BAYSIDE OVAL",
  ends: ["CLUBHOUSE END", "BAY END"],
  boundary: 66,
  fence: { radius: 72, height: 1.05 },
  grass: { light: "#6aac3c", dark: "#579834", stripe: 3.6, beyond: "#739c46", path: "#cfc19c" },
  parts: [
    // The bay: the beach across the far end, the pier and the moorings.
    { kind: "shore", bearing: 180, sand: 86, sea: 94 },
    { kind: "pier", bearing: 170, radius: 87, heading: 158, length: 92, width: 4 },
    { kind: "yachts", from: 150, to: 216, r0: 135, r1: 330, count: 10, seed: 41 },
    { kind: "sightscreen", bearing: 180, radius: 69.8, width: 12, height: 5 },
    // The clubhouse end.
    { kind: "pavilion", bearing: 0, radius: 98, width: 26, depth: 10 },
    { kind: "terrace", bearing: 0, radius: 85, width: 34, depth: 10, rise: 2.8, seed: 14 },
    { kind: "scoreboard", bearing: 348, radius: 93, base: 2.6, width: 12 },
    { kind: "stand", bearing: 22, radius: 80, width: 16, depth: 8, eave: 5.2, roof: "red", seed: 26 },
    { kind: "sightscreen", bearing: 0, radius: 69.8, width: 12, height: 5 },
    // The bank on the right, picnickers on it.
    { kind: "bank", from: 52, to: 126, r0: 76, r1: 90, height: 3, top: 97, people: 0.22, seed: 36, rugs: 0.2 },
    // The foreshore on the left: bathing boxes, the car park behind the clubhouse's corner, paths.
    { kind: "bathingBoxes", from: 236, to: 296, radius: 84, seed: 45 },
    { kind: "carpark", from: 302, to: 326, r0: 82, r1: 100 },
    { kind: "path", bearing: 0, r0: 74, r1: 85, width: 2.4 },
    { kind: "path", bearing: 180, r0: 74, r1: 87, width: 2.4 },
    { kind: "path", bearing: 266, r0: 74, r1: 83, width: 2.4 },
    // Floodlights at the corners.
    { kind: "floodlight", bearing: 46, radius: 100, height: 34 },
    { kind: "floodlight", bearing: 134, radius: 96, height: 34 },
    { kind: "floodlight", bearing: 226, radius: 96, height: 34 },
    { kind: "floodlight", bearing: 314, radius: 104, height: 34 },
    // Norfolk pines: a row behind the clubhouse, and a few either side of the beach.
    { kind: "trees", from: 318, to: 42, r0: 112, r1: 126, count: 18, height: [17, 25], kinds: ["norfolk"], seed: 71 },
    { kind: "trees", from: 128, to: 146, r0: 94, r1: 100, count: 4, height: [13, 18], kinds: ["norfolk"], seed: 72 },
    { kind: "trees", from: 214, to: 232, r0: 94, r1: 100, count: 4, height: [13, 18], kinds: ["norfolk"], seed: 73 },
    // Gums and tea-tree behind the bank and the bathing boxes, and the suburb's trees beyond.
    { kind: "trees", from: 50, to: 118, r0: 102, r1: 128, count: 34, height: [9, 15], kinds: ["gum", "gum", "oak"], seed: 74 },
    { kind: "trees", from: 240, to: 302, r0: 96, r1: 126, count: 30, height: [8, 14], kinds: ["gum", "bush", "gum"], seed: 75 },
    { kind: "trees", from: 50, to: 122, r0: 98, r1: 104, count: 22, height: [3, 5], kinds: ["bush"], seed: 76 },
    {
      kind: "trees",
      from: 252,
      to: 108,
      r0: 132,
      r1: 205,
      count: 170,
      height: [11, 18],
      kinds: ["gum", "elm", "oak", "gum"],
      seed: 77,
    },
  ],
  life: { flags: ["pavilion", "scoreboard"], scoreboard: "scoreboard", crowd: "crowd" },
  painted: {
    "close-1-ground": { asset: "venues/bayside/close-1-ground", fingerprint: "44d5a29b" },
    "close-1-buildings": { asset: "venues/bayside/close-1-buildings", fingerprint: "44d5a29b" },
  },
};
