import { angleDiff } from "../math.js";

/**
 * The striker's skeleton for the close view: bones, the human range of
 * motion, and forward kinematics from joint angles to points on screen.
 *
 * Poses are joint angles, not hand positions. Blending two poses blends the
 * joints, so hands travel in arcs round the shoulders and the bat only turns
 * as far as the arms and wrists can turn it; then every frame is built
 * outwards from the body:
 *   body (feet, knees, hips, spine, shoulders) from the stance fields;
 *   front (left) arm by its shoulder and elbow angles, ending at the top hand;
 *   the bat from the top hand, at the front forearm's angle plus the wrist's;
 *   back (right) arm reaching for the bottom of the handle, its elbow on the
 *   same side as the pose's, letting go if the handle is out of reach (the
 *   one-handed finish), never stretching.
 *
 * Angles are degrees on screen: 0 points straight down, 90 to the off side
 * (screen right, seen from behind), 180 up. Units are close-view pixels at
 * scale 1, feet at y = 0, up the screen negative.
 */

export const BONES = { thigh: 22, shin: 23, upperArm: 19, forearm: 18, handle: 4.5 };

/**
 * Range of motion, as it shows in the picture (degrees).
 *   elbow: bend from straight (it never bends backwards);
 *   wrist: the bat off the line of the front forearm, cocked back or rolled through;
 *   knee: bend from straight (deep: down on one knee for a sweep needs it);
 *   twist: the shoulders turned against the hips (the spine's rotation at the waist).
 */
export const LIMITS = { elbow: 145, wrist: 95, knee: 150, twist: 45 };

/**
 * The front arm's shoulder angle is kept in this range, so blending two poses
 * raises the arm forwards past the off side, never back over his head the wrong way.
 */
const FRONT_ARM_FROM = -170;

/** How far (px) a full front-foot stride lowers the hips. */
const LUNGE_DROP = 3;

/** Where a bottom hand that has let go near its shoulder rests: forwards and down (degrees). */
const BACK_HAND_REST = 40;

/** How near the bottom hand must be to the grip to be holding it (px). */
const GRIP_SLACK = 0.6;
/** The closest a hand can come to its shoulder, the elbow bent as far as it goes. */
const FOLDED = Math.sqrt(
  BONES.upperArm ** 2 +
    BONES.forearm ** 2 -
    2 * BONES.upperArm * BONES.forearm * Math.cos(((180 - LIMITS.elbow) * Math.PI) / 180),
);
const smooth = (t) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};

/** A straight bat swings almost entirely along the pitch: lifted back towards the keeper, through towards the bowler. */
export const BAT_PLANE = 0.85;
/** How far up the screen a bat end moves per unit it goes down the pitch (the camera looks slightly down). */
const BAT_DEPTH_RISE = 0.25;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const toward = (deg) => ({ x: Math.sin((deg * Math.PI) / 180), y: Math.cos((deg * Math.PI) / 180) });
const angleOf = (from, to) => (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
const plus = (p, deg, len) => {
  const d = toward(deg);
  return { x: p.x + d.x * len, y: p.y + d.y * len };
};
/** An angle moved into [from, from + 360). */
const into = (deg, from) => ((((deg - from) % 360) + 360) % 360) + from;

/**
 * Two-bone inverse kinematics: where the middle joint (knee or elbow) sits so
 * bones of length l1 and l2 join `from` to `to`. `prefer` picks between the
 * two mirror-image solutions.
 */
export function joint(from, to, l1, l2, prefer) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 0.01;
  const d = Math.min(dist, l1 + l2 - 0.01);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const out = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / dist;
  const uy = dy / dist;
  const mx = from.x + ux * along;
  const my = from.y + uy * along;
  return prefer({ x: mx - uy * out, y: my + ux * out }, { x: mx + uy * out, y: my - ux * out });
}

/** Bend at a middle joint, degrees from straight. */
function bend(a, mid, b) {
  return 180 - Math.abs(angleDiff(angleOf(mid, a), angleOf(mid, b)));
}

/**
 * The body from the pose's stance fields: step (front foot forward), back
 * (weight back, back foot back and across), lean (bending forward at the
 * waist), hips and turn (the hips' and the shoulders' turn, 0 side-on to 1
 * square to the bowler, a quarter turn; below 0 coiled closed), drop
 * (crouch), reach (towards the line). The shoulders can only twist so far
 * against the hips (LIMITS.twist).
 */
function body(p) {
  const step = p.step ?? 0;
  const back = p.back ?? 0;
  const lean = p.lean ?? 0;
  const hipTurn = p.hips ?? p.turn ?? 0;
  const twistLimit = LIMITS.twist / 90;
  const turn = clamp(p.turn ?? 0, hipTurn - twistLimit, hipTurn + twistLimit);
  const drop = p.drop ?? 0;
  const reach = p.reach ?? 0;
  const frontLift = -7 * step + 3 * back;
  // Side-on, as seen from behind: the back (right) foot is nearest the camera,
  // the front (left) foot further down the pitch, so higher up the screen.
  // Going down for a sweep is gradual: 0 standing to 1 down on the back knee.
  const kneel = clamp01((drop - 6) / 6);
  const backFoot = { x: -5 + 5 * back - 5 * kneel, y: -3 + 2 * back };
  const frontFoot = { x: 6 + 2 * step - back, y: -9 + frontLift };
  // A long stride lowers him into it (the front knee bends), as well as carrying the hips forward.
  const lunge = clamp01((step - 0.3) / 1.4);
  const pelvis = { x: 1 + lean * 0.5 + 2 * back + reach * 0.25, y: -44 + drop + frontLift * 0.5 + back + LUNGE_DROP * lunge };
  // The hips turn on their own: opening up spreads them across the screen.
  const backHip = { x: pelvis.x - 2.5 - 1.5 * hipTurn, y: pelvis.y };
  const frontHip = { x: pelvis.x + 3 + 1.5 * hipTurn, y: pelvis.y - 2 * (1 - hipTurn) };
  // Knees bend towards the off side, where he faces; down low for a sweep, the back knee goes to the turf.
  const offSide = (a, b) => (a.x > b.x ? a : b);
  const backKnee = joint(backHip, backFoot, BONES.thigh, BONES.shin, (a, b) =>
    (1 - kneel) * (a.x - b.x) + kneel * (a.y - b.y) > 0 ? a : b,
  );
  // Striding out, the front shin stays upright over the planted foot while the thigh, pointing
  // away down the pitch, foreshortens. (Solved at full length the knee would splay out sideways.)
  const planted = (1 - kneel) * clamp01((step - 0.3) / 0.9);
  const solvedKnee = joint(frontHip, frontFoot, BONES.thigh, BONES.shin, offSide);
  const plantedKnee = { x: frontFoot.x + 3, y: frontFoot.y - BONES.shin * 0.78 };
  // Planted, but never bent past the knee's limit: ease back towards the solved knee until it isn't.
  const kneeAt = (w) => ({
    x: solvedKnee.x + (plantedKnee.x - solvedKnee.x) * w,
    y: solvedKnee.y + (plantedKnee.y - solvedKnee.y) * w,
  });
  let plant = planted;
  for (let i = 0; i < 8 && bend(frontHip, kneeAt(plant), frontFoot) > LIMITS.knee; i++) plant *= 0.75;
  const frontKnee = kneeAt(plant);
  // On a big stride the back heel comes up, the weight going on to the front foot.
  const heel = (1 - kneel) * clamp01((step - 0.9) / 0.8);
  // The spine in two: pelvis to waist, then waist to chest. Leaning bends it forward at the waist,
  // over the ball, bringing the shoulders down as well as across.
  const waist = { x: pelvis.x + lean * 0.35, y: pelvis.y - 9 + Math.abs(lean) * 0.2 };
  const chest = { x: waist.x + lean * 0.55 + reach * 0.5, y: waist.y - 20 + Math.abs(lean) * 0.35 };
  // Shoulders side-on: the right one near us, the left one pointing down the pitch.
  // Leaning into a drive dips the front shoulder; opening up squares them across the screen.
  const span = 7 + 2.5 * turn;
  const backShoulder = { x: chest.x - span, y: chest.y - lean * 0.3 };
  const frontShoulder = { x: chest.x + span, y: chest.y - 2 * (1 - turn) + lean * 0.5 };
  const head = { x: chest.x + lean * 0.4 + 1, y: chest.y - 12 };
  return {
    frontLift,
    backFoot,
    frontFoot,
    pelvis,
    waist,
    backHip,
    frontHip,
    backKnee,
    frontKnee,
    heel,
    chest,
    backShoulder,
    frontShoulder,
    head,
    turn,
    hipTurn,
    lean,
  };
}

/**
 * The bat's direction on screen (per unit length) from its angle and swing
 * plane; `near` is how far it points at the camera. plane 0: the swing is
 * across the screen; towards 1 its sideways part turns into depth back
 * towards the camera (a straight bat lifted towards the keeper); towards -1,
 * into depth away down the pitch (a cross-bat swing carrying on towards the bowler).
 */
export function batDirection(angle, plane, front) {
  const a = (angle * Math.PI) / 180;
  const towardCamera = Math.sin(a) * plane * (front ? -1 : 1);
  return {
    dir: { x: Math.sin(a) * (1 - Math.abs(plane)), y: Math.cos(a) + towardCamera * BAT_DEPTH_RISE },
    near: Math.max(0, towardCamera),
  };
}

/** The front arm ends at the top hand; its elbow comes up and out in front (the high front elbow). */
const leading = (p, q) => (p.x - 0.4 * p.y > q.x - 0.4 * q.y ? p : q);
/** The back elbow tucks in, below its arm. */
const lower = (p, q) => (p.y > q.y ? p : q);

/**
 * Turn an authored key pose into joint angles within the limits. Authored:
 * the body fields, px/py (the top hand, where it should be) and angle (the
 * bat), plane. Solved: sh (front shoulder), el (front elbow, signed bend:
 * which way it bends is kept), wrist (bat off the forearm), bsh (back arm's
 * direction, which side its elbow goes).
 */
export function solvePose(target) {
  const pose = {
    step: target.step ?? 0,
    lean: target.lean ?? 0,
    back: target.back ?? 0,
    drop: target.drop ?? 0,
    turn: target.turn ?? 0,
    hips: target.hips ?? target.turn ?? 0,
    plane: target.plane ?? BAT_PLANE,
    reach: 0,
  };
  const b = body(pose);
  const want = { x: target.px, y: target.py + b.frontLift * 0.5 };
  // Two ways for the arm to reach the hand: the high front elbow, unless the wrist would then have
  // to bend the bat further than a wrist can, in which case the arm turns the other way instead.
  const arm = (elbow) => {
    // `shFrom` lets a key pose that follows on from another keep its arm angle continuous with it.
    const sh = into(angleOf(b.frontShoulder, elbow), target.shFrom ?? FRONT_ARM_FROM);
    const el = clamp(angleDiff(angleOf(elbow, want), sh), -LIMITS.elbow, LIMITS.elbow);
    return { sh, el, wristNeeded: angleDiff(target.angle, sh + el) };
  };
  const high = joint(b.frontShoulder, want, BONES.upperArm, BONES.forearm, leading);
  const other = joint(b.frontShoulder, want, BONES.upperArm, BONES.forearm, (p, q) => (leading(p, q) === p ? q : p));
  const first = arm(high);
  const second = arm(other);
  // A key pose can say which way its elbow bends (`bend`: +1 or -1), so a shot keeps one
  // bend throughout rather than flipping between its poses.
  const { sh, el, wristNeeded } = target.bend
    ? Math.sign(first.el) === target.bend
      ? first
      : second
    : Math.abs(first.wristNeeded) <= LIMITS.wrist || Math.abs(second.wristNeeded) >= Math.abs(first.wristNeeded)
      ? first
      : second;
  const forearm = sh + el;
  const wrist = clamp(wristNeeded, -LIMITS.wrist, LIMITS.wrist);
  // The back arm: which side its elbow sits, from reaching for the handle as solved.
  const hand = plus(plus(b.frontShoulder, sh, BONES.upperArm), forearm, BONES.forearm);
  const { dir } = batDirection(forearm + wrist, pose.plane, false);
  const grip = { x: hand.x + dir.x * BONES.handle, y: hand.y + dir.y * BONES.handle };
  const backElbow = joint(b.backShoulder, grip, BONES.upperArm, BONES.forearm, lower);
  // Which side of the line to the grip the back elbow sits.
  const cross =
    (grip.x - b.backShoulder.x) * (backElbow.y - b.backShoulder.y) -
    (grip.y - b.backShoulder.y) * (backElbow.x - b.backShoulder.x);
  return { ...pose, sh, el, wrist, bside: target.backSide ?? (cross >= 0 ? 1 : -1) };
}

/**
 * Blend two poses joint by joint. `opts.wrist` gives the wrist its own
 * progress (lagging the arms, then whipping through).
 */
export function blendPoses(a, b, t, opts = {}) {
  const k = clamp01(t);
  const kw = opts.wrist === undefined ? k : clamp01(opts.wrist);
  // The hips can lead the shoulders (opts.hips: their own progress), as they do into a shot.
  const kh = opts.hips === undefined ? k : clamp01(opts.hips);
  const mix = (f, d = 0) => (a[f] ?? d) + ((b[f] ?? d) - (a[f] ?? d)) * k;
  return {
    step: mix("step"),
    lean: mix("lean"),
    back: mix("back"),
    drop: mix("drop"),
    turn: mix("turn"),
    hips: (a.hips ?? a.turn ?? 0) + ((b.hips ?? b.turn ?? 0) - (a.hips ?? a.turn ?? 0)) * kh,
    reach: mix("reach"),
    plane: mix("plane", BAT_PLANE),
    // The front arm keeps to its range (see FRONT_ARM_FROM), so this is a plain blend.
    sh: a.sh + (b.sh - a.sh) * k,
    el: a.el + (b.el - a.el) * k,
    wrist: a.wrist + (b.wrist - a.wrist) * kw,
    bside: (a.bside ?? 1) + ((b.bside ?? 1) - (a.bside ?? 1)) * k,
  };
}

/**
 * Every point of the skeleton for a pose, plus the bat and the measured joint
 * bends (for drawing, and for checking the limits hold). `front`: seen from
 * the bowler's end (the bat's depth runs the other way).
 */
export function rigPose(pose, front = false) {
  const b = body(pose);
  const el = clamp(pose.el, -LIMITS.elbow, LIMITS.elbow);
  const wrist = clamp(pose.wrist, -LIMITS.wrist, LIMITS.wrist);
  const frontElbow = plus(b.frontShoulder, pose.sh, BONES.upperArm);
  const forearm = pose.sh + el;
  const topHand = plus(frontElbow, forearm, BONES.forearm);
  const batAngle = forearm + wrist;
  const { dir, near } = batDirection(batAngle, pose.plane ?? BAT_PLANE, front);
  const grip = { x: topHand.x + dir.x * BONES.handle, y: topHand.y + dir.y * BONES.handle };
  // The back arm reaches for the grip, solved exactly each frame. Its two possible elbows are
  // mirror images across the line to the grip; the pose's `bside` (-1 to 1, blended between key
  // poses) picks one, and while it changes over the elbow passes through the straight arm, where
  // the two meet, so it never jumps. Too far, or too close to fold round: the hand lets go there.
  const toGrip = Math.hypot(grip.x - b.backShoulder.x, grip.y - b.backShoulder.y);
  const reachable = clamp(toGrip, FOLDED + 0.01, BONES.upperArm + BONES.forearm - 0.01);
  // Right by the shoulder, which way the grip lies is no guide (it flips as the handle passes),
  // so the hand settles forward and down there instead, taking over smoothly as the grip comes in.
  const settle = Math.max(0, FOLDED - toGrip) / FOLDED;
  const settled = toward(BACK_HAND_REST);
  const aim = {
    x: grip.x - b.backShoulder.x + settled.x * settle * FOLDED * 2,
    y: grip.y - b.backShoulder.y + settled.y * settle * FOLDED * 2,
  };
  const target = plus(b.backShoulder, angleOf({ x: 0, y: 0 }, aim), reachable);
  const sideOf = (p) =>
    Math.sign(
      (target.x - b.backShoulder.x) * (p.y - b.backShoulder.y) - (target.y - b.backShoulder.y) * (p.x - b.backShoulder.x),
    );
  const plusSide = joint(b.backShoulder, target, BONES.upperArm, BONES.forearm, (p, q) => (sideOf(p) > 0 ? p : q));
  const minusSide = joint(b.backShoulder, target, BONES.upperArm, BONES.forearm, (p, q) => (sideOf(p) > 0 ? q : p));
  const w = smooth(((pose.bside ?? 1) + 1) / 2);
  const mid = { x: minusSide.x + (plusSide.x - minusSide.x) * w, y: minusSide.y + (plusSide.y - minusSide.y) * w };
  const backElbow = plus(b.backShoulder, angleOf(b.backShoulder, mid), BONES.upperArm);
  const backHand = plus(backElbow, angleOf(backElbow, target), BONES.forearm);
  const released = Math.hypot(backHand.x - grip.x, backHand.y - grip.y) > GRIP_SLACK;
  return {
    ...b,
    frontElbow,
    topHand,
    backElbow,
    backHand,
    grip,
    released,
    batAngle,
    dir,
    near,
    bends: {
      frontElbow: Math.abs(el),
      backElbow: bend(b.backShoulder, backElbow, backHand),
      wrist: Math.abs(wrist),
      frontKnee: bend(b.frontHip, b.frontKnee, b.frontFoot),
      backKnee: bend(b.backHip, b.backKnee, b.backFoot),
      twist: Math.abs(b.turn - b.hipTurn) * 90,
    },
  };
}
