import { clamp, angleDiff } from "../math.js";

/** Where a shot goes and what it's called: its natural bearing, its name, and finding the gap. */

/**
 * A front-foot drive's direction from the line it's played to: straight,
 * through the covers, square when wide; on leg stump it's worked through
 * midwicket, and off the pads it's glanced fine.
 */
export function driveBearing(line) {
  if (line >= -0.15) return clamp(line * 75, -11, 70);
  return Math.max(-140, -11 + (line + 0.15) * 350);
}

/** Natural direction of a shot (degrees, 0 = straight back past the bowler, + = off side). */
export function shotBearing(type, line, height, back) {
  switch (type) {
    case "drive":
    case "loft":
      return driveBearing(line);
    case "cutpull":
      if (back === "cut") return 92 + line * 15;
      if (back === "punch") return 8 + line * 70;
      if (back === "glance") return -125;
      return -72 - clamp(height - 0.8, 0, 1) * 30;
    case "ramp":
      return line > 0.15 ? 160 : -165;
    case "sweep":
      return -115;
    case "reverseSweep":
      return 110;
    case "defend":
      return clamp(line * 40, -30, 40);
    default:
      return 0;
  }
}

export function shotName(type, bearing, height, footBack, back) {
  if (type === "defend") return footBack ? "back-foot defence" : "forward defence";
  if (type === "cutpull") {
    if (back === "cut") return bearing > 115 ? "late cut" : "cut";
    if (back === "punch") return "back-foot drive";
    if (back === "glance") return "leg glance";
    return height > 1.35 ? "hook" : "pull";
  }
  if (type === "ramp")
    return Math.abs(bearing) > 168 ? "ramp over the keeper" : bearing > 0 ? "ramp over the slips" : "scoop over fine leg";
  if (type === "sweep") return bearing < -125 ? "paddle sweep" : "sweep";
  if (type === "reverseSweep") return "reverse sweep";
  const lofted = type === "loft" ? "lofted " : "";
  if (bearing > 80) return "square drive";
  if (bearing > 45) return lofted + "cover drive";
  if (bearing > 12) return lofted + "off drive";
  if (bearing > -12) return lofted + "straight drive";
  if (bearing > -40) return lofted + "on drive";
  if (bearing > -100) return type === "loft" ? "slog over midwicket" : "clip off the pads";
  return type === "loft" ? "slog over midwicket" : "leg glance";
}

/** The direction within `reach` degrees of `bearing` furthest from any fielder (bearings in `field`). */
export function intoGap(bearing, field, reach) {
  if (!field.length || reach < 1) return bearing;
  let best = bearing;
  let bestGap = -1;
  for (let b = bearing - reach; b <= bearing + reach; b += 2) {
    const gap = Math.min(...field.map((f) => Math.abs(angleDiff(b, f))));
    // Ties go to the smaller change of direction.
    if (gap > bestGap + 0.5 || (Math.abs(gap - bestGap) <= 0.5 && Math.abs(b - bearing) < Math.abs(best - bearing))) {
      bestGap = gap;
      best = b;
    }
  }
  return best;
}
