import { COLORS, fillRect, plot, drawLine, fillCircle, fillEllipse, fillPolygon } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

const BAT_FACE = "#e6cc92";
const BAT_EDGE = "#b8955a";
const GRIP = "#2b2b33";
const PAD = "#fbfbf6";
const PAD_SHADE = "#c9c9c0";
const BOOT = "#3a3a3a";

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

/**
 * The striker in the close view, feet at (x, y), with a shirt number. A
 * jointed skeleton (hips, knees, shoulders, elbows) is solved from the pose's
 * feet, hips and hands, then fleshed out with kit, pads, gloves and helmet.
 */
export function drawBatter(x, y, scale, pose, kit, number = 0) {
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
 * A full-size figure for the close view (bowler, umpire, non-striker), feet
 * at (x, y), `height` pixels tall.
 * opts: { kit, pose, phase (animation cycle), umpire?, bat? }
 */
export function drawFigure(x, y, height, opts) {
  const k = height / 48;
  const rect = (rx, ry, w, h, color) =>
    fillRect(x + rx * k, y + ry * k, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), color);
  const limb = (x0, y0, x1, y1, w, color) =>
    drawLine(x + x0 * k, y + y0 * k, x + x1 * k, y + y1 * k, Math.max(1, Math.round(w * k)), color);
  const kit = opts.kit;
  const shirt = opts.umpire ? "#f4f4f0" : kit.shirt;
  const pants = opts.umpire ? "#2a2d36" : kit.pants;
  const phase = opts.phase;
  const pose = opts.pose;

  fillEllipse(x, y, 9 * k, 2 * k, "rgba(0,0,0,0.3)");

  // Legs.
  let lean = 0;
  let bob = 0;
  if (pose === "run" || pose === "walk" || pose === "backup") {
    const swing = Math.sin(phase * Math.PI * 2) * (pose === "run" ? 1 : 0.5);
    limb(-3, -22, -3 - swing * 3, -2 + Math.max(0, swing) * -5, 5, pants);
    limb(3, -22, 3 + swing * 3, -2 + Math.max(0, -swing) * -5, 5, pants);
    rect(-6 - swing * 3, -3 + Math.max(0, swing) * -5, 6, 3, BOOT);
    rect(1 + swing * 3, -3 + Math.max(0, -swing) * -5, 6, 3, BOOT);
    bob = Math.abs(swing) * 1;
  } else if (pose === "bound") {
    limb(-3, -24, -4, -10, 5, pants);
    limb(3, -24, 5, -12, 5, pants);
    rect(-7, -11, 6, 3, BOOT);
    rect(3, -13, 6, 3, BOOT);
    bob = -4;
  } else if (pose === "follow") {
    limb(-3, -20, -6, -1, 5, pants);
    limb(3, -20, 5, -1, 5, pants);
    rect(-9, -3, 6, 3, BOOT);
    rect(3, -3, 6, 3, BOOT);
    lean = 3;
    bob = 3;
  } else {
    limb(-3, -22, -4, -1, 5, pants);
    limb(3, -22, 4, -1, 5, pants);
    rect(-7, -3, 6, 3, BOOT);
    rect(2, -3, 6, 3, BOOT);
  }
  if (opts.bat) {
    rect(-6, -18, 5, 16, PAD);
    rect(2, -18, 5, 16, PAD);
  }

  // Body.
  const top = -42 + bob;
  rect(-8 + lean, top, 16, 20, shirt);
  rect(4 + lean, top, 4, 20, opts.umpire ? "#d8d8d0" : kit.shade);
  if (opts.umpire) rect(-2 + lean, top, 4, 12, "#c8c8c0");

  // Head and headwear.
  const headX = lean;
  const headY = top - 6;
  fillCircle(x + headX * k, y + headY * k, 5 * k, kit.skin);
  if (opts.umpire) {
    rect(headX - 9, headY - 5, 18, 2, "#f4f4f0");
    rect(headX - 5, headY - 9, 10, 5, "#f4f4f0");
  } else if (opts.bat) {
    fillCircle(x + headX * k, y + (headY - 1) * k, 5.4 * k, kit.cap);
    rect(headX - 4, headY + 1, 8, 3, "#9aa0a6");
  } else {
    rect(headX - 5, headY - 6, 10, 4, kit.cap);
    rect(headX - 6, headY - 3, 12, 2, kit.cap);
  }

  // Arms.
  const left = { x: -8 + lean, y: top + 2 };
  const right = { x: 8 + lean, y: top + 2 };
  const arm = (from, hx, hy) => {
    limb(from.x, from.y, hx, hy, 4, shirt);
    fillCircle(x + hx * k, y + hy * k, 2 * k, kit.skin);
  };
  switch (pose) {
    case "run": {
      const swing = Math.sin(phase * Math.PI * 2);
      arm(left, -11, top + 14 - swing * 6);
      arm(right, 11, top + 14 + swing * 6);
      break;
    }
    case "bound":
      arm(left, -10, top - 10);
      arm(right, 9, top - 12);
      break;
    case "release":
      arm(left, -4, top - 22);
      arm(right, 13, top + 10);
      break;
    case "follow":
      arm(left, 9 + lean, top + 20);
      arm(right, 14, top + 12);
      break;
    case "celebrate":
      arm(left, -12, top - 14);
      arm(right, 12, top - 14);
      break;
    case "appeal":
      arm(left, -9, top - 16);
      arm(right, 12, top + 12);
      break;
    case "outFinger":
      arm(left, -9, top + 16);
      arm(right, 6, top - 16);
      rect(5, top - 21, 2, 5, kit.skin);
      break;
    case "backup":
    case "walk": {
      const swing = Math.sin(phase * Math.PI * 2);
      arm(left, -10, top + 15 - swing * 3);
      arm(right, 10, top + 15 + swing * 3);
      break;
    }
    default:
      arm(left, -10, top + 17);
      arm(right, 10, top + 17);
  }
  if (opts.bat) limb(-10, top + 17, -14, top + 34, 3, BAT_FACE);
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
