/**
 * Grounds as data. Each view is built from layers (see ground.js):
 *   - scenery: the hand-made parts (sky, clouds, trees, stands, fence) -
 *     either one painting or a stack of art layers, by asset id (assets.js);
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
    // Not offered on the menu for now (Parklands is built on it, so it stays). Drop this to bring it back.
    hidden: true,
    grass: { light: "#60a72e", dark: "#448f31" },
    // Worn, lighter grass in a band round the pitch (flecked with bare earth), with a dark line on its outer edge.
    surround: { colour: "#8aa630", fleck: "#a1a839", edge: "#5a7224", width: 0.26 },
    crease: "#efeedd",
    stumps: { wood: "#9a6a2c", shade: "#5e3d17", bail: "#c8955a" },
    close: {
      scenery: "ground-close",
      // First row of the painting (file rows) drawn in code: just below the fence.
      groundFrom: 124,
      // Mowing stripes as distances down the ground (m) where light and dark swap,
      // matched to the original painting. The band from the first edge to the next is light.
      stripes: { edges: [0, 0.89, 2.86, 5.2, 7.92, 11.6, 15.2, 18.97, 21.96, 25.67, 28.4], firstLight: true },
      // Rows nearest the fence fade towards this light haze.
      haze: { colour: "#7cbc3c", rows: 14, amount: 0.35 },
    },
    wide: {
      scenery: "ground-wide",
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

/** A ground built from layered art (tools/art/make_scenery.py and make_scenery_wide.py), with a choice of fence. */
function parklands(name, fence) {
  const oval = GROUNDS.oval;
  return {
    ...oval,
    hidden: false,
    name,
    close: {
      ...oval.close,
      // Layers in the painting's rows: sky, clouds, trees, stands, fence; the ground starts at row 124.
      scenery: [
        { image: "close/sky", y: 0, sky: true },
        // Rows 0-23 are above the top of the screen, so the clouds and trees start below that.
        { clouds: "close/clouds", count: 5, top: 25, bottom: 62 },
        { image: "close/treeline", y: 40 },
        { image: "close/stands", y: 58 },
        { image: `close/${fence}`, y: 112 },
      ],
    },
    wide: {
      ...oval.wide,
      // Sky, trees, stands and fence above the field; the fence's foot meets the top of the rope (row 107).
      scenery: [
        { image: "wide/sky", y: 0, sky: true },
        { clouds: "close/clouds", count: 4, top: 0, bottom: 26 },
        { image: "wide/treeline", y: 9 },
        { image: "wide/stands", y: 51 },
        { image: `wide/${fence}`, y: 93 },
      ],
      // Grass is drawn from here down, outside the rope too.
      groundFrom: 107,
      // The painted scoreboard's face below its clock (screen px), written over with the real score.
      scoreboard: { x: 526, y: 64, w: 57, h: 21, colour: "#1c2b25", top: "#ffd23a", bottom: "#f4f4ee" },
      // Trees in the near corners, over the edge of the field.
      foreground: [
        { image: "wide/trees-left", x: 0, y: 255 },
        { image: "wide/trees-right", x: 360, y: 255 },
      ],
    },
  };
}

GROUNDS.parklands = parklands("PARKLANDS OVAL", "fence-picket");
GROUNDS.parklandsBoards = parklands("PARKLANDS (BOARDS)", "fence-ads");

/** The G: a floodlit Melbourne mega-stadium at night (tools/art/make_theg.py). Picking it sets the floodlit night light. */
function theG() {
  const oval = GROUNDS.oval;
  return {
    ...oval,
    name: "THE MCG",
    hidden: false,
    light: "night",
    grass: { light: "#4c9438", dark: "#38782a" },
    close: {
      ...oval.close,
      groundFrom: 124,
      scenery: [
        { image: "theg/close/sky", y: 0, sky: true },
        { image: "theg/close/skyline", y: 15 },
        { image: "theg/close/stands", y: 49 },
        { image: "theg/close/fence-ads", y: 112 },
      ],
      haze: { colour: "#4a7838", rows: 12, amount: 0.2 },
    },
    wide: {
      ...oval.wide,
      groundFrom: 107,
      scenery: [
        { image: "theg/wide/sky", y: 0, sky: true },
        // Down to where the stands' rim starts, so no sky shows under the city.
        { image: "theg/wide/skyline", y: 11 },
        { image: "theg/wide/stands", y: 46 },
        { image: "theg/wide/fence-ads", y: 93 },
      ],
      scoreboard: { x: 520, y: 55, w: 60, h: 22, colour: "#101620", top: "#ffd23a", bottom: "#f4f4ee" },
    },
  };
}

GROUNDS.theG = theG();

/** Lord's: Victorian brickwork and the white Media Centre over an English summer outfield. */
GROUNDS.lords = {
  ...GROUNDS.oval,
  name: "LORD'S",
  hidden: false,
  light: "midday",
  grass: { light: "#488c2c", dark: "#357321" },
  surround: { colour: "#6d9c2a", fleck: "#8a9a34", edge: "#41601a", width: 0.26 },
  crease: "#f2f1e6",
  stumps: { wood: "#b2853c", shade: "#6e4a1a", bail: "#d4a558" },
  close: {
    ...GROUNDS.oval.close,
    groundFrom: 124,
    scenery: [
      { image: "close/lords-sky", y: 0, sky: true },
      { clouds: "close/clouds", count: 4, top: 20, bottom: 55 },
      { image: "close/lords-stands", y: 58 },
      { image: "close/lords-fence", y: 112 },
    ],
    stripes: { edges: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30], firstLight: true },
    haze: { colour: "#6fa84a", rows: 14, amount: 0.30 },
  },
  wide: {
    ...GROUNDS.oval.wide,
    grass: { light: "#488c2c", dark: "#357321" },
    groundFrom: 107,
    scenery: [
      { image: "wide/lords-sky", y: 0, sky: true },
      { clouds: "close/clouds", count: 3, top: 0, bottom: 22 },
      { image: "wide/lords-stands", y: 51 },
      { image: "wide/lords-fence", y: 93 },
    ],
    scoreboard: { x: 565, y: 67, w: 57, h: 21, colour: "#162a1e", top: "#f8f6e2", bottom: "#ded8c4" },
    rope: { colour: "#f8f6e2", shade: "#d2d0b0" },
  },
};

/** The grounds the menu offers, the first being the default. */
export const GROUND_CHOICES = Object.keys(GROUNDS).filter((id) => !GROUNDS[id].hidden);
export const DEFAULT_GROUND = "parklands";

/**
 * How each pitch type looks: base colour, its specks, how wear changes it,
 * and whether it's cracked.
 */
export const PITCH_LOOKS = {
  green: { base: "#6f974a", speck: "#5d8a3c", worn: "#9a9a5c", cracks: 0 },
  dust: { base: "#b59d64", speck: "#9c8350", worn: "#c7ae76", cracks: 0 },
  cracked: { base: "#a8955e", speck: "#8f7c4b", worn: "#b8a46c", cracks: 26 },
};
