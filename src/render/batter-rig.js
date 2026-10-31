import { drawLine, fillCircle, fillEllipse, fillPolygon } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { PAD, PAD_SHADE, HAIR, mirrored, groundShadow, lighten, darken } from "./kit.js";
import { drawCloth, drawBoot } from "./batter-surfaces.js";
import { drawBat } from "./bat.js";

/**
 * The striker in the close view: his key poses, the projected 3D skeleton solved from a pose and the drawing of him in kit.
 */

export { BATTER_POSES, lerpPose, reachPose } from "./batter-poses.js";
export { solveBatterSkeleton, batterJointToWorld } from "./batter-skeleton.js";
export { solveBatterRig } from "./batter-projection.js";
import { solveBatterRig } from "./batter-projection.js";

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
    bat,
    body,
    frontLegNear,
    frontArmNear,
    frontFootShadow,
    backFootShadow,
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
  for (const shadow of [frontFootShadow, backFootShadow]) {
    const foot = at(shadow);
    fillEllipse(foot.x, foot.y, 6 * scale, 1.6 * scale, "rgba(0,0,0,0.24)");
  }
  const leg = (hip, knee, foot, boot) => {
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
    drawBoot(boot, poly);
  };
  // Depth determines which leg overlaps the other, whichever camera is selected.
  if (frontLegNear) {
    leg(backHip, backKnee, backFoot, body.backBoot);
    leg(frontHip, frontKnee, frontFoot, body.frontBoot);
  } else {
    leg(frontHip, frontKnee, frontFoot, body.frontBoot);
    leg(backHip, backKnee, backFoot, body.backBoot);
  }
  if (frontArmNear) arm(backShoulder, backElbow, backWrist);
  else arm(frontShoulder, frontElbow, frontWrist);

  drawCloth(body.hips, kit.pants, kit.shade, poly);
  drawCloth(body.shirt, kit.shirt, kit.shade, poly);
  line(body.seam[0], body.seam[1], 1, kit.shade);
  if (number) {
    const label = at(body.number);
    drawText(String(number), label.x, label.y, {
      align: "center", color: kit.cap, shadow: null, scale: scale >= 1.5 ? 2 : 1,
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

  if (frontArmNear) arm(frontShoulder, frontElbow, frontWrist);
  else arm(backShoulder, backElbow, backWrist);

  drawBat({ bat }, poly, line);
  // Gloves.
  for (const g of [topHand, bottomHand]) {
    const p = at(g);
    fillCircle(p.x, p.y, 3 * scale, "#f1f1f1");
    fillCircle(p.x + scale, p.y + scale, 1.3 * scale, kit.cap2);
  }
}
