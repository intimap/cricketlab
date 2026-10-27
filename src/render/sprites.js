import { COLORS, ctx, fillRect, plot, drawLine, fillCircle, fillEllipse, fillPolygon } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

const BAT_FACE = "#e6cc92";
const BAT_EDGE = "#b8955a";
const GRIP = "#2b2b33";
const PAD = "#fbfbf6";
const PAD_SHADE = "#c9c9c0";
const BOOT = "#3a3a3a";
const HAIR = "#3b2a1e";

/** Draw something mirrored left-to-right about screen column x (front view <-> back view). */
function mirrored(x, draw) {
  const cx = Math.round(x);
  ctx.save();
  ctx.translate(cx * 2, 0);
  ctx.scale(-1, 1);
  draw();
  ctx.restore();
}

/** Test whites with team-coloured cap and accents. */
export function makeKit(cap, cap2, skin = "#d8a27a") {
  return { cap, cap2, shirt: "#f7f2e2", shade: "#cdc4a5", pants: "#eee6cf", skin };
}

/**
 * Key poses for the close-up striker. px/py: hands, angle: bat angle in
 * degrees (0 = straight down), step: front foot forward, lean: body lean,
 * back: weight on the back foot.
 */
export const BATTER_POSES = {
  stance: { px: 11, py: -44, angle: 14, step: 0, lean: 0, back: 0 },
  lift0: { px: 12, py: -52, angle: 60, step: 0, lean: 0, back: 0 },
  lift1: { px: 13, py: -62, angle: 140, step: 0, lean: -1, back: 0 },
  /** Small back-and-across movement as the bowler delivers. */
  trigger: { px: 12, py: -46, angle: 22, step: 0, lean: 1, back: 0.6 },
  contactFront: { px: 12, py: -40, angle: 0, step: 1.4, lean: 5, back: 0 },
  contactBack: { px: 12, py: -46, angle: 10, step: 0, lean: 1, back: 1 },
  // Follow-throughs, by where the shot went.
  coverDriveEnd: { px: 6, py: -76, angle: -158, step: 1.4, lean: 6, back: 0 },
  straightDriveEnd: { px: -1, py: -84, angle: -176, step: 1.4, lean: 3, back: 0 },
  onDriveEnd: { px: -8, py: -72, angle: -128, step: 1.3, lean: 0, back: 0 },
  clipEnd: { px: 2, py: -50, angle: -55, step: 1, lean: -1, back: 0 },
  loftEnd: { px: -4, py: -86, angle: -178, step: 1.5, lean: 2, back: 0 },
  slogEnd: { px: -12, py: -80, angle: -112, step: 1.2, lean: -3, back: 0 },
  cutEnd: { px: 18, py: -56, angle: 95, step: 0, lean: 3, back: 1 },
  lateCutEnd: { px: 18, py: -44, angle: 78, step: 0, lean: 4, back: 1 },
  pullEnd: { px: -6, py: -62, angle: -105, step: 0, lean: -3, back: 1 },
  hookEnd: { px: -10, py: -82, angle: -82, step: 0, lean: -5, back: 1 },
  defendFront: { px: 13, py: -42, angle: -4, step: 1.3, lean: 6, back: 0 },
  defendBack: { px: 12, py: -48, angle: 2, step: 0, lean: 2, back: 1 },
  leave: { px: 3, py: -88, angle: 172, step: 0.3, lean: -2, back: 0 },
  // Ramp: bat face up over the shoulder. Sweeps: down on one knee.
  rampContact: { px: 10, py: -64, angle: 165, step: 0.6, lean: 2, back: 0.3, drop: 6 },
  rampEnd: { px: 6, py: -84, angle: 178, step: 0.6, lean: 0, back: 0.3, drop: 6 },
  sweepContact: { px: 2, py: -24, angle: -75, step: 1.6, lean: 7, back: 0, drop: 14 },
  sweepEnd: { px: -12, py: -48, angle: -140, step: 1.6, lean: 4, back: 0, drop: 14 },
  reverseSweepContact: { px: 20, py: -26, angle: 75, step: 1.6, lean: 6, back: 0, drop: 14 },
  reverseSweepEnd: { px: 30, py: -48, angle: 140, step: 1.6, lean: 5, back: 0, drop: 14 },
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
  };
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 50);
  const g = Math.min(255, ((n >> 8) & 255) + 50);
  const b = Math.min(255, (n & 255) + 50);
  return `rgb(${r},${g},${b})`;
}

// Bone lengths for the striker's skeleton, in close-view pixels at scale 1.
const THIGH = 22;
const SHIN = 23;
const UPPER_ARM = 19;
const FOREARM = 18;

function darken(hex, amount = 40) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - amount);
  const g = Math.max(0, ((n >> 8) & 255) - amount);
  const b = Math.max(0, (n & 255) - amount);
  return `rgb(${r},${g},${b})`;
}

/**
 * Two-bone inverse kinematics: where the middle joint (knee or elbow) sits so
 * bones of length l1 and l2 join `from` to `to`. `prefer` picks between the
 * two mirror-image solutions.
 */
function joint(from, to, l1, l2, prefer) {
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

/** The back of the striker's helmet, its peak turned towards the bowler. */
function drawBatterHelmetBack(head, h, scale, kit, poly, line) {
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

  // --- Skeleton ---
  const frontLift = -7 * pose.step + 3 * pose.back;
  // Crouch: lowers the hips and everything above (down on one knee for a sweep).
  const drop = pose.drop ?? 0;
  const lean = pose.lean;
  const backFoot = { x: -7 - 2 * pose.back - (drop > 8 ? 6 : 0), y: -3 };
  const frontFoot = { x: 8 + 2 * pose.step, y: -3 + frontLift };
  // Striding forward carries the hips with it (up the screen, in this view).
  const pelvis = { x: 1 + lean * 0.5, y: -47 + drop + frontLift * 0.5 + pose.back };
  const backHip = { x: pelvis.x - 5.5, y: pelvis.y };
  const frontHip = { x: pelvis.x + 5.5, y: pelvis.y };
  // Knees flex outwards, like an athlete's ready position.
  // Down low for a sweep, the back knee goes to the turf.
  const backKnee = joint(backHip, backFoot, THIGH, SHIN, (a, b) => (drop > 8 ? (a.y > b.y ? a : b) : a.x < b.x ? a : b));
  const frontKnee = joint(frontHip, frontFoot, THIGH, SHIN, (a, b) => (a.x > b.x ? a : b));
  const chest = { x: pelvis.x + lean * 0.9, y: pelvis.y - 29 + Math.abs(lean) * 0.25 };
  // Leaning into a drive dips the front shoulder.
  const backShoulder = { x: chest.x - 13, y: chest.y - lean * 0.5 };
  const frontShoulder = { x: chest.x + 13, y: chest.y + lean * 0.5 };
  const head = { x: chest.x + lean * 0.4 + 1, y: chest.y - 12 };

  // Hands on the handle: top hand (left) above the bottom hand (right).
  const a = (pose.angle * Math.PI) / 180;
  const dir = { x: Math.sin(a), y: Math.cos(a) };
  const topHand = { x: pose.px, y: pose.py + frontLift * 0.5 };
  const bottomHand = { x: topHand.x + dir.x * 4.5, y: topHand.y + dir.y * 4.5 };
  // Elbows hang below the line from shoulder to hand.
  const lower = (p, q) => (p.y > q.y ? p : q);
  const backElbow = joint(backShoulder, topHand, UPPER_ARM, FOREARM, lower);
  const frontElbow = joint(frontShoulder, bottomHand, UPPER_ARM, FOREARM, lower);

  // --- Flesh and kit ---
  fillEllipse(x + 2 * scale, y + scale, 22 * scale, 4 * scale, "rgba(0,0,0,0.28)");
  const leg = (hip, knee, foot, toe) => {
    limb(hip, knee, 6, 5, kit.pants, kit.shade);
    // Pad from just above the knee to the boot, with a knee roll and straps.
    const top = { x: knee.x + (hip.x - knee.x) * 0.22, y: knee.y + (hip.y - knee.y) * 0.22 };
    limb(top, foot, 5, 4.5, PAD, PAD_SHADE);
    const len = Math.hypot(foot.x - top.x, foot.y - top.y) || 1;
    const nx = -(foot.y - top.y) / len;
    const ny = (foot.x - top.x) / len;
    for (const t of [0.12, 0.45, 0.75]) {
      const c = { x: top.x + (foot.x - top.x) * t, y: top.y + (foot.y - top.y) * t };
      line({ x: c.x - nx * 4, y: c.y - ny * 4 }, { x: c.x + nx * 4, y: c.y + ny * 4 }, 1, PAD_SHADE);
    }
    poly(
      [
        { x: foot.x - 5, y: foot.y - 2 },
        { x: foot.x + 4 + toe, y: foot.y - 2 },
        { x: foot.x + 5 + toe, y: foot.y + 2.5 },
        { x: foot.x - 5, y: foot.y + 2.5 },
      ],
      BOOT,
    );
  };
  leg(backHip, backKnee, backFoot, 0);
  leg(frontHip, frontKnee, frontFoot, 2);

  // Hips and backside.
  poly(
    [
      { x: pelvis.x - 10, y: pelvis.y - 7 },
      { x: pelvis.x + 10, y: pelvis.y - 7 },
      { x: frontHip.x + 5, y: frontHip.y + 4 },
      { x: backHip.x - 5, y: backHip.y + 4 },
    ],
    kit.pants,
  );

  // Torso: broad shoulders tapering to a narrow waist.
  const waistL = { x: pelvis.x - 8.5, y: pelvis.y - 6 };
  const waistR = { x: pelvis.x + 8.5, y: pelvis.y - 6 };
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
  line({ x: chest.x, y: chest.y + 2 }, { x: pelvis.x + lean * 0.2, y: pelvis.y - 8 }, 1, kit.shade);
  if (number) {
    drawText(String(number), at(chest).x, at({ x: 0, y: chest.y + 5 }).y, {
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
    for (const dy of [1.5, 4, 6.5]) line({ x: head.x - 5, y: head.y + dy }, { x: head.x + 5, y: head.y + dy }, 1, "#9aa0a6");
  } else {
    drawBatterHelmetBack(head, h, scale, kit, poly, line);
  }

  // Arms: sleeves to mid upper arm, bare forearms.
  const arm = (shoulder, elbow, hand) => {
    const sleeve = { x: shoulder.x + (elbow.x - shoulder.x) * 0.65, y: shoulder.y + (elbow.y - shoulder.y) * 0.65 };
    limb(shoulder, elbow, 4.5, 3.6, kit.skin, darken(kit.skin, 35));
    limb(shoulder, sleeve, 5, 4.4, kit.shirt, kit.shade);
    limb(elbow, hand, 3.4, 2.6, kit.skin, darken(kit.skin, 35));
  };
  arm(backShoulder, backElbow, topHand);
  arm(frontShoulder, frontElbow, bottomHand);

  // Bat: handle then blade.
  const shoulder = { x: topHand.x + dir.x * 9, y: topHand.y + dir.y * 9 };
  const toe = { x: topHand.x + dir.x * 36, y: topHand.y + dir.y * 36 };
  line({ x: topHand.x - dir.x * 2, y: topHand.y - dir.y * 2 }, shoulder, 2, GRIP);
  line(shoulder, toe, 6, BAT_EDGE);
  line({ x: shoulder.x + 0.6, y: shoulder.y }, { x: toe.x + 0.6, y: toe.y }, 4, BAT_FACE);
  // Gloves.
  for (const g of [topHand, bottomHand]) {
    const p = at(g);
    fillCircle(p.x, p.y, 3 * scale, "#f1f1f1");
    fillCircle(p.x + scale, p.y + scale, 1.3 * scale, kit.cap2);
  }
}

/**
 * Where a close-view figure's feet and hands go for each pose, in figure
 * units (48 = standing height, feet at 0, y up the screen is negative).
 * `top` is the top of the shoulders; bob lifts or sinks the whole body.
 */
function figurePose(pose, phase) {
  let lean = 0;
  let bob = 0;
  let feet = [
    { x: -4, y: -1 },
    { x: 4, y: -1 },
  ];
  if (pose === "run" || pose === "walk" || pose === "backup") {
    const swing = Math.sin(phase * Math.PI * 2) * (pose === "run" ? 1 : 0.5);
    feet = [
      { x: -3 - swing * 2, y: -1 - Math.max(0, swing) * 6 },
      { x: 3 + swing * 2, y: -1 - Math.max(0, -swing) * 6 },
    ];
    bob = Math.abs(swing);
    if (pose === "run") lean = 1;
  } else if (pose === "bound") {
    feet = [
      { x: -4, y: -9 },
      { x: 5, y: -12 },
    ];
    bob = -4;
  } else if (pose === "follow") {
    feet = [
      { x: -6, y: -1 },
      { x: 5, y: -1 },
    ];
    lean = 3;
    bob = 3;
  } else if (pose === "celebrate") {
    bob = -1;
  }
  const top = -42 + bob;
  let hands;
  switch (pose) {
    case "run": {
      const swing = Math.sin(phase * Math.PI * 2);
      hands = [
        { x: -8, y: top + 15 - swing * 6 },
        { x: 8, y: top + 15 + swing * 6 },
      ];
      break;
    }
    case "bound":
      hands = [
        { x: -10, y: top - 10 },
        { x: 9, y: top - 12 },
      ];
      break;
    case "release":
      hands = [
        { x: -4, y: top - 21 },
        { x: 13, y: top + 10 },
      ];
      break;
    case "follow":
      hands = [
        { x: 9 + lean, y: top + 19 },
        { x: 14, y: top + 11 },
      ];
      break;
    case "celebrate":
      hands = [
        { x: -12, y: top - 14 },
        { x: 12, y: top - 14 },
      ];
      break;
    case "appeal":
      hands = [
        { x: -9, y: top - 16 },
        { x: 12, y: top + 12 },
      ];
      break;
    case "outFinger":
      hands = [
        { x: -9, y: top + 16 },
        { x: 6, y: top - 16 },
      ];
      break;
    case "backup":
    case "walk": {
      const swing = Math.sin(phase * Math.PI * 2);
      hands = [
        { x: -9, y: top + 19 - swing * 3 },
        { x: 9, y: top + 19 + swing * 3 },
      ];
      break;
    }
    default:
      hands = [
        { x: -9, y: top + 19.5 },
        { x: 9, y: top + 19.5 },
      ];
  }
  return { lean, top, feet, hands };
}

/**
 * A full-size figure for the close view (bowler, umpire, non-striker), feet
 * at (x, y), `height` pixels tall, facing the camera. Built on the same kind
 * of jointed skeleton as the striker.
 * opts: { kit, pose, phase (animation cycle), umpire?, bat?, back? (seen from behind: mirrored, no face) }
 */
export function drawFigure(x, y, height, opts) {
  if (opts.back) mirrored(x, () => drawFigureBody(x, y, height, opts));
  else drawFigureBody(x, y, height, opts);
}

function drawFigureBody(x, y, height, opts) {
  const k = height / 48;
  const at = (p) => ({ x: x + p.x * k, y: y + p.y * k });
  const limb = (a, b, r0, r1, color, shade) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * k) + 1;
    for (const [c, off, trim] of shade
      ? [
          [shade, 0, 0],
          [color, -0.4, 0.45],
        ]
      : [[color, 0, 0]]) {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = at({ x: a.x + (b.x - a.x) * t + off, y: a.y + (b.y - a.y) * t });
        fillCircle(p.x, p.y, Math.max(0.5, (r0 + (r1 - r0) * t - trim) * k), c);
      }
    }
  };
  const poly = (points, color) => fillPolygon(points.map(at), color);
  const kit = opts.kit;
  const umpire = !!opts.umpire;
  const shirt = umpire ? "#f4f4f0" : kit.shirt;
  const shirtShade = umpire ? "#d8d8d0" : kit.shade;
  const pants = umpire ? "#2a2d36" : kit.pants;
  const pantsShade = umpire ? "#1c1e25" : kit.shade;
  const skinShade = darken(kit.skin, 35);

  const { lean, top, feet, hands } = figurePose(opts.pose, opts.phase);
  const pelvis = { x: lean * 0.4, y: top + 19 };
  const hips = [
    { x: pelvis.x - 3, y: pelvis.y },
    { x: pelvis.x + 3, y: pelvis.y },
  ];
  const shoulders = [
    { x: lean - 7.5, y: top + 2 },
    { x: lean + 7.5, y: top + 2 },
  ];
  const head = { x: lean, y: top - 6 };
  const outward = (side) => (a, b) => ((a.x - b.x) * side > 0 ? a : b);
  // Facing the camera a bent knee points at us, so it sits between hip and
  // foot, nudged outwards a little more the more the leg is folded.
  const knees = [0, 1].map((i) => {
    const fold = Math.max(0, 22.4 - Math.hypot(feet[i].x - hips[i].x, feet[i].y - hips[i].y));
    const side = i ? 1 : -1;
    return { x: (hips[i].x + feet[i].x) / 2 + side * fold * 0.15, y: (hips[i].y + feet[i].y) / 2 - fold * 0.1 };
  });
  const elbows = [0, 1].map((i) => joint(shoulders[i], hands[i], 9.5, 9, outward(i ? 1 : -1)));

  fillEllipse(x, y, 9 * k, 2 * k, "rgba(0,0,0,0.3)");

  // Legs, with pads for a batter, then boots.
  for (const i of [0, 1]) {
    limb(hips[i], knees[i], 3, 2.5, pants, pantsShade);
    if (opts.bat) {
      const padTop = { x: knees[i].x + (hips[i].x - knees[i].x) * 0.2, y: knees[i].y + (hips[i].y - knees[i].y) * 0.2 };
      limb(padTop, feet[i], 2.8, 2.5, PAD, PAD_SHADE);
    } else {
      limb(knees[i], feet[i], 2.5, 2, pants, pantsShade);
    }
    const f = feet[i];
    poly(
      [
        { x: f.x - 3, y: f.y - 1 },
        { x: f.x + 3, y: f.y - 1 },
        { x: f.x + 3.2, y: f.y + 1.5 },
        { x: f.x - 3.2, y: f.y + 1.5 },
      ],
      BOOT,
    );
  }
  poly(
    [
      { x: pelvis.x - 5.5, y: pelvis.y - 4 },
      { x: pelvis.x + 5.5, y: pelvis.y - 4 },
      { x: hips[1].x + 3, y: pelvis.y + 2 },
      { x: hips[0].x - 3, y: pelvis.y + 2 },
    ],
    pants,
  );

  // Torso: broad shoulders, narrow waist; the umpire's coat hangs straighter.
  const waist = umpire ? 6.5 : 5;
  const torso = [
    { x: shoulders[0].x - 1, y: shoulders[0].y - 1 },
    { x: lean - 2.5, y: top - 1.5 },
    { x: lean + 2.5, y: top - 1.5 },
    { x: shoulders[1].x + 1, y: shoulders[1].y - 1 },
    { x: shoulders[1].x, y: shoulders[1].y + 5 },
    { x: pelvis.x + waist, y: pelvis.y - (umpire ? 1 : 3) },
    { x: pelvis.x - waist, y: pelvis.y - (umpire ? 1 : 3) },
    { x: shoulders[0].x, y: shoulders[0].y + 5 },
  ];
  poly(torso, shirt);
  poly(
    [
      { x: shoulders[1].x - 2, y: shoulders[1].y },
      { x: shoulders[1].x + 1, y: shoulders[1].y - 1 },
      { x: shoulders[1].x, y: shoulders[1].y + 5 },
      { x: pelvis.x + waist, y: pelvis.y - (umpire ? 1 : 3) },
      { x: pelvis.x + waist - 2, y: pelvis.y - (umpire ? 1 : 3) },
    ],
    shirtShade,
  );
  // Open collar (or the umpire's tie).
  if (!opts.back)
    poly(
      [
        { x: lean - 2, y: top - 1.5 },
        { x: lean + 2, y: top - 1.5 },
        { x: lean, y: top + 2.5 },
      ],
      umpire ? "#2a2d36" : kit.skin,
    );
  if (umpire && !opts.back)
    poly(
      [
        { x: lean - 0.6, y: top + 2 },
        { x: lean + 0.6, y: top + 2 },
        { x: lean, y: top + 9 },
      ],
      "#2a2d36",
    );

  // Neck, head and headwear.
  limb({ x: head.x, y: head.y + 3 }, { x: lean, y: top }, 1.8, 2, kit.skin);
  const h = at(head);
  if (opts.back) {
    // The back of the head: hair, and ears either side.
    fillCircle(h.x - 4.4 * k, h.y + 0.5 * k, 1.2 * k, kit.skin);
    fillCircle(h.x + 4.4 * k, h.y + 0.5 * k, 1.2 * k, kit.skin);
    fillCircle(h.x, h.y, 4.6 * k, HAIR);
  } else {
    fillCircle(h.x, h.y, 4.6 * k, kit.skin);
    fillCircle(h.x + 1.5 * k, h.y + 0.5 * k, 3 * k, kit.skin);
  }
  if (umpire) {
    // Wide-brimmed white hat.
    poly(
      [
        { x: head.x - 8, y: head.y - 3 },
        { x: head.x + 8, y: head.y - 3 },
        { x: head.x + 7, y: head.y - 1.5 },
        { x: head.x - 7, y: head.y - 1.5 },
      ],
      "#f4f4f0",
    );
    poly(
      [
        { x: head.x - 4.5, y: head.y - 8 },
        { x: head.x + 4.5, y: head.y - 8 },
        { x: head.x + 5, y: head.y - 3 },
        { x: head.x - 5, y: head.y - 3 },
      ],
      "#f4f4f0",
    );
    poly(
      [
        { x: head.x - 5, y: head.y - 4.5 },
        { x: head.x + 5, y: head.y - 4.5 },
        { x: head.x + 5, y: head.y - 3 },
        { x: head.x - 5, y: head.y - 3 },
      ],
      "#2a2d36",
    );
  } else if (opts.bat) {
    // Helmet with a grille over the face.
    fillCircle(h.x, h.y - 0.8 * k, 5.4 * k, kit.cap);
    fillCircle(h.x - 1.6 * k, h.y - 2.8 * k, 1.8 * k, lighten(kit.cap));
    for (const dy of opts.back ? [] : [0.8, 2.4]) {
      const a = at({ x: head.x - 4, y: head.y + dy });
      const b = at({ x: head.x + 4, y: head.y + dy });
      drawLine(a.x, a.y, b.x, b.y, Math.max(1, Math.round(0.8 * k)), "#9aa0a6");
    }
  } else {
    // Cap with a peak towards the camera.
    poly(
      [
        { x: head.x - 4.8, y: head.y - 6 },
        { x: head.x + 4.8, y: head.y - 6 },
        { x: head.x + 5, y: head.y - 2 },
        { x: head.x - 5, y: head.y - 2 },
      ],
      kit.cap,
    );
    poly(
      [
        { x: head.x - 5.5, y: head.y - 2.5 },
        { x: head.x + 5.5, y: head.y - 2.5 },
        { x: head.x + 4.5, y: head.y - 0.8 },
        { x: head.x - 4.5, y: head.y - 0.8 },
      ],
      darken(kit.cap),
    );
  }

  // Arms: players in short sleeves, the umpire in his coat.
  for (const i of [0, 1]) {
    const s = shoulders[i];
    const e = elbows[i];
    const sleeve = umpire ? e : { x: s.x + (e.x - s.x) * 0.6, y: s.y + (e.y - s.y) * 0.6 };
    limb(s, e, 2.4, 2, kit.skin, skinShade);
    limb(s, sleeve, 2.7, 2.3, shirt, shirtShade);
    limb(e, hands[i], umpire ? 2 : 1.8, 1.5, umpire ? shirt : kit.skin, umpire ? shirtShade : skinShade);
    const hand = at(hands[i]);
    fillCircle(hand.x, hand.y, (opts.bat ? 2.2 : 1.8) * k, opts.bat ? "#f1f1f1" : kit.skin);
  }
  if (opts.pose === "outFinger")
    poly(
      [
        { x: hands[1].x - 0.6, y: hands[1].y - 5 },
        { x: hands[1].x + 0.6, y: hands[1].y - 5 },
        { x: hands[1].x + 0.6, y: hands[1].y },
        { x: hands[1].x - 0.6, y: hands[1].y },
      ],
      kit.skin,
    );
  if (opts.bat) {
    // Bat carried in the left hand, toe down.
    const a = at(hands[0]);
    const b = at({ x: hands[0].x - 3, y: hands[0].y + 17 });
    drawLine(a.x, a.y, b.x, b.y, Math.max(2, Math.round(3 * k)), BAT_EDGE);
    drawLine(a.x + 0.5, a.y, b.x + 0.5, b.y, Math.max(1, Math.round(2 * k)), BAT_FACE);
  }
}

/**
 * A tiny figure for the wide view, feet at (x, y).
 * pose: idle | run | dive | down | celebrate | throw | keeper | batter
 */
export function drawTinyFigure(x, y, scale, pose, cap, phase = 0, opts = {}) {
  const k = Math.max(1, scale * 1.45);
  const rect = (rx, ry, w, h, color) =>
    fillRect(x + rx * k, y + ry * k, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), color);
  fillEllipse(x, y, 3 * k, 1, "rgba(0,0,0,0.35)");
  if (pose === "dive" || pose === "down") {
    rect(-4, -3, 8, 2, COLORS.cream);
    rect(-5, -4, 2, 2, cap);
    rect(3, -3, 2, 1, "#e8e2cc");
    return;
  }
  const stride = pose === "run" ? (Math.sin(phase * Math.PI * 2) > 0 ? 1 : -1) : 0;
  rect(-1 - (stride > 0 ? 1 : 0), -3, 1, 3, "#e8e2cc");
  rect(1 + (stride < 0 ? 1 : 0), -3, 1, 3, "#e8e2cc");
  if (opts.bat) {
    rect(-1, -3, 1, 2, PAD);
    rect(1, -3, 1, 2, PAD);
  }
  rect(-1, -6, 3, 3, COLORS.cream);
  rect(-1, -8, 3, 2, cap);
  if (pose === "celebrate") {
    rect(-2, -9, 1, 2, COLORS.cream);
    rect(2, -9, 1, 2, COLORS.cream);
  } else if (pose === "throw") {
    rect(2, -9, 1, 3, COLORS.cream);
  } else if (pose === "keeper") {
    rect(-2, -5, 1, 1, "#f0b030");
    rect(2, -5, 1, 1, "#f0b030");
  }
  if (opts.bat) {
    plot(x + 2 * k, y - 4 * k, BAT_FACE);
    plot(x + 2 * k, y - 3 * k, BAT_FACE);
    plot(x + 3 * k, y - 2 * k, BAT_FACE);
  }
}

/** The ball; redder (shinier) when `shine` is high. */
export function drawBall(x, y, radius, shine) {
  const color = shine > 0.5 ? "#c4161c" : shine > 0.2 ? "#a3201e" : "#7e2a22";
  fillCircle(x, y, radius, "#3b0a0a");
  fillCircle(x, y, Math.max(0.5, radius - 0.6), color);
  if (radius >= 2) plot(x - radius * 0.35, y - radius * 0.35, "#ffb3a8");
}

export function drawShadow(x, y, radius) {
  fillEllipse(x, y, Math.max(1, radius * 1.1), Math.max(0.5, radius * 0.45), "rgba(0,0,0,0.38)");
}
