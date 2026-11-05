// Compose the additional poses without growing the existing three-clip module.
import { extendDriveShots } from "./batter-shots/drive.js";
import { extendBackFootShots } from "./batter-shots/back-foot.js";
import { extendSpecialShots } from "./batter-shots/sweeps-ramps.js";
import { extendTouchShots } from "./batter-shots/touch.js";
import { extendVariantShots } from "./batter-shots/variants.js";
export function extendBatterShots(context) {
  const built = Object.assign(
    {},
    extendDriveShots(context),
    extendBackFootShots(context),
    extendSpecialShots(context),
    extendTouchShots(context),
  );
  // Strokes built on those (the upper cut on the cut, the sway on the leave...).
  return Object.assign(built, extendVariantShots({ ...context, clips: { ...context.clips, ...built } }));
}
