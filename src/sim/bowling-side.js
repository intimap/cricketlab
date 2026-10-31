/** The existing action is right-arm: over stays on its original side of the stumps. */
export function bowlingGeometry(spinner, side = "over") {
  const around = side === "around";
  const overHand = spinner ? 0.28 : 0.36;
  const releaseX = around ? -(spinner ? 1.08 : 1.16) : overHand;
  return {
    releaseX,
    bodyX: around ? releaseX + (0.55 - overHand) : 0.55,
    startX: around ? -1.5 : 1.5,
    umpireX: around ? 0.62 : -0.62,
    nonStrikerX: around ? 1.05 : -1.05,
  };
}

export function bowlerFieldingHome(spinner, side = "over") {
  return { x: side === "around" ? bowlingGeometry(spinner, side).bodyX + 0.4 : 0.9, z: 16.8 };
}
