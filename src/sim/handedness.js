/**
 * Left-handers. The sim works in the striker's own frame: + x is always his off side, so batting, LBW,
 * wides, fields and shot names read the same for either hand. The world stays put: the bowler, his arm and
 * footmarks, the umpire. A delivery is bowled in the world and turned into the striker's frame; the camera
 * turns it back (render/camera.js setFacing).
 */

/** +1 for a right-hander, -1 for a left-hander: world x is striker-frame x times this. */
export const facingOf = (player) => (player?.hand === "left" ? -1 : 1);

/** A world point (x, z) where a right-hander or left-hander sees it. */
export const toStriker = (p, facing) => ({ ...p, x: p.x * facing });

const flip = (p) => (p ? { ...p, x: -p.x, ...(p.vx === undefined ? {} : { vx: -p.vx }) } : p);

/**
 * A delivery bowled in the world as the left-hander at the crease sees it: every position, velocity and
 * sideways movement mirrored (a right-armer's outswinger comes into him, an off-break turns away).
 */
export function mirrorDelivery(d) {
  return {
    ...d,
    release: flip(d.release),
    swingAcc: -d.swingAcc,
    expectedSwingAcc: -d.expectedSwingAcc,
    seamKick: -d.seamKick,
    spinKick: -d.spinKick,
    expectedSpinKick: -d.expectedSpinKick,
    decoySpinKick: -d.decoySpinKick,
    samples: d.samples.map(flip),
    pitchedAt: flip(d.pitchedAt),
    atCrease: flip(d.atCrease),
  };
}
