import {
  CRT_PARTS,
  CRT_LEVEL_NAMES,
  CRT_PRESET_NAMES,
  crtPreset,
  crtLevel,
  crtEnabled,
  cycleCrtPreset,
  cycleCrtLevel,
} from "../engine/crt-settings.js";

/**
 * The menu's SCREEN page (from SCREEN on where and when): the CRT look's preset at the top, then each part of
 * it LOW, MED or HIGH (engine/crt-settings.js). Left and right change the row; the whole menu is drawn through
 * the CRT, so each change shows at once. Rows for the menu's row list (scenes/menu.js): [key, label, value].
 */

export function screenRows() {
  return [
    ["crtPreset", "PRESET", CRT_PRESET_NAMES[crtPreset()]],
    ...CRT_PARTS.map((p) => [`crt:${p.key}`, p.name, CRT_LEVEL_NAMES[crtLevel(p.key)]]),
    ["done", "", "<  DONE"],
  ];
}

/** Left or right on one of the page's rows. */
export function stepScreenRow(key, dir) {
  if (key === "crtPreset") cycleCrtPreset(dir);
  else if (key.startsWith("crt:")) cycleCrtLevel(key.slice(4), dir);
}

/** What the chosen row does, under the rows. */
export function screenBlurb(key) {
  if (key === "crtPreset")
    return crtEnabled()
      ? "SUBTLE, CLASSIC (ORIGINAL) OR STRONG; CHANGE A PART: CUSTOM"
      : "SHARP: PLAIN PIXELS. A PRESET OR A PART BRINGS THE CRT BACK";
  const part = CRT_PARTS.find((p) => `crt:${p.key}` === key);
  return part ? `${part.about}.` : "BACK TO WHERE AND WHEN.";
}
