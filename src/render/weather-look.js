/**
 * The weather on top of a time of day (render/light.js): cloud greys the light and fills the sky, haze
 * softens it, heat brightens it, and rain darkens it further while it falls. The result is a light like
 * the ones in light.js, so lighting.js, the ground builder and the effects levels treat it the same way.
 *
 * Each weather (sim/weather.js ids):
 *   tint      multiplied into the time's tint          sky     { top, foot, amount }: how far the time's sky goes to it
 *   shadows   share of the sun's shadows left           glow    share of the evening glow left
 *   warm      share of the warm grade left              dim     extra dimming of the scenery { colour, amount }
 *   clouds    { count (x the ground's), colour, amount (greying them) }
 *   haze      { colour, amount }: a pale wash over the frame, strongest towards the horizon
 *   stars     share of a night's stars still showing
 */
const WEATHER_LOOKS = {
  sunny: null,
  hot: {
    tint: "#fff6e8",
    sky: { top: "#2a62c4", foot: "#a6d2f6", amount: 0.45 },
    shadows: 1.12,
    clouds: { count: 0.3 },
  },
  humid: {
    tint: "#f6f1e2",
    sky: { top: "#9fbcd2", foot: "#ece5cc", amount: 0.6 },
    shadows: 0.6,
    warm: 0.8,
    clouds: { count: 1.4, colour: "#e6dfc6", amount: 0.3 },
    haze: { colour: "#f2ecd4", amount: 0.16 },
    stars: 0.4,
  },
  overcast: {
    tint: "#d6dbde",
    sky: { top: "#7b838a", foot: "#b8bdc0", amount: 0.88 },
    shadows: 0.15,
    glow: 0.2,
    warm: 0.25,
    dim: { colour: "#4e555b", amount: 0.12 },
    clouds: { count: 4, colour: "#8f979c", amount: 0.45 },
    stars: 0,
  },
  rain: {
    tint: "#c4cbd0",
    sky: { top: "#535b62", foot: "#8f969b", amount: 0.92 },
    shadows: 0.05,
    glow: 0,
    warm: 0,
    dim: { colour: "#3c4349", amount: 0.2 },
    clouds: { count: 5, colour: "#646d74", amount: 0.6 },
    stars: 0,
  },
};

/** While it's actually raining (play stopped): darker still, on top of the showers look. */
const RAINING = { tint: "#b4bcc2", dim: 0.12, vignette: 0.08 };

/** The art's own sky at each time, for weather to change when the time paints none of its own. */
const DAY_SKY = { top: "#4f8fd8", foot: "#b6dcf4" };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) =>
  `#${c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
const multiply = (a, b) => (a && b ? hex(rgb(a).map((v, i) => (v * rgb(b)[i]) / 255)) : (a ?? b));
const mix = (a, b, k) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * k));

/** Each time and weather's light, made once, so the grade's layers (cached by object) are made once too. */
const made = new Map();

/** The time of day `light` (light.js) under weather `id`, `raining` while play is stopped. */
export function weatherLight(light, id, raining = false) {
  const w = WEATHER_LOOKS[id];
  if (!w && !raining) return light;
  const key = `${light.name}:${id}:${raining}`;
  if (!made.has(key)) made.set(key, build(light, w ?? {}, raining));
  return made.get(key);
}

function build(light, w, raining) {
  const hd = light.hd ?? {};
  const night = !!hd.lamps;
  const tint = (t) => multiply(multiply(t, w.tint), raining ? RAINING.tint : null);
  const glow = (g) => (g && w.glow !== undefined ? { ...g, amount: g.amount * w.glow } : g);
  // The sky: the time's own (or the art's blue) moved towards the weather's; at night only a little.
  let sky = hd.sky;
  if (w.sky) {
    const base = hd.sky ?? DAY_SKY;
    const k = w.sky.amount * (night ? 0.35 : 1);
    sky = {
      top: mix(base.top, w.sky.top, k),
      foot: mix(base.foot, w.sky.foot, k),
      stars: Math.round((base.stars ?? 0) * (w.stars ?? 1)),
    };
  }
  const dimAmount = (hd.dim?.amount ?? 0) + (w.dim?.amount ?? 0) + (raining ? RAINING.dim : 0);
  const dimColour = w.dim?.colour ?? hd.dim?.colour ?? "#3c4349";
  const dim = dimAmount > 0 ? { colour: dimColour, amount: Math.min(0.6, dimAmount) } : undefined;
  const grade = { ...(hd.grade ?? {}) };
  if (grade.warm && w.warm !== undefined)
    grade.warm = w.warm > 0 ? { ...grade.warm, amount: grade.warm.amount * w.warm } : undefined;
  if (raining) grade.vignette = (grade.vignette ?? 0) + RAINING.vignette;
  if (w.haze) grade.haze = w.haze;
  const casts = (hd.casts ?? [])
    .map((c) => ({ ...c, alpha: Math.min(0.45, c.alpha * (w.shadows ?? 1)) }))
    .filter((c) => c.alpha >= 0.03);
  const shade = light.shade && { ...light.shade, amount: light.shade.amount * Math.min(1, w.shadows ?? 1) };
  return {
    ...light,
    tint: tint(light.tint),
    glow: glow(light.glow),
    shade,
    clouds: w.clouds,
    hd: { ...hd, tint: tint(hd.tint ?? light.tint), glow: glow(hd.glow), sky, dim, grade, casts },
  };
}
