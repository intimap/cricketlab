/**
 * Grounds as data. Each view is built from layers (see ground.js):
 *   - scenery: the painting the hand-drawn parts come from (sky, trees,
 *     stands, fence) - for now, slices of the two original paintings;
 *   - everything the game's geometry touches (outfield, pitch, creases,
 *     stumps, rope) is drawn in code from these numbers, so it always
 *     lines up with the camera and can vary from ground to ground.
 *
 * Colours are base shades; the builder adds pixel jitter and specks so the
 * surfaces read as grass and earth rather than flat fills.
 */
export const GROUNDS = {
  oval: {
    name: "THE OVAL",
    grass: { light: "#60a72e", dark: "#448f31" },
    // Worn, lighter grass in a band round the pitch (flecked with bare earth), with a dark line on its outer edge.
    surround: { colour: "#8aa630", fleck: "#a1a839", edge: "#5a7224", width: 0.26 },
    crease: "#efeedd",
    stumps: { wood: "#9a6a2c", shade: "#5e3d17", bail: "#c8955a" },
    close: {
      scenery: "close",
      // First row of the painting (file rows) drawn in code: just below the fence.
      groundFrom: 124,
      // Mowing stripes as distances down the ground (m) where light and dark swap,
      // matched to the original painting. The band from the first edge to the next is light.
      stripes: { edges: [0, 0.89, 2.86, 5.2, 7.92, 11.6, 15.2, 18.97, 21.96, 25.67, 28.4], firstLight: true },
      // Rows nearest the fence fade towards this light haze.
      haze: { colour: "#7cbc3c", rows: 14, amount: 0.35 },
    },
    wide: {
      scenery: "wide",
      grass: { light: "#5d9c3f", dark: "#4a8c3d" },
      // Stripes across the wide view: screen rows where light and dark swap.
      stripes: { edgesY: [132, 146, 161, 176, 193, 210, 228, 245, 263, 281, 301, 315, 329], firstLight: true },
      innerCircle: { cx: 318, cy: 205, rx: 147, ry: 66, colour: "#35723d" },
      rope: { colour: "#f4f1c6", shade: "#cbcda9" },
      // The strip as painted from up here (px): half its width at the far and near ends,
      // the worn rim round it, and how tall the stumps stand.
      pitch: { halfFar: 18, halfNear: 21, rim: 6, stumps: 9 },
    },
  },
};

/**
 * How each pitch type looks: base colour, its specks, how wear changes it,
 * and whether it's cracked.
 */
export const PITCH_LOOKS = {
  green: { base: "#6f974a", speck: "#5d8a3c", worn: "#9a9a5c", cracks: 0 },
  dust: { base: "#b59d64", speck: "#9c8350", worn: "#c7ae76", cracks: 0 },
  cracked: { base: "#a8955e", speck: "#8f7c4b", worn: "#b8a46c", cracks: 26 },
};
