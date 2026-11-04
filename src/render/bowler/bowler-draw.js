import { fillCircle, fillEllipse, fillPolygon, fillRect } from "../../engine/screen.js";
import { drawText } from "../../engine/text.js";
import { BOOT, HAIR, groundShadow, darken } from "../kit.js";

/**
 * The bowler drawn from his skeleton (bowler-skeleton.js) in the close view, in the same pixel style as the
 * other figures: limbs as runs of dots, a torso between shoulders and hips, boots, and a head that shows a
 * face when he's facing the camera and the back of his head (with his shirt number) when he isn't.
 *
 * view: { root: screen point under his pelvis, ppm: pixels per metre, line: his run line's world x,
 *         sx: screen x per metre of world x (+1 or -1), away: +1 if farther down the pitch is larger z
 *         (the camera behind the striker), -1 from the bowler's end, mirror: -1 for a left-armer }.
 */

/** How far up the screen a metre further from the camera lifts a point (the close camera looks down a little). */
const DEPTH_RISE = 0.22;

/** Limb thickness (m) at each end. */
const R = { thigh: [0.085, 0.065], shin: [0.06, 0.045], upper: [0.05, 0.043], fore: [0.043, 0.036], spine: 0.15 };

export function drawBowlerRig(skeleton, kit, view, opts = {}) {
  const { root, ppm, line, sx, away } = view;
  const mirror = view.mirror ?? 1;
  const rootZ = skeleton.pelvis.z;
  const worldX = (p) => line - p.x * mirror;
  const rootX = worldX(skeleton.pelvis);
  const screen = (p) => ({
    x: root.x + (worldX(p) - rootX) * ppm * sx,
    y: root.y - p.y * ppm - (p.z - rootZ) * away * ppm * DEPTH_RISE,
  });
  const depth = (p) => (p.z - rootZ) * away;
  const S = Object.fromEntries(Object.entries(skeleton).map(([k, p]) => [k, p && "y" in p ? screen(p) : p]));

  const limb = (a, b, r0, r1, colour, shade) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)) + 1;
    for (const [c, trim, off] of shade
      ? [
          [shade, 0, 0],
          [colour, 0.35, -0.35],
        ]
      : [[colour, 0, 0]]) {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        fillCircle(a.x + (b.x - a.x) * t + off, a.y + (b.y - a.y) * t, Math.max(0.5, (r0 + (r1 - r0) * t) * ppm - trim), c);
      }
    }
  };
  const shirt = kit.shirt;
  const shirtShade = kit.shade;
  const pants = kit.pants;
  const pantsShade = kit.pantsShade ?? kit.shade;
  const skin = kit.skin;
  const skinShade = darken(skin, 30);

  groundShadow(root.x, root.y, 0.32 * ppm, 0.08 * ppm, 0.3);

  // Each part with its depth, drawn far to near so whatever is nearer the camera covers the rest.
  const parts = [
    {
      d: (depth(skeleton.kneeL) + depth(skeleton.ankleL)) / 2,
      draw: () => leg(S.hipL, S.kneeL, S.ankleL, skeleton.ankleL, skeleton.hipFacing),
    },
    {
      d: (depth(skeleton.kneeR) + depth(skeleton.ankleR)) / 2,
      draw: () => leg(S.hipR, S.kneeR, S.ankleR, skeleton.ankleR, skeleton.hipFacing),
    },
    { d: depth(skeleton.pelvis) + 0.001, draw: () => torso() },
    // The head always over his own shoulders and neck.
    { d: Math.min(depth(skeleton.head), depth(skeleton.pelvis)) - 0.005, draw: () => head() },
    { d: (depth(skeleton.elbowL) + depth(skeleton.handL)) / 2, draw: () => arm(S.shoulderL, S.elbowL, S.handL, false) },
    { d: (depth(skeleton.elbowR) + depth(skeleton.handR)) / 2, draw: () => arm(S.shoulderR, S.elbowR, S.handR, true) },
  ];
  parts.sort((a, b) => b.d - a.d);
  for (const part of parts) part.draw();

  function leg(hip, knee, ankle, ankle3, facing) {
    limb(hip, knee, R.thigh[0], R.thigh[1], pants, pantsShade);
    limb(knee, ankle, R.shin[0], R.shin[1], pants, pantsShade);
    // The boot points the way his hips face, foreshortened by how much of that is towards the camera.
    const toe = screen({ x: ankle3.x + facing.x * 0.2, y: ankle3.y - 0.05, z: ankle3.z + facing.z * 0.2 });
    const heel = { x: ankle.x, y: ankle.y + 0.04 * ppm };
    limb(heel, toe, 0.045, 0.04, BOOT);
  }

  function arm(shoulder, elbow, hand, bowling) {
    limb(shoulder, elbow, R.upper[0], R.upper[1], shirt, shirtShade);
    limb(elbow, hand, R.fore[0], R.fore[1], skin, skinShade);
    fillCircle(hand.x, hand.y, Math.max(0.8, 0.045 * ppm), skin);
    if (bowling && opts.ball) fillCircle(hand.x, hand.y - 0.02 * ppm, Math.max(0.7, 0.035 * ppm), opts.ball);
  }

  function torso() {
    const neck = S.neck;
    const p = S.pelvis;
    // A thick spine gives him depth from any side; the shoulders and hips give his width when square on.
    limb(p, neck, R.spine * 0.9, R.spine, shirt, shirtShade);
    fillPolygon(
      [S.shoulderL, S.shoulderR, mid(S.hipR, S.shoulderR, 0.15), S.hipR, S.hipL, mid(S.hipL, S.shoulderL, 0.15)],
      shirt,
    );
    limb(S.hipL, S.hipR, 0.09, 0.09, pants, pantsShade);
    limb(neck, mid(neck, S.head, 0.55), 0.05, 0.05, skin);
  }

  function head() {
    const h = S.head;
    const r = Math.max(1.5, 0.115 * ppm);
    // Facing the camera if his shoulders face back up the pitch towards it.
    const toCamera = -skeleton.facing.z * away;
    const hair = kit.hair ?? HAIR;
    const style = kit.hairStyle ?? "short";
    if (toCamera > 0.2) {
      fillCircle(h.x, h.y, r, skin);
      if (style !== "bald") fillEllipse(h.x, h.y - r * 0.55, r * 1.02, r * 0.55, hair);
      const eye = Math.max(1, Math.round(r * 0.22));
      for (const dx of [-0.38, 0.38]) fillRect(h.x + dx * r - eye / 2, h.y, eye, eye, "#1d1d22");
    } else {
      fillCircle(h.x, h.y, r, style === "bald" ? skin : hair);
      // From behind: his number across the shoulders, once he's big enough on screen to read it.
      if (kit.number && ppm > 38 && toCamera < -0.5) {
        const back = mid(S.neck, S.pelvis, 0.35);
        drawText(String(kit.number), back.x, back.y - 3, {
          align: "center",
          color: kit.numberColour ?? kit.cap ?? "#1d1d22",
          shadow: null,
        });
      }
    }
  }
}

const mid = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
