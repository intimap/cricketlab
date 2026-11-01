import { bearingOf } from "./geometry.js";

/**
 * The area of the ground a shot went to, as commentators say it, and the
 * zone it counts towards in a batter's scoring areas. bearing: degrees from
 * straight down the ground, positive on the off side.
 */
export function shotArea(exit, deep) {
  const bearing = bearingOf(exit.x, exit.z);
  const angle = Math.abs(bearing);
  const off = bearing >= 0;
  const area = (zone, near, far) => ({ zone, words: deep ? far : near });
  if (angle < 12) return area("straight", ["back past the bowler", "straight"], ["straight down the ground", "past the bowler"]);
  if (angle < 30)
    return off
      ? area("straight", ["past mid-off", "wide of mid-off"], ["down to long-off", "past mid-off"])
      : area("straight", ["past mid-on", "wide of mid-on"], ["down to long-on", "past mid-on"]);
  if (angle < 72)
    return off
      ? area(
          "the covers",
          ["into the covers", "to cover", "through extra cover"],
          ["through the covers", "to deep cover", "through extra cover"],
        )
      : area(
          "midwicket",
          ["to midwicket", "into the leg side"],
          ["through midwicket", "to deep midwicket", "through mid-on and midwicket"],
        );
  if (angle < 112)
    return off
      ? area("point", ["to point", "square on the off side"], ["behind point", "square through point", "to deep point"])
      : area("square leg", ["to square leg", "square on the leg side"], ["to deep square leg", "square on the leg side"]);
  if (angle < 150)
    return off
      ? area("third man", ["past gully", "behind square on the off side"], ["down to third man", "past gully"])
      : area("fine leg", ["behind square", "fine on the leg side"], ["down to fine leg", "behind square on the leg side"]);
  return off
    ? area("third man", ["fine past the slips"], ["down to third man", "fine past the slips"])
    : area("fine leg", ["fine down the leg side"], ["down to fine leg", "very fine on the leg side"]);
}
