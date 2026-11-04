import { WIDTH, HEIGHT } from "../engine/screen.js";

/**
 * The HD-2D look on top of the pixel art: grading each frame, the evening and night skies and dimmed
 * scenery (painted into the ground once, when it's built), floodlight glow, and which way shadows fall.
 * Each effect can be turned down (EFFECTS) for slower machines; "off" is the plain look, unchanged.
 */

/** AUTO is full, stepping down to simple on a slow machine (scenes/effects-auto.js). */
export const EFFECTS = ["auto", "full", "simple", "off"];
export const EFFECT_NAMES = { auto: "AUTO", full: "FULL", simple: "SIMPLE", off: "OFF" };

const NONE = { grade: false, shadows: false, bloom: false };

/**
 * The light (render/light.js) as the renderer uses it at an effects level: its HD-2D look merged in, and
 * `fx` saying what's on. "simple" grades and repaints the sky but keeps the round shadows and no glow.
 */
export function lookFor(light, effects = "full") {
  const hd = light.hd;
  if (effects === "off" || !hd) return { ...light, fx: NONE };
  const full = effects === "full";
  return {
    ...light,
    tint: hd.tint ?? light.tint,
    glow: hd.glow ?? (hd.sky ? undefined : light.glow),
    sky: hd.sky,
    dim: hd.dim,
    grade: hd.grade,
    casts: full ? hd.casts : [],
    lamps: !!hd.lamps,
    // Cast shadows replace the drawn-out round ones; the round ones stay as contact shadows under the feet.
    shadow: full ? { stretch: 1 } : light.shadow,
    fx: { grade: true, shadows: full, bloom: full },
  };
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgba = (hex, a) => `rgba(${rgb(hex).join(",")},${a})`;

/** Deterministic 0..1 from an integer, for the stars (no dice: this is only the picture). */
const noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Over a sky layer just drawn (all that's on the canvas yet) between rows top..foot: the look's own sky. */
export function paintSky(ctx, top, foot, look, seed = 1) {
  const sky = look.sky;
  if (!sky) return;
  const wash = ctx.createLinearGradient(0, top, 0, foot);
  wash.addColorStop(0, sky.top);
  wash.addColorStop(1, sky.foot);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = wash;
  ctx.fillRect(0, top, WIDTH, foot - top);
  // Stars in the upper part of a night sky, a few brighter than the rest.
  for (let i = 0; i < (sky.stars ?? 0); i++) {
    const x = Math.floor(noise(seed * 31 + i) * WIDTH);
    const y = Math.floor(top + noise(seed * 57 + i * 3) * (foot - top) * 0.55);
    ctx.fillStyle = noise(i * 7 + 3) > 0.8 ? "#ffffff" : "#9aa6d8";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

/** Over a canvas of scenery (no sky), the look's dimming: the stands and trees in the evening and dark. */
export function dimScenery(ctx, look) {
  if (!look.dim) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = rgba(look.dim.colour, look.dim.amount);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
}

/**
 * A single painting (no separate sky layer) relit for a look with its own sky or dimming: the blue of its
 * sky, in the upper part of the picture, is swapped for the look's sky; the rest is dimmed. Clouds stay,
 * dimmed with the stands, as if moonlit.
 */
export function relightPainting(ctx, look, seed = 1) {
  if (!look.sky && !look.dim) return;
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const data = image.data;
  let sky = null;
  if (look.sky) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const g = canvas.getContext("2d");
    g.fillRect(0, 0, WIDTH, HEIGHT);
    paintSky(g, 0, Math.round(HEIGHT * SKY_ROWS), look, seed);
    sky = g.getImageData(0, 0, WIDTH, HEIGHT).data;
  }
  const [dr, dg, db] = look.dim ? rgb(look.dim.colour) : [0, 0, 0];
  const dim = look.dim?.amount ?? 0;
  const skyRows = Math.round(HEIGHT * SKY_ROWS);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (sky && i / 4 / WIDTH < skyRows && b > r + 25 && b > g) {
      data[i] = sky[i];
      data[i + 1] = sky[i + 1];
      data[i + 2] = sky[i + 2];
    } else if (dim) {
      data[i] = r + (dr - r) * dim;
      data[i + 1] = g + (dg - g) * dim;
      data[i + 2] = b + (db - b) * dim;
    }
  }
  ctx.putImageData(image, 0, 0);
}
/** How far down a painting its sky can reach (share of the height). */
const SKY_ROWS = 0.4;

/**
 * Floodlights on, for a night look: each lamp's face ([x, y, w, h], screen px) lit, and with full effects
 * a halo and a wide soft glow round it, painted once into the ground.
 */
export function paintLamps(ctx, lamps, look) {
  if (!look.lamps || !lamps?.length) return;
  ctx.save();
  for (const [x, y, w, h] of lamps) {
    ctx.fillStyle = "#fffbe6";
    ctx.fillRect(x, y, w, h);
    if (!look.fx.bloom) continue;
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.globalCompositeOperation = "lighter";
    for (const [radius, alpha] of [
      [w * 1.6, 0.55],
      [w * 5, 0.16],
    ]) {
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      halo.addColorStop(0, `rgba(255,248,220,${alpha})`);
      halo.addColorStop(1, "rgba(255,248,220,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

/**
 * The frame's grade, over the field and everyone on it (before the scoreboard and panels): the time of
 * day's tint, then with effects a warm light from the far side, where the sun is, and a vignette.
 */
export function gradeFrame(ctx, look) {
  ctx.save();
  if (look.tint) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = look.tint;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  const grade = look.fx.grade && look.grade;
  if (grade) {
    // Gradients are slow to fill every frame on a small machine: each is drawn once, then copied.
    let layers = gradeLayers.get(grade);
    if (!layers) gradeLayers.set(grade, (layers = buildGradeLayers(grade)));
    if (layers.warm) {
      ctx.globalCompositeOperation = "soft-light";
      ctx.drawImage(layers.warm, 0, 0);
    }
    if (layers.haze) {
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(layers.haze, 0, 0);
    }
    if (layers.vignette) {
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(layers.vignette, 0, 0);
    }
  }
  ctx.restore();
}

/** Each look's grade, drawn once into canvases: { warm?, haze?, vignette? }. */
const gradeLayers = new Map();

function buildGradeLayers(grade) {
  const layer = (paint) => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const g = canvas.getContext("2d");
    g.fillStyle = paint(g);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    return canvas;
  };
  return {
    warm:
      grade.warm &&
      layer((g) => {
        const warm = g.createLinearGradient(0, 0, 0, HEIGHT);
        warm.addColorStop(0, rgba(grade.warm.colour, grade.warm.amount));
        warm.addColorStop(0.7, rgba(grade.warm.colour, grade.warm.amount * 0.25));
        warm.addColorStop(1, rgba(grade.warm.colour, 0));
        return warm;
      }),
    // Humid haze: a pale wash, thickest towards the horizon at the top of the picture.
    haze:
      grade.haze &&
      layer((g) => {
        const haze = g.createLinearGradient(0, 0, 0, HEIGHT);
        haze.addColorStop(0, rgba(grade.haze.colour, grade.haze.amount));
        haze.addColorStop(1, rgba(grade.haze.colour, grade.haze.amount * 0.3));
        return haze;
      }),
    vignette:
      grade.vignette &&
      layer((g) => {
        const edge = g.createRadialGradient(WIDTH / 2, HEIGHT * 0.55, HEIGHT * 0.35, WIDTH / 2, HEIGHT * 0.55, WIDTH * 0.62);
        edge.addColorStop(0, "rgba(0,0,0,0)");
        edge.addColorStop(1, `rgba(0,0,0,${grade.vignette})`);
        return edge;
      }),
  };
}

/**
 * Which way a figure's shadow falls on screen for one of the look's casts: screen px per px of height,
 * for a figure `heightM` tall and `heightPx` on screen with its feet at (x, z), through `project`.
 */
export function shadowSlope(project, x, z, heightM, heightPx, cast) {
  const len = Math.hypot(cast.x, cast.z) || 1;
  const reach = (cast.length * heightM) / len;
  // Shadows reaching back past the camera are held at its edge.
  const toZ = Math.max(-4, z + cast.z * reach);
  const foot = project(x, 0, z);
  const tip = project(x + cast.x * reach, 0, toZ);
  return { gx: (tip.x - foot.x) / heightPx, gy: (tip.y - foot.y) / heightPx };
}
