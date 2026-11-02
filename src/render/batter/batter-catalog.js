// One route for every current (input family, realised shot label) pair.
// A label alone is insufficient: square drives and leg glances have two inputs.
export const SHOT_CATALOG = [
  ["straightDrive", "drive", "straight drive", "Front-foot drives"],
  ["offDrive", "drive", "off drive", "Front-foot drives"],
  ["coverDrive", "drive", "cover drive", "Front-foot drives"],
  ["squareDrive", "drive", "square drive", "Front-foot drives"],
  ["onDrive", "drive", "on drive", "Front-foot drives"],
  ["clipOffPads", "drive", "clip off the pads", "Front-foot drives"],
  ["legGlance", "drive", "leg glance", "Front-foot drives"],
  ["backFootDrive", "cutpull", "back-foot drive", "Back-foot shots"],
  ["cut", "cutpull", "cut", "Back-foot shots"],
  ["lateCut", "cutpull", "late cut", "Back-foot shots"],
  ["pull", "cutpull", "pull", "Back-foot shots"],
  ["hook", "cutpull", "hook", "Back-foot shots"],
  ["backFootLegGlance", "cutpull", "leg glance", "Back-foot shots"],
  ["loftedStraightDrive", "loft", "lofted straight drive", "Lofted shots"],
  ["loftedOffDrive", "loft", "lofted off drive", "Lofted shots"],
  ["loftedCoverDrive", "loft", "lofted cover drive", "Lofted shots"],
  ["loftedSquareDrive", "loft", "square drive", "Lofted shots"],
  ["loftedOnDrive", "loft", "lofted on drive", "Lofted shots"],
  ["slogMidwicket", "loft", "slog over midwicket", "Lofted shots"],
  ["sweep", "sweep", "sweep", "Sweeps"],
  ["paddleSweep", "sweep", "paddle sweep", "Sweeps"],
  ["reverseSweep", "reverseSweep", "reverse sweep", "Sweeps"],
  ["rampKeeper", "ramp", "ramp over the keeper", "Ramps and scoops"],
  ["rampSlips", "ramp", "ramp over the slips", "Ramps and scoops"],
  ["scoopFineLeg", "ramp", "scoop over fine leg", "Ramps and scoops"],
  ["forwardDefence", "defend", "forward defence", "Defence and leave"],
  ["backFootDefence", "defend", "back-foot defence", "Defence and leave"],
  ["leave", "leave", "", "Defence and leave"],
].map(([id, type, shotName, group]) => ({ id, type, shotName, group }));

export function clipForShot(type, shotName) {
  if (type === "leave") return "leave";
  return SHOT_CATALOG.find((row) => row.type === type && row.shotName === shotName)?.id ?? null;
}
