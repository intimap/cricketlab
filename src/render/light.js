/**
 * Times of day. Each is a few numbers the renderer reads:
 *   - tint: multiplied over the whole scene every frame (sprites and ground alike);
 *   - glow: a warm wash over the bottom of the sky, towards the horizon;
 *   - shade: the stands' and trees' shadow across the outfield, as a fraction of their height;
 *   - shadow: how far players' and the ball's shadows are drawn out (1 = round, overhead sun).
 * Midday is the plain look the art was made in.
 */
export const LIGHTS = {
  midday: { name: "MIDDAY", shadow: { stretch: 1 } },
  afternoon: {
    name: "AFTERNOON",
    tint: "#ffe4bf",
    glow: { colour: "#ffd08a", amount: 0.55 },
    shade: { colour: "#1d3a22", amount: 0.38, length: 0.26 },
    shadow: { stretch: 2.2 },
  },
  evening: {
    name: "EVENING",
    tint: "#f6c99a",
    glow: { colour: "#ff9e5c", amount: 0.7 },
    shade: { colour: "#1a2f24", amount: 0.45, length: 0.45 },
    shadow: { stretch: 3.4 },
  },
};
