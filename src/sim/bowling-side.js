/** +1 for a right-arm bowler, -1 for a left-armer (a bowler's skills carry `arm: "left"`). */
export const armOf = (skills) => (skills?.arm === "left" ? -1 : 1);

/**
 * Where everyone is at the bowler's end, in the world (metres across): his release, his run line and mark,
 * the umpire and the non-striker. Right-arm over runs in on the off side of the stumps for a right-hander;
 * a left-armer's (`arm` -1) is the mirror image.
 */
export function bowlingGeometry(spinner, side = "over", arm = 1) {
  const around = side === "around";
  const overHand = spinner ? 0.28 : 0.36;
  const releaseX = around ? -(spinner ? 1.08 : 1.16) : overHand;
  return {
    releaseX: releaseX * arm,
    bodyX: (around ? releaseX + (0.55 - overHand) : 0.55) * arm,
    startX: (around ? -1.5 : 1.5) * arm,
    umpireX: (around ? 0.62 : -0.62) * arm,
    nonStrikerX: (around ? 1.05 : -1.05) * arm,
  };
}

export function bowlerFieldingHome(spinner, side = "over", arm = 1) {
  return { x: (side === "around" ? bowlingGeometry(spinner, side).bodyX + 0.4 : 0.9) * arm, z: 16.8 };
}
