import { ctx } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

/**
 * The striker as a modular pixel-art sprite: small hand-pixelled pieces (helmet, shirt, sleeves,
 * forearms, gloves, flannels, pads, boots, bat), baked once per kit with the kit's own colours, then
 * drawn between the joints that solveBatterRig() works out, turned with the canvas (no smoothing).
 * Units are pose units: a piece's pixels are one pose unit each, scaled with the batter.
 */

const PAD = "#fbfbf6";
const PAD_RIB = "#e2e2d8";
const PAD_SHADE = "#c9c9c0";
const BOOT = "#3a3a3a";
const SOLE = "#6b6b66";
const SPIKE = "#b9bcbf";
const HAIR = "#3b2a1e";
const GRILLE = "#9aa0a6";
const GLOVE = "#f1f1f1";
const GLOVE_SHADE = "#c8c8c2";
const BLADE = "#e6cc92";
const BLADE_GRAIN = "#d6b878";
const BLADE_EDGE = "#b8955a";
const GRIP = "#2b2b33";
const GRIP_WRAP = "#4a4a58";
const BADGE = "#c8302e";

const hex = (c) => parseInt(c.slice(1), 16);
const shift = (c, amount) => {
  const n = hex(c);
  const ch = (s) => Math.max(0, Math.min(255, ((n >> s) & 255) + amount));
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
};

/** A w x h piece, painted pixel by pixel. */
function bake(w, h, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  const px = (x, y, color, pw = 1, ph = 1) => {
    c.fillStyle = color;
    c.fillRect(x, y, pw, ph);
  };
  paint(px, w, h);
  return canvas;
}

/**
 * A limb piece lying along +x from its first joint (x = 0) to the second (x = len), `w0` thick at the
 * start tapering to `w1`, lit from above (a highlight row) with a shade rim underneath.
 */
function limbPiece(len, w0, w1, color, shade, extra) {
  const h = Math.ceil(Math.max(w0, w1)) + 2;
  return bake(len, h, (px) => {
    for (let x = 0; x < len; x++) {
      const w = Math.round(w0 + ((w1 - w0) * x) / (len - 1 || 1));
      const top = Math.round((h - w) / 2);
      px(x, top, shift(color, 18));
      px(x, top + 1, color, 1, Math.max(1, w - 3));
      px(x, top + w - 2, shade, 1, 2);
      extra?.(px, x, top, w);
    }
  });
}

const cache = new Map();

/** Every piece for a kit, baked once and kept. */
function pieces(kit) {
  const key = [
    kit.cap,
    kit.cap2,
    kit.shirt,
    kit.shade,
    kit.pants,
    kit.skin,
    kit.hair,
    kit.hairStyle,
    kit.beard,
    (kit.extras ?? []).join(),
  ].join("|");
  let set = cache.get(key);
  if (set) return set;
  const skinShade = shift(kit.skin, -35);
  const sweat = (kit.extras ?? []).includes("sweatbands");
  set = {
    // Flannels from hip to knee, with a crease along the front.
    thigh: limbPiece(22, 12, 10, kit.pants, kit.shade, (px, x, top, w) => {
      if (x % 7 === 3) px(x, top + Math.round(w / 2), kit.shade);
    }),
    // Pad from just above the knee to the boot: cane ribs along it, a knee roll and three straps.
    pad: limbPiece(29, 9, 8, PAD, PAD_SHADE, (px, x, top, w) => {
      for (let r = top + 2; r < top + w - 2; r += 2) px(x, r, PAD_RIB);
      if (x < 5) px(x, top, PAD_SHADE, 1, 1);
      if (x === 5) px(x, top, PAD_SHADE, 1, w);
      for (const s of [8, 16, 23]) if (x === s || x === s + 1) px(x, top + w - 4, PAD_SHADE, 1, 3);
      if (x === 8 || x === 16 || x === 23) px(x, top + w - 3, kit.cap2);
    }),
    // Sleeved for two thirds of the upper arm, then bare.
    upperArm: limbPiece(19, 10, 8, kit.shirt, kit.shade, (px, x, top, w) => {
      if (x > 12) {
        px(x, top, shift(kit.skin, 15));
        px(x, top + 1, kit.skin, 1, Math.max(1, w - 3));
        px(x, top + w - 2, skinShade, 1, 2);
      } else if (x === 12) px(x, top, kit.shade, 1, w);
    }),
    forearm: limbPiece(18, 7, 5, kit.skin, skinShade, (px, x, top, w) => {
      if (sweat && x >= 12 && x <= 14) px(x, top, kit.cap2, 1, w);
    }),
    neck: limbPiece(7, 6, 7, kit.skin, skinShade),
    hips: limbPiece(20, 12, 12, kit.pants, kit.shade),
    // Split-finger batting glove: a cuff, then sausage fingers.
    glove: bake(7, 7, (px) => {
      px(0, 1, GLOVE, 7, 5);
      px(0, 0, GLOVE_SHADE, 3, 7);
      px(0, 0, kit.cap2, 2, 7);
      for (const y of [1, 3, 5]) px(3, y, GLOVE_SHADE, 4, 1);
      px(6, 1, GLOVE_SHADE, 1, 5);
    }),
    // Spiked boot, toe to the off side.
    boot: bake(11, 6, (px) => {
      px(1, 0, BOOT, 8, 3);
      px(0, 1, BOOT, 11, 3);
      px(2, 0, shift(BOOT, 30), 4, 1);
      px(0, 4, SOLE, 11, 1);
      for (const x of [1, 4, 7, 9]) px(x, 5, SPIKE);
    }),
    // Shirt from waist (bottom) to shoulders (top), collar and folds, shaded on the right.
    torso: bake(22, 30, (px, w, h) => {
      for (let y = 0; y < h; y++) {
        const inset = Math.round((y / h) * 4);
        const width = w - 2 * (4 - inset) + 2;
        const left = Math.round((w - width) / 2);
        px(left, y, kit.shirt, width, 1);
        px(left + width - 4, y, kit.shade, 4, 1);
        px(left, y, shift(kit.shirt, 12), 1, 1);
      }
      px(7, 0, kit.cap, 8, 2);
      px(8, 2, kit.shade, 6, 1);
      for (const [x, y] of [
        [6, 9],
        [7, 10],
        [8, 11],
        [13, 17],
        [12, 18],
        [11, 19],
        [6, 23],
        [7, 24],
      ])
        px(x, y, kit.shade);
    }),
    // Back of the helmet: shell with a highlight, neck guard, ear guard and the peak towards the bowler.
    headBack: bake(26, 22, (px) => {
      const style = kit.hairStyle ?? "short";
      if (style === "long" || style === "curly") px(5, 15, kit.hair ?? HAIR, 8, style === "long" ? 6 : 3);
      for (let y = 0; y < 17; y++) {
        const half = Math.round(8 * Math.sqrt(Math.max(0, 1 - ((y - 8.5) / 8.8) ** 2)));
        px(9 - half, y, kit.cap, half * 2, 1);
      }
      px(5, 3, shift(kit.cap, 30), 4, 2);
      px(6, 2, shift(kit.cap, 45), 2, 1);
      px(2, 12, shift(kit.cap, -40), 15, 4);
      px(3, 16, shift(kit.cap, -55), 13, 1);
      px(14, 9, GRILLE, 3, 5);
      px(15, 10, shift(GRILLE, -30), 1, 3);
      px(14, 7, kit.cap, 11, 2);
      px(16, 9, shift(kit.cap, -40), 8, 1);
      px(4, 17, kit.skin, 9, 3);
    }),
    // Face on: shell, skin behind the grille, the peak towards us.
    headFront: bake(20, 20, (px) => {
      for (let y = 0; y < 17; y++) {
        const half = Math.round(8 * Math.sqrt(Math.max(0, 1 - ((y - 8.5) / 8.8) ** 2)));
        px(10 - half, y, kit.cap, half * 2, 1);
      }
      px(4, 7, kit.skin, 12, 9);
      if (kit.beard === "full") px(5, 13, kit.hair ?? HAIR, 10, 3);
      else if (kit.beard === "stubble") px(5, 14, shift(kit.skin, -45), 10, 2);
      px(1, 5, shift(kit.cap, -40), 18, 2);
      for (const y of [9, 12, 15]) px(4, y, GRILLE, 12, 1);
      px(7, 10, "#2a1d16", 2, 1);
      px(11, 10, "#2a1d16", 2, 1);
    }),
  };
  cache.set(key, set);
  return set;
}

/** The bat, along +x from the top of the handle: grip with its wrap, then the blade with a badge. Baked on first use. */
let bat = null;
const batPiece = () =>
  (bat ??= bake(38, 7, (px) => {
    px(0, 2, GRIP, 11, 3);
    for (let x = 1; x < 11; x += 3) px(x, 2, GRIP_WRAP, 1, 3);
    px(11, 0, BLADE_EDGE, 27, 7);
    px(11, 1, BLADE, 27, 5);
    for (let x = 13; x < 38; x += 4) px(x, 3 + ((x >> 2) % 2), BLADE_GRAIN, 2, 1);
    px(11, 6, shift(BLADE_EDGE, -25), 27, 1);
    px(14, 2, BADGE, 4, 3);
    px(15, 3, "#f4ecd0", 2, 1);
    px(35, 1, shift(BLADE, -15), 3, 5);
  }));

/** Lay `piece` (lying along +x) from point a to point b on screen, `thick` its height in screen px. */
function between(piece, a, b, thick) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(a.x), Math.round(a.y));
  ctx.rotate(Math.atan2(dy, dx));
  ctx.drawImage(piece, 0, Math.round(-thick / 2), Math.round(len), Math.max(1, Math.round(thick)));
  ctx.restore();
}

/** Draw `piece` upright, its (ax, ay) pixel at screen point p. */
function upright(piece, p, ax, ay, scale) {
  ctx.drawImage(
    piece,
    Math.round(p.x - ax * scale),
    Math.round(p.y - ay * scale),
    Math.round(piece.width * scale),
    Math.round(piece.height * scale),
  );
}

/**
 * The striker from his solved skeleton `rig` (solveBatterRig), feet at (x, y). `front`: seen from the
 * bowler's end (the caller has mirrored the canvas). Far leg and arm, body, near leg and arm, bat, head;
 * a bat raised behind him (toe above the chest) goes in before the body instead.
 */
export function drawBatterParts(x, y, scale, pose, kit, number, front, rig) {
  const set = pieces(kit);
  const at = (p) => ({ x: x + p.x * scale, y: y + p.y * scale });
  const s = scale;
  const leg = (hip, knee, foot, heel = 0) => {
    between(set.thigh, at(hip), at(knee), 12 * s);
    const top = { x: knee.x + (hip.x - knee.x) * 0.22, y: knee.y + (hip.y - knee.y) * 0.22 };
    between(set.pad, at(top), at({ x: foot.x, y: foot.y - 1 }), 10 * s);
    upright(set.boot, at(foot), 5, 2 + heel, s);
  };
  const arm = (shoulder, elbow, hand) => {
    between(set.upperArm, at(shoulder), at(elbow), 10 * s);
    between(set.forearm, at(elbow), at(hand), 7 * s);
  };
  const bat = () => {
    const face = pose.rig === 1 ? Math.max(0.22, Math.abs(pose.batFace)) : 1;
    const from = { x: rig.topHand.x - rig.dir.x * 2, y: rig.topHand.y - rig.dir.y * 2 };
    const toe = { x: rig.topHand.x + rig.dir.x * 36, y: rig.topHand.y + rig.dir.y * 36 };
    between(batPiece(), at(from), at(toe), 7 * s * face * (1 + 0.3 * rig.near));
  };
  const gloves = () => {
    for (const g of [rig.topHand, rig.bottomHand]) upright(set.glove, at(g), 3, 3, s);
  };

  // Seen from behind the far side is the front leg and arm; from the bowler's end, the back ones.
  const far = front
    ? {
        hip: rig.backHip,
        knee: rig.backKnee,
        foot: rig.backFoot,
        heel: pose.backHeel ?? 0,
        sh: rig.backShoulder,
        el: rig.backElbow,
        wr: rig.backWrist,
      }
    : {
        hip: rig.frontHip,
        knee: rig.frontKnee,
        foot: rig.frontFoot,
        heel: pose.frontHeel ?? 0,
        sh: rig.frontShoulder,
        el: rig.frontElbow,
        wr: rig.frontWrist,
      };
  const near = front
    ? {
        hip: rig.frontHip,
        knee: rig.frontKnee,
        foot: rig.frontFoot,
        heel: pose.frontHeel ?? 0,
        sh: rig.frontShoulder,
        el: rig.frontElbow,
        wr: rig.frontWrist,
      }
    : {
        hip: rig.backHip,
        knee: rig.backKnee,
        foot: rig.backFoot,
        heel: pose.backHeel ?? 0,
        sh: rig.backShoulder,
        el: rig.backElbow,
        wr: rig.backWrist,
      };
  const toeY = rig.topHand.y + rig.dir.y * 36;
  const batBehind = toeY < rig.chest.y;

  leg(far.hip, far.knee, far.foot, far.heel);
  arm(far.sh, far.el, far.wr);
  if (batBehind) bat();

  // Hips and shirt: the shirt stands from the waist up to between the shoulders, as wide as they are apart.
  between(set.hips, at({ x: rig.backHip.x - 4, y: rig.backHip.y }), at({ x: rig.frontHip.x + 4, y: rig.frontHip.y }), 12 * s);
  const waist = at({ x: rig.pelvis.x, y: rig.pelvis.y - 4 });
  const shoulders = at({
    x: (rig.backShoulder.x + rig.frontShoulder.x) / 2,
    y: (rig.backShoulder.y + rig.frontShoulder.y) / 2 - 2,
  });
  const span = Math.hypot(rig.frontShoulder.x - rig.backShoulder.x, rig.frontShoulder.y - rig.backShoulder.y) + 6;
  set.torsoAlong ??= rotatePiece(set.torso);
  between(set.torsoAlong, waist, shoulders, span * s);
  if (number && !front) {
    const c = at({ x: rig.chest.x - 2.5, y: rig.chest.y + 5 });
    drawText(String(number), c.x, c.y, { align: "center", color: kit.cap, shadow: null, scale: scale >= 1.5 ? 2 : 1 });
  }

  leg(near.hip, near.knee, near.foot, near.heel);
  arm(near.sh, near.el, near.wr);
  if (!batBehind) bat();
  gloves();

  // Neck, then the helmet over everything.
  between(set.neck, at({ x: rig.chest.x, y: rig.chest.y - 3 }), at({ x: rig.head.x - 0.5, y: rig.head.y + 5 }), 6 * s);
  if (front) upright(set.headFront, at(rig.head), 10, 9, s);
  else upright(set.headBack, at(rig.head), 9, 9, s);
}

/** The shirt piece turned on its side, so it lies along +x from waist to shoulders like the limbs. */
function rotatePiece(piece) {
  const canvas = document.createElement("canvas");
  canvas.width = piece.height;
  canvas.height = piece.width;
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  // Waist (the piece's bottom) at x = 0, shoulders (its top) at the far end.
  c.translate(piece.height, 0);
  c.rotate(Math.PI / 2);
  c.drawImage(piece, 0, 0);
  return canvas;
}
