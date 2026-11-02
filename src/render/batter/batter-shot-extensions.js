// Compose the additional poses without growing the existing three-clip module.
import { extendDriveShots } from "./batter-shots/drive.js";
import { extendBackFootShots } from "./batter-shots/back-foot.js";
import { extendSpecialShots } from "./batter-shots/sweeps-ramps.js";
import { extendTouchShots } from "./batter-shots/touch.js";
export function extendBatterShots(context) {
  return Object.assign(
    {},
    extendDriveShots(context),
    extendBackFootShots(context),
    extendSpecialShots(context),
    extendTouchShots(context),
  );
}
