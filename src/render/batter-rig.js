import { drawLine, fillCircle, fillEllipse, fillPolygon } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { BAT_FACE, BAT_EDGE, PAD, PAD_SHADE, BOOT, HAIR, mirrored, groundShadow, lighten, darken } from "./sprites.js";

/**
 * The striker in the close view: his key poses, the skeleton solved from a pose (two-bone IK for knees
 * and elbows, on the old poses or the newer rig in batter-motion.js) and the drawing of him in kit.
 */

const GRIP = "#2b2b33";

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

/** A straight bat swings almost entirely along the pitch: lifted back towards the keeper, through towards the bowler. */
const BAT_PLANE = 0.85;
/** How far up the screen a bat end moves per unit it goes down the pitch (the camera looks slightly down). */
const BAT_DEPTH_RISE = 0.25;

// Bone lengths for the striker's skeleton, in close-view pixels at scale 1.
const THIGH = 22;
const SHIN = 23;
const UPPER_ARM = 19;
const FOREARM = 18;

/**
 * Two-bone inverse kinematics: where the middle joint (knee or elbow) sits so
 * bones of length l1 and l2 join `from` to `to`. `prefer` picks between the
 * two mirror-image solutions.
 */
export function joint(from, to, l1, l2, prefer) {
  const { mx, my, nx, ny, out } = bendOf(from, to, l1, l2);
  return prefer({ x: mx + nx * out, y: my + ny * out }, { x: mx - nx * out, y: my - ny * out });
}

/**
 * The pieces of a two-bone solve: the point on the line from `from` to `to` level with the middle
 * joint, the unit normal to that line, and how far off it the joint sits. The limb never quite
 * locks straight (96% of its length), so a joint at full stretch doesn't snap from side to side.
 */
function bendOf(from, to, l1, l2) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 0.01;
  // Nor fully folds: a hand passing right by its shoulder would fling the elbow about.
  const d = Math.max(Math.abs(l1 - l2) + 4, Math.min(dist, (l1 + l2) * 0.96));
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const out = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / dist;
  const uy = dy / dist;
  return { mx: from.x + ux * along, my: from.y + uy * along, nx: -uy, ny: ux, out };
}

/**
 * An elbow that points towards `pole` (a direction). Rather than jumping to the mirror-image
 * solution when the arm swings past the pole, it slides through the straight arm, as a hinge
 * turning towards or away from the camera would look: no popping across the body.
 */
function elbow(shoulder, hand, pole) {
  const { mx, my, nx, ny, out } = bendOf(shoulder, hand, UPPER_ARM, FOREARM);
  const side = Math.max(-1, Math.min(1, (nx * pole.x + ny * pole.y) * 2.5));
  // With the hand tucked in by the shoulder the arm folds flat, the elbow out along the pole.
  const k = Math.max(0, Math.min(1, (Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y) - 6) / 10));
  const fx = shoulder.x + pole.x * UPPER_ARM * 0.95;
  const fy = shoulder.y + pole.y * UPPER_ARM * 0.95;
  return { x: fx + (mx + nx * out * side - fx) * k, y: fy + (my + ny * out * side - fy) * k };
}

/** The lead elbow rides high and out towards the off side. */
const LEAD_ELBOW = { x: 0.8, y: -0.6 };
/** The back elbow tucks in towards the hips. */
const tuckedElbow = (shoulder, pelvis) => {
  const dx = pelvis.x - shoulder.x;
  const dy = pelvis.y - shoulder.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
};

/** The back of the striker's helmet, its peak turned towards the bowler. */
function drawBatterHelmetBack(head, h, scale, kit, poly, line) {
  // Hair showing at the nape, below the helmet.
  const style = kit.hairStyle ?? "short";
  if (style === "long" || style === "curly") {
    fillEllipse(h.x, h.y + 9 * scale, (style === "long" ? 6 : 5) * scale, (style === "long" ? 4 : 2.5) * scale, kit.hair ?? HAIR);
  }
  fillEllipse(h.x, h.y, 8 * scale, 8.5 * scale, kit.cap);
  fillEllipse(h.x - 2 * scale, h.y - 3 * scale, 3.5 * scale, 2.5 * scale, lighten(kit.cap));
  poly(
    [
      { x: head.x - 8, y: head.y + 4 },
      { x: head.x + 8, y: head.y + 4 },
      { x: head.x + 7, y: head.y + 8 },
      { x: head.x - 7, y: head.y + 8 },
    ],
    darken(kit.cap),
  );
  poly(
    [
      { x: head.x + 5, y: head.y - 2 },
      { x: head.x + 13, y: head.y - 1 },
      { x: head.x + 12, y: head.y + 1 },
      { x: head.x + 5, y: head.y + 1 },
    ],
    kit.cap,
  );
  line({ x: head.x + 9, y: head.y + 2 }, { x: head.x + 9, y: head.y + 8 }, 2, "#9aa0a6");
}

/**
 * The striker in the close view, feet at (x, y), with a shirt number. A
 * jointed skeleton (hips, knees, shoulders, elbows) is solved from the pose's
 * feet, hips and hands, then fleshed out with kit, pads, gloves and helmet.
 * Seen from behind, unless `front` (from the bowler's end): then mirrored, face on.
 */
export function drawBatter(x, y, scale, pose, kit, number = 0, front = false) {
  if (front) mirrored(x, () => drawBatterBody(x, y, scale, pose, kit, 0, true));
  else drawBatterBody(x, y, scale, pose, kit, number, false);
}

// Optional rig extension. Legacy poses keep the original drawing path.
function articulatedPose(pose, front) {
  const depth = front ? -1 : 1;
  const hipAngle = (pose.hipTurn * Math.PI) / 180;
  const shoulderAngle = (pose.shoulderTurn * Math.PI) / 180;
  const backFoot = { x: pose.backFootX, y: pose.backFootY - pose.backLift };
  const frontFoot = { x: pose.frontFootX, y: pose.frontFootY - pose.frontLift };
  const pelvis = { x: pose.pelvisX, y: pose.pelvisY };
  const backHip = { x: pelvis.x - Math.cos(hipAngle) * 5.5, y: pelvis.y + Math.sin(hipAngle) * 2.4 * depth };
  const frontHip = { x: pelvis.x + Math.cos(hipAngle) * 5.5, y: pelvis.y - Math.sin(hipAngle) * 2.4 * depth };
  const kneeSide = (a, b) => (a.x > b.x ? a : b);
  const backKnee = joint(backHip, backFoot, THIGH, SHIN, kneeSide);
  const frontKnee = joint(frontHip, frontFoot, THIGH, SHIN, kneeSide);
  const chest = { x: pose.chestX, y: pose.chestY };
  const backShoulder = { x: chest.x - Math.cos(shoulderAngle) * 10, y: chest.y + Math.sin(shoulderAngle) * 4.5 * depth };
  const frontShoulder = { x: chest.x + Math.cos(shoulderAngle) * 10, y: chest.y - Math.sin(shoulderAngle) * 4.5 * depth };
  const head = { x: pose.headX, y: pose.headY };
  const a = (pose.angle * Math.PI) / 180;
  const towardCamera = Math.sin(a) * pose.plane * depth;
  const dir = { x: Math.sin(a) * (1 - pose.plane), y: Math.cos(a) + towardCamera * BAT_DEPTH_RISE };
  const topHand = { x: pose.px, y: pose.py };
  const bottomHand = { x: topHand.x + dir.x * 4.5, y: topHand.y + dir.y * 4.5 };
  // A right-handed batter's left/top hand belongs to the front shoulder.
  const backWrist = bottomHand;
  const frontWrist = topHand;
  const backElbow = elbow(backShoulder, backWrist, tuckedElbow(backShoulder, pelvis));
  const frontElbow = elbow(frontShoulder, frontWrist, LEAD_ELBOW);
  return {
    frontLift: 0,
    drop: 0,
    lean: 0,
    backFoot,
    frontFoot,
    pelvis,
    backHip,
    frontHip,
    backKnee,
    frontKnee,
    chest,
    backShoulder,
    frontShoulder,
    head,
    topHand,
    bottomHand,
    backElbow,
    frontElbow,
    backWrist,
    frontWrist,
    dir,
    near: Math.max(0, towardCamera),
  };
}

/** Each solved point (and number) of rig `b`, moved `k` of the way back towards rig `a`. */
function blendRigs(a, b, k) {
  const out = {};
  for (const [key, v] of Object.entries(b)) {
    const u = a[key];
    if (typeof v === "number" && typeof u === "number") out[key] = v + (u - v) * k;
    else if (v && typeof v === "object" && u && typeof u === "object")
      out[key] = { x: v.x + (u.x - v.x) * k, y: v.y + (u.y - v.y) * k };
    else out[key] = v;
  }
  return out;
}

/**
 * The skeleton for a pose. A pose with `from` (and `fromK`, 0..1) is drawn that far back towards the
 * `from` pose, joint by joint, so a stroke on the new rig can ease in from an old pose (or back out
 * to one) without a jump: lerpPose() only knows the old fields.
 */
export function solveBatterRig(pose, front = false) {
  if (pose.from) return blendRigs(solveBatterRig(pose.from, front), solveBatterRig({ ...pose, from: null }, front), pose.fromK);
  if (pose.rig === 1) return articulatedPose(pose, front);
  // --- Skeleton ---
  const frontLift = -7 * pose.step + 3 * pose.back;
  // Crouch: lowers the hips and everything above (down on one knee for a sweep).
  const drop = pose.drop ?? 0;
  const lean = pose.lean;
  // Side-on, as seen from behind: the back (right) foot is nearest the camera,
  // the front (left) foot further down the pitch, so higher up the screen.
  const backFoot = { x: -3 - 2 * pose.back - (drop > 8 ? 5 : 0), y: -3 };
  const frontFoot = { x: 4 + 2 * pose.step, y: -9 + frontLift };
  // Striding forward carries the hips with it (up the screen, in this view).
  // Reaching for a wide one carries the hips, chest and head across too (see reachPose).
  const reach = pose.reach ?? 0;
  const pelvis = { x: 1 + lean * 0.5 + reach * 0.22, y: -47 + drop + frontLift * 0.5 + pose.back };
  const backHip = { x: pelvis.x - 2.5, y: pelvis.y };
  const frontHip = { x: pelvis.x + 3, y: pelvis.y - 2 };
  // Knees bend towards the off side, where he faces; down low for a sweep, the back knee goes to the turf.
  const offSide = (a, b) => (a.x > b.x ? a : b);
  const backKnee = joint(backHip, backFoot, THIGH, SHIN, (a, b) => (drop > 8 ? (a.y > b.y ? a : b) : offSide(a, b)));
  const frontKnee = joint(frontHip, frontFoot, THIGH, SHIN, offSide);
  const chest = { x: pelvis.x + lean * 0.9 + reach * 0.18, y: pelvis.y - 29 + Math.abs(lean) * 0.25 };
  // Shoulders side-on: the right one near us, the left one pointing down the pitch.
  // Leaning into a drive dips the front shoulder.
  const backShoulder = { x: chest.x - 7, y: chest.y - lean * 0.3 };
  const frontShoulder = { x: chest.x + 7, y: chest.y - 2 + lean * 0.5 };
  const head = { x: chest.x + lean * 0.4 + 1 + reach * 0.15, y: chest.y - 12 };

  // Hands on the handle: top hand (left) above the bottom hand (right).
  // The bat in 3D: `near` is how far it points back towards the camera (0-1), which on screen
  // shortens it and draws its toe a little lower and bigger. From the bowler's end, back is away from us.
  const a = (pose.angle * Math.PI) / 180;
  const plane = pose.plane ?? BAT_PLANE;
  const towardCamera = Math.sin(a) * plane * (front ? -1 : 1);
  const dir = { x: Math.sin(a) * (1 - plane), y: Math.cos(a) + towardCamera * BAT_DEPTH_RISE };
  const near = Math.max(0, towardCamera);
  const topHand = { x: pose.px, y: pose.py + frontLift * 0.5 };
  const bottomHand = { x: topHand.x + dir.x * 4.5, y: topHand.y + dir.y * 4.5 };
  const backElbow = elbow(backShoulder, topHand, tuckedElbow(backShoulder, pelvis));
  const frontElbow = elbow(frontShoulder, bottomHand, LEAD_ELBOW);

  return {
    frontLift,
    drop,
    lean,
    backFoot,
    frontFoot,
    pelvis,
    backHip,
    frontHip,
    backKnee,
    frontKnee,
    chest,
    backShoulder,
    frontShoulder,
    head,
    topHand,
    bottomHand,
    backElbow,
    frontElbow,
    dir,
    near,
    backWrist: topHand,
    frontWrist: bottomHand,
  };
}

function drawBatterBody(x, y, scale, pose, kit, number, front) {
  const at = (p) => ({ x: x + p.x * scale, y: y + p.y * scale });
  // A limb segment tapering from radius r0 to r1, lit from the left: a shade rim on the right.
  const limb = (a, b, r0, r1, color, shade) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * scale) + 1;
    for (const [c, off, trim] of shade
      ? [
          [shade, 0, 0],
          [color, -0.8, 0.9],
        ]
      : [[color, 0, 0]]) {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = at({ x: a.x + (b.x - a.x) * t + off, y: a.y + (b.y - a.y) * t });
        fillCircle(p.x, p.y, Math.max(0.5, (r0 + (r1 - r0) * t - trim) * scale), c);
      }
    }
  };
  const poly = (points, color) => fillPolygon(points.map(at), color);
  const line = (a, b, w, color) => {
    const p = at(a);
    const q = at(b);
    drawLine(p.x, p.y, q.x, q.y, Math.max(1, Math.round(w * scale)), color);
  };

  const {
    frontLift,
    drop,
    lean,
    backFoot,
    frontFoot,
    pelvis,
    backHip,
    frontHip,
    backKnee,
    frontKnee,
    chest,
    backShoulder,
    frontShoulder,
    head,
    topHand,
    bottomHand,
    backElbow,
    frontElbow,
    backWrist,
    frontWrist,
    dir,
    near,
  } = solveBatterRig(pose, front);

  // --- Flesh and kit ---
  // Arms: sleeves to mid upper arm, bare forearms.
  const arm = (shoulder, elbow, hand) => {
    const sleeve = { x: shoulder.x + (elbow.x - shoulder.x) * 0.65, y: shoulder.y + (elbow.y - shoulder.y) * 0.65 };
    limb(shoulder, elbow, 4.5, 3.6, kit.skin, darken(kit.skin, 35));
    limb(shoulder, sleeve, 5, 4.4, kit.shirt, kit.shade);
    limb(elbow, hand, 3.4, 2.6, kit.skin, darken(kit.skin, 35));
    if ((kit.extras ?? []).includes("sweatbands")) {
      const w = at({ x: elbow.x + (hand.x - elbow.x) * 0.72, y: elbow.y + (hand.y - elbow.y) * 0.72 });
      fillCircle(w.x, w.y, 3.2 * scale, kit.cap2);
    }
  };

  groundShadow(x + 1 * scale, y - 2 * scale, 15 * scale, 5 * scale, 0.28);
  if (pose.rig === 1) {
    for (const [fx, fy] of [
      [pose.frontFootX, pose.frontFootY],
      [pose.backFootX, pose.backFootY],
    ]) {
      const foot = at({ x: fx + 1, y: fy + 3 });
      fillEllipse(foot.x, foot.y, 6 * scale, 1.6 * scale, "rgba(0,0,0,0.24)");
    }
  }
  const leg = (hip, knee, foot, toe, heel = 0) => {
    limb(hip, knee, 6, 5, kit.pants, kit.shade);
    // Pad from just above the knee to the boot, with a knee roll and straps.
    const top = { x: knee.x + (hip.x - knee.x) * 0.22, y: knee.y + (hip.y - knee.y) * 0.22 };
    // Seen edge-on: the pad's face (and its straps) turned to the off side.
    limb(top, foot, 4.4, 4, PAD, PAD_SHADE);
    const len = Math.hypot(foot.x - top.x, foot.y - top.y) || 1;
    const nx = Math.abs((foot.y - top.y) / len);
    const ny = -(foot.x - top.x) / len;
    for (const t of [0.12, 0.45, 0.75]) {
      const c = { x: top.x + (foot.x - top.x) * t, y: top.y + (foot.y - top.y) * t };
      line({ x: c.x + nx * 0.5, y: c.y + ny * 0.5 }, { x: c.x + nx * 4, y: c.y + ny * 4 }, 1, PAD_SHADE);
    }
    poly(
      [
        { x: foot.x - 5, y: foot.y - 2 - heel },
        { x: foot.x + 4 + toe, y: foot.y - 2 },
        { x: foot.x + 5 + toe, y: foot.y + 2.5 },
        { x: foot.x - 5, y: foot.y + 2.5 - heel },
      ],
      BOOT,
    );
  };
  // The far (front) leg first, so the near one overlaps it; toes point to the off side.
  if (pose.rig === 1 && front) {
    leg(backHip, backKnee, backFoot, 2, pose.backHeel);
    leg(frontHip, frontKnee, frontFoot, 2, pose.frontHeel);
  } else {
    leg(frontHip, frontKnee, frontFoot, 2, pose.frontHeel ?? 0);
    leg(backHip, backKnee, backFoot, 2, pose.backHeel ?? 0);
  }
  if (pose.rig === 1) {
    if (front) arm(backShoulder, backElbow, backWrist);
    else arm(frontShoulder, frontElbow, frontWrist);
  }

  // Hips, side-on.
  poly(
    [
      { x: pelvis.x - 7, y: pelvis.y - 7 },
      { x: pelvis.x + 7, y: pelvis.y - 8 },
      { x: frontHip.x + 4, y: frontHip.y + 3 },
      { x: backHip.x - 4, y: backHip.y + 4 },
    ],
    kit.pants,
  );

  // Torso side-on: chest to the off side, tapering to the waist.
  const waistL = { x: pelvis.x - 6, y: pelvis.y - 6 };
  const waistR = { x: pelvis.x + 6.5, y: pelvis.y - 6 };
  const torso = [
    { x: backShoulder.x - 1, y: backShoulder.y - 1 },
    { x: chest.x - 4, y: chest.y - 4 },
    { x: chest.x + 4, y: chest.y - 4 },
    { x: frontShoulder.x + 1, y: frontShoulder.y - 1 },
    { x: frontShoulder.x - 1, y: frontShoulder.y + 9 },
    waistR,
    waistL,
    { x: backShoulder.x + 1, y: backShoulder.y + 9 },
  ];
  poly(torso, kit.shirt);
  // Shadow down the right flank and under the shoulder blades.
  poly(
    [
      { x: frontShoulder.x - 3, y: frontShoulder.y + 1 },
      { x: frontShoulder.x + 1, y: frontShoulder.y - 1 },
      { x: frontShoulder.x - 1, y: frontShoulder.y + 9 },
      waistR,
      { x: waistR.x - 3, y: waistR.y },
    ],
    kit.shade,
  );
  line({ x: chest.x - 2, y: chest.y + 2 }, { x: pelvis.x - 2 + lean * 0.2, y: pelvis.y - 8 }, 1, kit.shade);
  if (number) {
    // The number is on his back, which is half turned away from us.
    drawText(String(number), at({ x: chest.x - 2.5, y: 0 }).x, at({ x: 0, y: chest.y + 5 }).y, {
      align: "center",
      color: kit.cap,
      shadow: null,
      scale: scale >= 1.5 ? 2 : 1,
    });
  }

  // Neck and helmet, the peak turned towards the bowler.
  limb({ x: head.x - 0.5, y: head.y + 5 }, { x: chest.x, y: chest.y - 3 }, 3, 3.5, kit.skin);
  const h = at(head);
  if (front) {
    // Face behind the grille, the helmet's peak towards us.
    fillEllipse(h.x, h.y, 8 * scale, 8.5 * scale, kit.cap);
    fillEllipse(h.x, h.y + 2.5 * scale, 5.5 * scale, 5.5 * scale, kit.skin);
    poly(
      [
        { x: head.x - 9, y: head.y - 3 },
        { x: head.x + 9, y: head.y - 3 },
        { x: head.x + 8, y: head.y - 1 },
        { x: head.x - 8, y: head.y - 1 },
      ],
      darken(kit.cap),
    );
    if (kit.beard === "full") fillEllipse(h.x, h.y + 6.5 * scale, 5 * scale, 2.2 * scale, kit.hair ?? HAIR);
    else if (kit.beard === "stubble") fillEllipse(h.x, h.y + 6.5 * scale, 4.5 * scale, 1.8 * scale, "rgba(40,28,20,0.35)");
    for (const dy of [1.5, 4, 6.5]) line({ x: head.x - 5, y: head.y + dy }, { x: head.x + 5, y: head.y + dy }, 1, "#9aa0a6");
  } else {
    drawBatterHelmetBack(head, h, scale, kit, poly, line);
  }

  if (pose.rig === 1) {
    if (front) arm(frontShoulder, frontElbow, frontWrist);
    else arm(backShoulder, backElbow, backWrist);
  } else {
    arm(backShoulder, backElbow, backWrist);
    arm(frontShoulder, frontElbow, frontWrist);
  }

  // Bat: handle then blade, the blade widening towards the toe as it comes nearer the camera.
  const shoulder = { x: topHand.x + dir.x * 9, y: topHand.y + dir.y * 9 };
  const toe = { x: topHand.x + dir.x * 36, y: topHand.y + dir.y * 36 };
  line({ x: topHand.x - dir.x * 2, y: topHand.y - dir.y * 2 }, shoulder, 2, GRIP);
  const len = Math.hypot(toe.x - shoulder.x, toe.y - shoulder.y) || 1;
  const side = { x: -(toe.y - shoulder.y) / len, y: (toe.x - shoulder.x) / len };
  const blade = (w0, w1, dx, color) =>
    poly(
      [
        { x: shoulder.x + dx + side.x * w0, y: shoulder.y + side.y * w0 },
        { x: toe.x + dx + side.x * w1, y: toe.y + side.y * w1 },
        { x: toe.x + dx - side.x * w1, y: toe.y - side.y * w1 },
        { x: shoulder.x + dx - side.x * w0, y: shoulder.y - side.y * w0 },
      ],
      color,
    );
  const face = pose.rig === 1 ? Math.max(0.22, Math.abs(pose.batFace)) : 1;
  const toeWidth = 3 * (1 + 0.45 * near) * face;
  blade(3 * face, toeWidth, 0, BAT_EDGE);
  blade(2 * face, Math.max(0.35, toeWidth - 1), 0.6, BAT_FACE);
  // Pointing back at us, the toe's end shows as a block of bare willow.
  if (near > 0.4) fillCircle(at(toe).x, at(toe).y, toeWidth * 0.8 * scale, BAT_EDGE);
  // Gloves.
  for (const g of [topHand, bottomHand]) {
    const p = at(g);
    fillCircle(p.x, p.y, 3 * scale, "#f1f1f1");
    fillCircle(p.x + scale, p.y + scale, 1.3 * scale, kit.cap2);
  }
}
