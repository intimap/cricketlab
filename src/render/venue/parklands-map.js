/**
 * Parklands as a map (venue-map.js has the format, venue-parts.js the kinds): a leafy local ground. The
 * pavilion end (end 0, bearing 0) has the two-storey pavilion behind the members' terrace; the scoreboard
 * end (end 1, bearing 180) a hand-turned board on a grass bank with tents beside it. The Old Stand is on
 * the right (90) looking at the pavilion, the Hill on the left (270). Trees all round, lower beyond the
 * scoreboard so there's sky over it; four floodlight towers; a picket fence 6 m beyond the rope.
 *
 * Distances suit the close camera at true scale: everything in the pavilion's clock gable fits under the
 * top of the picture from the far end, and the scoreboard's face clears the sightscreen beside it.
 */
export const PARKLANDS_MAP = {
  name: "PARKLANDS OVAL",
  ends: ["PAVILION END", "SCOREBOARD END"],
  boundary: 66,
  fence: { radius: 72, height: 1.05 },
  grass: { light: "#62a637", dark: "#4f9130", stripe: 3.6, beyond: "#5a8f3a", path: "#b5a98a" },
  parts: [
    // The pavilion end.
    { kind: "pavilion", bearing: 0, radius: 100, width: 44, depth: 12 },
    { kind: "terrace", bearing: 0, radius: 84, width: 56, depth: 12, rise: 3.3, seed: 12 },
    { kind: "stand", bearing: 333, radius: 80, width: 18, depth: 9, eave: 5.4, roof: "red", seed: 23 },
    { kind: "stand", bearing: 27, radius: 80, width: 18, depth: 9, eave: 5.4, roof: "red", seed: 24 },
    { kind: "sightscreen", bearing: 0, radius: 69.8, width: 12, height: 5 },
    // The Old Stand, square of the wicket on the right.
    { kind: "stand", bearing: 90, radius: 77, width: 58, depth: 15, wall: 1.2, rise: 6.4, eave: 8.8, walls: "brick", seed: 25 },
    // The scoreboard end: banks either side of the scoreboard, tents along from it.
    { kind: "bank", from: 140, to: 222, r0: 76, r1: 92, height: 3, top: 106, people: 0.16, seed: 33 },
    { kind: "scoreboard", bearing: 168, radius: 94, base: 3, width: 12 },
    { kind: "tents", from: 122, to: 139, radius: 80, colours: ["#c8433a", "#2f6fb0", "#3a8a4a"] },
    { kind: "sightscreen", bearing: 180, radius: 69.8, width: 12, height: 5 },
    // The Hill on the left.
    { kind: "bank", from: 236, to: 304, r0: 76, r1: 100, height: 6.5, top: 110, people: 0.2, seed: 35, rugs: 0.16 },
    // Floodlights at the corners.
    { kind: "floodlight", bearing: 48, radius: 97, height: 40 },
    { kind: "floodlight", bearing: 132, radius: 97, height: 40 },
    { kind: "floodlight", bearing: 228, radius: 104, height: 40 },
    { kind: "floodlight", bearing: 312, radius: 104, height: 40 },
    // Trees: tall behind the pavilion and the Old Stand, on top of the Hill, lower and further off behind the scoreboard.
    {
      kind: "trees",
      from: 312,
      to: 48,
      r0: 114,
      r1: 150,
      count: 70,
      height: [14, 22],
      kinds: ["oak", "elm", "elm", "pine"],
      seed: 52,
    },
    { kind: "trees", from: 48, to: 132, r0: 100, r1: 140, count: 60, height: [13, 20], kinds: ["oak", "elm", "gum"], seed: 53 },
    { kind: "trees", from: 132, to: 230, r0: 122, r1: 175, count: 46, height: [9, 14], kinds: ["gum", "elm", "oak"], seed: 54 },
    { kind: "trees", from: 228, to: 314, r0: 110, r1: 150, count: 64, height: [14, 21], kinds: ["gum", "gum", "oak"], seed: 55 },
    { kind: "trees", from: 240, to: 300, r0: 104, r1: 112, count: 9, height: [13, 18], kinds: ["gum"], base: 6.5, seed: 56 },
  ],
  /** Where things will move later (TODO.md): the flags, the scoreboard's face, the crowd's layer. */
  life: { flags: ["pavilion", "scoreboard"], scoreboard: "scoreboard", crowd: "crowd" },
  /** Layers painted over the drawn ones (venue-paint-over.js): none yet. */
  painted: {},
};
