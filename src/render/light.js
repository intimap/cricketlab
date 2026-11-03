/**
 * Times of day. Each is a few numbers the renderer reads:
 *   - tint: multiplied over the whole scene every frame (sprites and ground alike);
 *   - glow: a warm wash over the bottom of the sky, towards the horizon;
 *   - shade: the stands' and trees' shadow across the outfield, as a fraction of their height;
 *   - shadow: how far players' and the ball's shadows are drawn out (1 = round, overhead sun).
 * Midday is the plain look the art was made in; night is for floodlit grounds (The G's art is a night sky).
 *
 * `hd` is the HD-2D look, used instead when effects are on (render/lighting.js):
 *   - tint, glow: as above, replacing the plain ones;
 *   - sky: { top, foot, stars? } painted over the sky layer (the evening and night skies);
 *   - dim: { colour, amount } laid over the scenery but the sky (the stands and trees in the dark);
 *   - grade: { warm?: { colour, amount, from }, vignette } over each frame;
 *   - casts: the sun's (or floodlights') shadows: [{ x, z, length, alpha }], the ground direction each points
 *     (metres, + x to the off side, - z towards the striker's end) and metres of shadow per metre of height;
 *   - lamps: floodlights glow (night).
 */
export const LIGHTS = {
  midday: {
    name: "MIDDAY",
    shadow: { stretch: 1 },
    hd: { grade: { vignette: 0.1 }, casts: [{ x: 0.3, z: -1, length: 0.35, alpha: 0.32 }] },
  },
  afternoon: {
    name: "AFTERNOON",
    tint: "#ffe4bf",
    glow: { colour: "#ffd08a", amount: 0.55 },
    shade: { colour: "#1d3a22", amount: 0.38, length: 0.26 },
    shadow: { stretch: 2.2 },
    hd: {
      tint: "#fff0d8",
      glow: { colour: "#ffd08a", amount: 0.45 },
      grade: { warm: { colour: "#ffb050", amount: 0.22 }, vignette: 0.16 },
      casts: [{ x: 0.45, z: -1, length: 1.25, alpha: 0.34 }],
    },
  },
  evening: {
    name: "EVENING",
    tint: "#f6c99a",
    glow: { colour: "#ff9e5c", amount: 0.7 },
    shade: { colour: "#1a2f24", amount: 0.45, length: 0.45 },
    shadow: { stretch: 3.4 },
    hd: {
      tint: "#ffe2c4",
      sky: { top: "#4a5aa0", foot: "#ffad6a" },
      dim: { colour: "#3a2a40", amount: 0.18 },
      grade: { warm: { colour: "#ff8a3a", amount: 0.34 }, vignette: 0.26 },
      casts: [{ x: 0.6, z: -1, length: 2.4, alpha: 0.3 }],
    },
  },
  // Under floodlights: a cool, bright white over everything, no sunset glow in the sky and no long
  // shadow of the stands; players' shadows sit straight under them, as from towers all round.
  night: {
    name: "NIGHT",
    tint: "#e8eeff",
    shadow: { stretch: 1 },
    hd: {
      tint: "#eef2ff",
      sky: { top: "#050816", foot: "#1d2b55", stars: 46 },
      dim: { colour: "#0b1030", amount: 0.5 },
      grade: { vignette: 0.34 },
      // Towers either side, so two faint, short shadows (the far towers' are lost under them).
      casts: [
        { x: -0.8, z: -1, length: 0.55, alpha: 0.2 },
        { x: 0.8, z: -1, length: 0.55, alpha: 0.2 },
      ],
      lamps: true,
    },
  },
};
