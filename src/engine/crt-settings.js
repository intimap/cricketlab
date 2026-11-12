import { load, save } from "./storage.js";

/**
 * The CRT look's settings (engine/crt.js draws it): a preset, or each part of it LOW, MED or HIGH. CLASSIC is
 * every part at MED, the look the game had from the start; SHARP is no CRT at all. A look that matches no
 * preset is CUSTOM, and it's kept, so the presets can be tried and CUSTOM chosen again. Remembered here.
 */

export const CRT_LEVELS = ["low", "med", "high"];
export const CRT_LEVEL_NAMES = { low: "LOW", med: "MED", high: "HIGH" };

/** The parts, in the menu's order: each one's LOW, MED and HIGH value (in the shader's units), and what it does. */
export const CRT_PARTS = [
  { key: "curve", name: "CURVE", values: [9, 5.5, 3.6], about: "HOW FAR THE GLASS BOWS OUT AT THE EDGES" },
  { key: "scanlines", name: "SCANLINES", values: [0.18, 0.38, 0.6], about: "THE DARK LINE ACROSS EACH ROW OF PIXELS" },
  { key: "mask", name: "PHOSPHOR", values: [0.06, 0.14, 0.26], about: "THE FINE RED, GREEN AND BLUE STRIPES" },
  { key: "glow", name: "GLOW", values: [0.4, 1, 1.8], about: "BRIGHT THINGS BLEEDING INTO THEIR NEIGHBOURS" },
  { key: "fringe", name: "FRINGE", values: [0.12, 0.35, 0.8], about: "RED AND BLUE A TOUCH OUT OF LINE: COLOURED EDGES" },
  { key: "corners", name: "CORNERS", values: [0.1, 0.22, 0.4], about: "THE PICTURE DARKENING TOWARDS THE CORNERS" },
  { key: "flicker", name: "FLICKER", values: [0, 0.008, 0.025], about: "A FAINT WOBBLE IN THE BRIGHTNESS (NONE ON LOW)" },
  { key: "brightness", name: "BRIGHTNESS", values: [1.06, 1.18, 1.3], about: "MAKING UP FOR WHAT THE LINES AND STRIPES DARKEN" },
];

const every = (level) => Object.fromEntries(CRT_PARTS.map((p) => [p.key, level]));

/** The presets' levels (SHARP has none: the CRT is off). */
const PRESET_LEVELS = {
  subtle: every("low"),
  classic: every("med"),
  // Strong, but a flicker that strong would tire the eyes.
  strong: { ...every("high"), flicker: "med" },
};
export const CRT_PRESETS = ["sharp", "subtle", "classic", "strong"];
export const CRT_PRESET_NAMES = { sharp: "SHARP", subtle: "SUBTLE", classic: "CLASSIC", strong: "STRONG", custom: "CUSTOM" };

const same = (a, b) => CRT_PARTS.every((p) => a[p.key] === b[p.key]);
const presetOf = (levels) => Object.keys(PRESET_LEVELS).find((id) => same(PRESET_LEVELS[id], levels)) ?? "custom";

function loadLook() {
  const stored = load("crtLook", null);
  const levels = { ...every("med"), ...(stored?.levels ?? {}) };
  for (const p of CRT_PARTS) if (!CRT_LEVELS.includes(levels[p.key])) levels[p.key] = "med";
  // Before there were settings, the CRT was just on or off.
  const preset = stored ? stored.preset : load("crt", true) === false ? "sharp" : "classic";
  return { preset: preset === "sharp" ? "sharp" : presetOf(levels), levels, custom: stored?.custom ?? null };
}

let look = loadLook();
const keep = () => save("crtLook", look);

export const crtEnabled = () => look.preset !== "sharp";
export const crtPreset = () => look.preset;
export const crtLevel = (key) => look.levels[key];

/** A preset: its levels (SHARP turns the CRT off and keeps them); "custom" brings back the kept custom look. */
export function setCrtPreset(id) {
  if (id === "custom" && look.custom) look.levels = { ...look.custom };
  else if (PRESET_LEVELS[id]) look.levels = { ...PRESET_LEVELS[id] };
  look.preset = id === "sharp" ? "sharp" : presetOf(look.levels);
  keep();
}

/** The presets one way from the current one, CUSTOM among them once there is one. */
export function cycleCrtPreset(dir = 1) {
  const ids = look.custom ? [...CRT_PRESETS, "custom"] : CRT_PRESETS;
  const at = Math.max(0, ids.indexOf(look.preset));
  setCrtPreset(ids[(at + dir + ids.length) % ids.length]);
}

/** One part a level up or down (round from HIGH to LOW): the look becomes the preset it matches, or CUSTOM. */
export function cycleCrtLevel(key, dir = 1) {
  look.levels[key] = CRT_LEVELS[(CRT_LEVELS.indexOf(look.levels[key]) + dir + CRT_LEVELS.length) % CRT_LEVELS.length];
  look.preset = presetOf(look.levels);
  if (look.preset === "custom") look.custom = { ...look.levels };
  keep();
}

/** On or off (the old switch): on brings back the look it had. */
export function setCrt(value) {
  if (!value) look.preset = "sharp";
  else if (look.preset === "sharp") look.preset = presetOf(look.levels);
  keep();
}

/** The shader's numbers for the look now: { curve: { x, y }, scanlines, mask, glow, fringe, corners, flicker, brightness }. */
export function crtValues() {
  const v = Object.fromEntries(CRT_PARTS.map((p) => [p.key, p.values[CRT_LEVELS.indexOf(look.levels[p.key])]]));
  // The glass bows a little more top to bottom than across (it's wider than it is tall).
  return { ...v, curve: { x: v.curve, y: v.curve * (4.5 / 5.5) } };
}
