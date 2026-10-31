import { COLORS, fillRect, plot, drawLine, fillCircle, fillEllipse, fillPolygon } from "../engine/screen.js";
import {
  BAT_FACE,
  BAT_EDGE,
  PAD,
  PAD_SHADE,
  BOOT,
  HAIR,
  mirrored,
  groundShadow,
  lighten,
  darken,
  drawFacialHair,
} from "./kit.js";
import { joint } from "./batter-rig.js";

/** Everyone but the striker: bowler, keeper, fielders, umpires and runners, close up and tiny in the wide view. */

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

  groundShadow(x, y, 9 * k, 2 * k, 0.3);

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
  const hair = kit.hair ?? HAIR;
  const style = kit.hairStyle ?? "short";
  const bald = style === "bald";
  const bare = (rx, ry, w, hh, c) =>
    poly(
      [
        { x: rx, y: ry },
        { x: rx + w, y: ry },
        { x: rx + w, y: ry + hh },
        { x: rx, y: ry + hh },
      ],
      c,
    );
  if (opts.back) {
    // The back of the head: hair (or a fringe round a bald patch), and ears either side.
    fillCircle(h.x - 4.4 * k, h.y + 0.5 * k, 1.2 * k, kit.skin);
    fillCircle(h.x + 4.4 * k, h.y + 0.5 * k, 1.2 * k, kit.skin);
    fillCircle(h.x, h.y, (style === "curly" ? 5.1 : 4.6) * k, bald ? kit.skin : hair);
    if (bald) fillEllipse(h.x, h.y + 2.6 * k, 4.3 * k, 1.6 * k, hair);
    if (style === "long") bare(head.x - 3.5, head.y + 2, 7, 4.5, hair);
  } else {
    fillCircle(h.x, h.y, 4.6 * k, kit.skin);
    fillCircle(h.x + 1.5 * k, h.y + 0.5 * k, 3 * k, kit.skin);
    // Hair showing under the cap or hat.
    if (!bald && !opts.bat) {
      const drop = style === "long" ? 6 : style === "curly" ? 3 : style === "buzz" ? 0.8 : 2;
      const wide = style === "curly" ? 1.6 : 1;
      bare(head.x - 4.9, head.y - 3, wide, 1 + drop, hair);
      bare(head.x + 4.9 - wide, head.y - 3, wide, 1 + drop, hair);
    }
    if (!opts.bat) {
      const extras = kit.extras ?? [];
      if (extras.includes("sunglasses")) {
        // Wraparounds, with a glint.
        bare(head.x - 3.6, head.y - 0.8, 7.2, 1.8, "#15171c");
        bare(head.x - 2.6, head.y - 0.4, 1, 0.5, "#8fb8d8");
      } else {
        // Eyes.
        const eye = Math.max(1, Math.round(0.8 * k));
        for (const dx of [-1.7, 1.7]) {
          const e = at({ x: head.x + dx, y: head.y - 0.2 });
          fillRect(e.x, e.y, eye, eye, "#1d1d22");
        }
      }
      if (extras.includes("zinc")) {
        // Zinc cream on the nose and lips.
        bare(head.x - 0.7, head.y + 0.3, 1.6, 1.4, "#f6f6f0");
        bare(head.x - 1.4, head.y + 2.5, 2.8, 0.7, "#f6f6f0");
      }
    }
    if (!opts.bat) drawFacialHair(kit, head, h, k, false, bare);
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
    // A beard shows below the grille.
    if (!opts.back) drawFacialHair(kit, head, h, k, true, bare);
    if (opts.back && style === "long") bare(head.x - 3.5, head.y + 3.5, 7, 3, hair);
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
    if (!umpire && (kit.extras ?? []).includes("sweatbands")) {
      const wrist = { x: e.x + (hands[i].x - e.x) * 0.78, y: e.y + (hands[i].y - e.y) * 0.78 };
      const w = at(wrist);
      fillCircle(w.x, w.y, 1.9 * k, kit.cap2);
    }
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
  groundShadow(x, y, 3 * k, 1, 0.35);
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

/**
 * The small figure's pose for a fielder's state (sim/fielder-motion.js): crouched
 * ready or set, on the ground after a dive and getting up, the crow-hop run into a throw.
 */
export function fielderPose(f, t, phase) {
  const since = t - f.stateAt;
  if (f.state === "dive") return "dive";
  if (f.state === "down" || (f.state === "getUp" && since < 0.2)) return "down";
  if (f.state === "celebrate") return "celebrate";
  if (f.state === "crowHop") return "run";
  if (f.state === "throw" && since < 0.4) return "throw";
  if (f.curSpeed > 0.5 || (f.state === "idle" && phase === "return")) return "run";
  if (f.role === "keeper" || f.state === "ready" || f.state === "set") return "keeper";
  return "idle";
}
