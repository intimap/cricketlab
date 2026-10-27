import { COLORS, fillRect, plot, drawLine, fillCircle, fillEllipse } from "../engine/screen.js";
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

/** The striker in the close view, feet at (x, y), with a shirt number. */
export function drawBatter(x, y, scale, pose, kit, number = 0) {
  const sx = (v) => x + v * scale;
  const sy = (v) => y + v * scale;
  const rect = (rx, ry, w, h, color) => fillRect(sx(rx), sy(ry), Math.max(1, w * scale), Math.max(1, h * scale), color);
  const frontLift = -7 * pose.step + 3 * pose.back;
  const stride = 2 * pose.step;
  // Crouch: lowers the hips and everything above (down on one knee for a sweep).
  const drop = pose.drop ?? 0;

  fillEllipse(sx(2), sy(1), 20 * scale, 4 * scale, "rgba(0,0,0,0.28)");
  // Back leg.
  rect(-10, -30, 8, 26, PAD);
  rect(-10, -30, 2, 26, PAD_SHADE);
  rect(-10, -22, 8, 1, PAD_SHADE);
  rect(-10, -13, 8, 1, PAD_SHADE);
  rect(-11, -5, 10, 4, BOOT);
  rect(-10, -48 + drop, 9, 19, kit.pants);
  rect(-10, -48 + drop, 2, 19, kit.shade);
  // Front leg.
  const fx = 5 + stride;
  const fy = frontLift;
  rect(fx, -32 + fy, 8, 26, PAD);
  rect(fx + 6, -32 + fy, 2, 26, PAD_SHADE);
  rect(fx, -24 + fy, 8, 1, PAD_SHADE);
  rect(fx, -15 + fy, 8, 1, PAD_SHADE);
  rect(fx - 1, -7 + fy, 10, 4, BOOT);
  rect(fx, -48 + fy * 0.5 + drop, 9, 18, kit.pants);
  rect(fx + 7, -48 + fy * 0.5 + drop, 2, 18, kit.shade);
  rect(-10, -52 + frontLift * 0.4 + drop, 24 + stride, 8, kit.pants);

  // Torso.
  const tx = -11 + pose.lean * 0.6;
  const ty = -78 + frontLift * 0.5 + drop;
  rect(tx, ty, 26, 28, kit.shirt);
  rect(tx, ty, 4, 28, kit.shade);
  rect(tx + 22, ty + 2, 4, 24, kit.shade);
  if (number) {
    drawText(String(number), sx(tx + 13), sy(ty + 9), {
      align: "center",
      color: kit.cap,
      shadow: null,
      scale: scale >= 1.5 ? 2 : 1,
    });
  }

  // Helmet.
  const hx = tx + 13 + pose.lean * 0.4;
  const hy = ty - 9;
  fillEllipse(sx(hx), sy(hy), 9 * scale, 9 * scale, kit.cap);
  fillEllipse(sx(hx - 2), sy(hy - 3), 4 * scale, 3 * scale, lighten(kit.cap));
  rect(hx - 6, hy + 6, 12, 4, kit.skin);
  rect(hx - 7, hy + 7, 14, 2, kit.cap);
  rect(hx + 6, hy - 1, 6, 3, kit.cap);
  rect(hx + 8, hy + 2, 3, 6, "#9aa0a6");

  // Arms to the hands.
  const handX = pose.px;
  const handY = pose.py + frontLift * 0.5;
  const armW = Math.max(2, Math.round(5 * scale));
  drawLine(sx(tx + 22), sy(ty + 4), sx(handX), sy(handY), armW, kit.shirt);
  drawLine(sx(tx + 6), sy(ty + 4), sx(handX - 2), sy(handY + 1), armW, kit.shade);

  // Bat: handle then blade.
  const a = (pose.angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = Math.cos(a);
  const shoulder = { x: handX + dx * 9, y: handY + dy * 9 };
  const toe = { x: handX + dx * 36, y: handY + dy * 36 };
  drawLine(sx(handX), sy(handY), sx(shoulder.x), sy(shoulder.y), Math.max(2, Math.round(2 * scale)), GRIP);
  drawLine(sx(shoulder.x), sy(shoulder.y), sx(toe.x), sy(toe.y), Math.max(3, Math.round(6 * scale)), BAT_EDGE);
  drawLine(sx(shoulder.x + 0.6), sy(shoulder.y), sx(toe.x + 0.6), sy(toe.y), Math.max(2, Math.round(4 * scale)), BAT_FACE);
  // Gloves.
  fillCircle(sx(handX), sy(handY), 3.2 * scale, "#f1f1f1");
  fillCircle(sx(handX + 1), sy(handY + 1), 1.4 * scale, kit.cap2);
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
