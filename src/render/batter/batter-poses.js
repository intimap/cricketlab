const BAT_PLANE = 0.85;

/**
 * Key poses for the close-up striker. px/py: hands, angle: bat angle in
 * degrees (0 = straight down; positive lifts it back, negative carries it through),
 * plane: how much of that swing runs along the pitch - towards or away from the
 * camera behind him - rather than across the screen (BAT_PLANE unless given:
 * a straight bat; cross-bat shots swing nearer the screen's plane),
 * step: front foot forward, lean: body lean, back: weight on the back foot.
 */
export const BATTER_POSES = {
  stance: { px: 11, py: -44, angle: 14, step: 0, lean: 0, back: 0 },
  lift0: { px: 12, py: -54, angle: 100, step: 0, lean: 0, back: 0 },
  lift1: { px: 11, py: -64, angle: 150, step: 0, lean: -1, back: 0 },
  /** Small back-and-across movement as the bowler delivers. */
  trigger: { px: 12, py: -46, angle: 22, step: 0, lean: 1, back: 0.6 },
  contactFront: { px: 12, py: -40, angle: 0, step: 1.4, lean: 5, back: 0 },
  contactBack: { px: 12, py: -46, angle: 10, step: 0, lean: 1, back: 1 },
  // Follow-throughs, by where the shot went.
  coverDriveEnd: { px: 6, py: -76, angle: -158, step: 1.4, lean: 6, back: 0 },
  straightDriveEnd: { px: -1, py: -84, angle: -176, step: 1.4, lean: 3, back: 0 },
  onDriveEnd: { px: -8, py: -72, angle: -128, step: 1.3, lean: 0, back: 0 },
  clipEnd: { px: 2, py: -50, angle: -55, step: 1, lean: -1, back: 0, plane: 0.4 },
  loftEnd: { px: -4, py: -86, angle: -178, step: 1.5, lean: 2, back: 0 },
  slogEnd: { px: -12, py: -80, angle: -112, step: 1.2, lean: -3, back: 0, plane: 0.3 },
  cutEnd: { px: 18, py: -56, angle: 95, step: 0, lean: 3, back: 1, plane: 0 },
  lateCutEnd: { px: 18, py: -44, angle: 78, step: 0, lean: 4, back: 1, plane: 0.2 },
  pullEnd: { px: -6, py: -62, angle: -105, step: 0, lean: -3, back: 1, plane: 0 },
  hookEnd: { px: -10, py: -82, angle: -82, step: 0, lean: -5, back: 1, plane: 0.1 },
  defendFront: { px: 13, py: -42, angle: -4, step: 1.3, lean: 6, back: 0 },
  defendBack: { px: 12, py: -48, angle: 2, step: 0, lean: 2, back: 1 },
  leave: { px: 3, py: -88, angle: 172, step: 0.3, lean: -2, back: 0 },
  // Ramp: bat face up over the shoulder. Sweeps: down on one knee.
  rampContact: { px: 10, py: -64, angle: 165, step: 0.6, lean: 2, back: 0.3, drop: 6, plane: 0.5 },
  rampEnd: { px: 6, py: -84, angle: 178, step: 0.6, lean: 0, back: 0.3, drop: 6, plane: 0.5 },
  sweepContact: { px: 2, py: -24, angle: -75, step: 1.6, lean: 7, back: 0, drop: 14, plane: 0 },
  sweepEnd: { px: -12, py: -48, angle: -140, step: 1.6, lean: 4, back: 0, drop: 14, plane: 0 },
  reverseSweepContact: { px: 20, py: -26, angle: 75, step: 1.6, lean: 6, back: 0, drop: 14, plane: 0 },
  reverseSweepEnd: { px: 30, py: -48, angle: 140, step: 1.6, lean: 5, back: 0, drop: 14, plane: 0 },
  // Reactions.
  beaten: { px: 9, py: -54, angle: 40, step: 0.6, lean: -3, back: 0.3 },
  padFlinch: { px: 6, py: -60, angle: 60, step: 0.4, lean: -4, back: 0.6 },
};

export function lerpPose(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  const turn = b.angle - a.angle;
  return {
    px: a.px + (b.px - a.px) * k,
    py: a.py + (b.py - a.py) * k,
    angle: a.angle + turn * k,
    step: a.step + (b.step - a.step) * k,
    lean: a.lean + (b.lean - a.lean) * k,
    back: a.back + (b.back - a.back) * k,
    drop: (a.drop ?? 0) + ((b.drop ?? 0) - (a.drop ?? 0)) * k,
    plane: (a.plane ?? BAT_PLANE) + ((b.plane ?? BAT_PLANE) - (a.plane ?? BAT_PLANE)) * k,
    reach: (a.reach ?? 0) + ((b.reach ?? 0) - (a.reach ?? 0)) * k,
    backHeel: (a.backHeel ?? 0) + ((b.backHeel ?? 0) - (a.backHeel ?? 0)) * k,
  };
}

/**
 * Pose `pose` with the hands carried `reach` pixels across towards the ball's line, the whole body
 * going with them: hips a little, chest more, head most, so the hands only make up the rest. On a
 * big front-foot reach the back heel comes up.
 */
export function reachPose(pose, reach, frontFoot) {
  const heel = frontFoot ? 3 * Math.max(0, Math.min(1, (reach - 10) / 14)) : 0;
  const backHeel = (pose.backHeel ?? 0) + heel;
  if (pose.rig !== 1) return { ...pose, px: pose.px + reach, reach: (pose.reach ?? 0) + reach, backHeel };
  return {
    ...pose,
    px: pose.px + reach,
    pelvisX: pose.pelvisX + reach * 0.22,
    chestX: pose.chestX + reach * 0.4,
    headX: pose.headX + reach * 0.55,
    backHeel,
  };
}

