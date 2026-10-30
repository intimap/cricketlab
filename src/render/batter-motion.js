// Visual study only. Time is seconds relative to the existing visual contact event.
// No cricket decisions, collision tests or result-affecting random numbers belong here.
const BASE = {
  rig: 1,
  px: 12,
  py: -43,
  angle: 12,
  plane: 0.72,
  batFace: 0.9,
  step: 0,
  lean: 0,
  back: 0,
  drop: 0,
  frontFootX: 7,
  frontFootY: -10,
  backFootX: -8,
  backFootY: -2,
  frontLift: 0,
  backLift: 0,
  frontHeel: 0,
  backHeel: 0,
  pelvisX: 0,
  pelvisY: -43,
  chestX: 3,
  chestY: -72,
  headX: 4,
  headY: -85,
  hipTurn: 30,
  shoulderTurn: 34,
  bowlerGripLift: 6,
};
const stance = () => ({ ...BASE });
function clip(name, downswing, plant, frames) {
  let pose = stance();
  return {
    name,
    downswing,
    contact: 0,
    start: frames[0][0],
    end: frames.at(-1)[0],
    plant,
    frames: frames.map(([time, phase, values, ease = "smooth"]) => {
      pose = { ...pose, ...values };
      return { time, phase, ease, pose: { ...pose } };
    }),
  };
}

export const BATTER_CLIPS = {
  straightDrive: clip("Straight drive", 0.085, { front: [-0.06, 0.43], back: [-0.34, 0.43] }, [
    [-0.34, "Stance", stance()],
    [-0.25, "Load", { px: 14, py: -54, angle: 92, hipTurn: 36, shoulderTurn: 47, chestX: 1, headX: 3 }],
    [
      -0.16,
      "Stride",
      {
        frontFootX: 12,
        frontFootY: -13,
        frontLift: 4,
        px: 15,
        py: -60,
        angle: 124,
        pelvisX: 2,
        pelvisY: -44,
        chestX: 5,
        headX: 7,
        hipTurn: 28,
        shoulderTurn: 40,
      },
    ],
    [
      -0.085,
      "Plant / backswing",
      {
        frontFootX: 16,
        frontFootY: -16,
        frontLift: 0,
        pelvisX: 4,
        pelvisY: -46,
        chestX: 9,
        chestY: -72,
        headX: 12,
        headY: -86,
        px: 18,
        py: -61,
        angle: 117,
        hipTurn: 23,
        shoulderTurn: 34,
        batFace: 0.48,
      },
      "in",
    ],
    [
      0,
      "Contact",
      { px: 18, py: -43, angle: 0, plane: 0.82, batFace: 1, pelvisX: 5, chestX: 10, headX: 13, hipTurn: 16, shoulderTurn: 20 },
    ],
    [
      0.065,
      "Extension",
      { px: 17, py: -52, angle: -64, batFace: 0.85, shoulderTurn: 2, backHeel: 2, chestX: 11, headX: 13 },
      "out",
    ],
    [
      0.25,
      "Finish",
      {
        px: 3,
        py: -78,
        angle: -169,
        plane: 0.76,
        batFace: 0.34,
        hipTurn: 3,
        shoulderTurn: -14,
        backHeel: 3,
        chestX: 9,
        headX: 11,
      },
    ],
    [0.43, "Hold", {}],
    [
      0.64,
      "Recover",
      {
        px: 12,
        py: -56,
        angle: -66,
        batFace: 0.5,
        frontFootX: 11,
        frontFootY: -13,
        frontLift: 3,
        backHeel: 0,
        pelvisX: 2,
        pelvisY: -44,
        chestX: 5,
        headX: 7,
        hipTurn: 22,
        shoulderTurn: 24,
      },
    ],
    [0.94, "Ready", stance()],
  ]),
  forwardDefence: clip("Forward defence", 0.12, { front: [-0.035, 0.18], back: [-0.25, 0.18] }, [
    [-0.25, "Stance", stance()],
    [-0.16, "Prepare", { px: 13, py: -47, angle: 28, shoulderTurn: 38 }],
    [
      -0.12,
      "Short stride",
      { frontFootX: 10, frontFootY: -14, frontLift: 2, pelvisX: 1, chestX: 5, headX: 7, px: 14, py: -45, angle: 16 },
    ],
    [
      -0.04,
      "Plant",
      {
        frontFootX: 12,
        frontFootY: -14,
        frontLift: 0,
        pelvisX: 3,
        pelvisY: -44,
        chestX: 8,
        chestY: -70,
        headX: 11,
        headY: -83,
        px: 15,
        py: -39,
        angle: 2,
        plane: 0.83,
        shoulderTurn: 30,
      },
    ],
    [0, "Contact", { px: 15, py: -39, angle: 1, batFace: 1 }],
    [0.08, "Absorb", { px: 14, py: -39, angle: -3, chestX: 7, headX: 10 }, "out"],
    [0.18, "Hold", {}],
    [
      0.36,
      "Recover",
      {
        frontFootX: 9,
        frontFootY: -13,
        frontLift: 2,
        pelvisX: 1,
        pelvisY: -43,
        chestX: 4,
        chestY: -72,
        headX: 5,
        headY: -85,
        px: 13,
        py: -42,
        angle: 9,
        shoulderTurn: 34,
        batFace: 0.9,
      },
    ],
    [0.57, "Ready", stance()],
  ]),
  pull: clip("Pull", 0.075, { front: [-0.13, 0.38], back: [-0.13, 0.38] }, [
    [-0.32, "Stance", stance()],
    [
      -0.23,
      "Load back",
      {
        backFootX: -11,
        backFootY: 0,
        backLift: 2,
        frontFootX: 5,
        frontFootY: -7,
        pelvisX: -3,
        pelvisY: -42,
        chestX: -1,
        chestY: -71,
        headX: 1,
        headY: -85,
        px: 17,
        py: -59,
        angle: 73,
        plane: 0.18,
        hipTurn: 41,
        shoulderTurn: 59,
        batFace: 0.42,
        bowlerGripLift: -2,
      },
    ],
    [-0.13, "Plant", { backLift: 0, frontFootX: 4, frontFootY: -6, px: 20, py: -62, angle: 82, shoulderTurn: 63 }],
    [
      -0.075,
      "Coil",
      { px: 20, py: -62, angle: 79, plane: 0, pelvisX: -3, chestX: -1, headX: 1, hipTurn: 34, shoulderTurn: 56 },
      "in",
    ],
    [
      0,
      "Contact",
      {
        px: 9,
        py: -61,
        angle: -88,
        plane: 0,
        batFace: 1,
        pelvisX: -1,
        chestX: 1,
        headX: 2,
        hipTurn: 8,
        shoulderTurn: -12,
        frontHeel: 1,
        backHeel: 1,
      },
    ],
    [
      0.075,
      "Rotate through",
      {
        px: -11,
        py: -58.5,
        angle: -116,
        batFace: 0.72,
        hipTurn: -15,
        shoulderTurn: -38,
        chestX: 0,
        headX: 2,
        frontHeel: 2,
        backHeel: 1,
      },
      "out",
    ],
    [0.22, "Finish", { px: -17, py: -68, angle: -144, batFace: 0.38, hipTurn: -20, shoulderTurn: -48, chestX: -1, headX: 1 }],
    [0.38, "Hold", {}],
    [0.47, "Unwind", { px: -10, py: -48, angle: -110, batFace: 0.5 }],
    [
      0.59,
      "Recover",
      {
        px: 10,
        py: -53,
        angle: -65,
        batFace: 0.6,
        frontFootX: 6,
        frontFootY: -9,
        backFootX: -9,
        backFootY: -1,
        backLift: 1,
        hipTurn: 15,
        shoulderTurn: 20,
        frontHeel: 0,
        backHeel: 0,
        pelvisX: 0,
        chestX: 3,
        headX: 4,
      },
    ],
    [0.85, "Ready", stance()],
  ]),
};

const ease = (kind, t) => (kind === "in" ? t * t : kind === "out" ? 1 - (1 - t) ** 2 : t * t * (3 - 2 * t));

export function sampleBatterMotion(name, secondsFromContact, { view = "batter" } = {}) {
  const c = BATTER_CLIPS[name];
  if (!c) throw new Error(`Unknown batter clip: ${name}`);
  const t = Math.max(c.start, Math.min(c.end, secondsFromContact));
  let left = c.frames[0],
    right = c.frames.at(-1);
  for (let i = 1; i < c.frames.length; i++) {
    if (t <= c.frames[i].time) {
      left = c.frames[i - 1];
      right = c.frames[i];
      break;
    }
  }
  const k = ease(left.ease, Math.max(0, Math.min(1, (t - left.time) / Math.max(0.0001, right.time - left.time))));
  const pose = {};
  for (const key of Object.keys(BASE)) pose[key] = left.pose[key] + (right.pose[key] - left.pose[key]) * k;
  // The far-camera study reverses depth around the stance plane, not just screen x.
  // The renderer additionally reverses limb layering and helmet presentation.
  if (view === "bowler") {
    pose.frontFootY = -10 - 0.5 * pose.frontFootY;
    pose.backFootY = -10 - 0.5 * pose.backFootY;
    const carry = pose.pelvisY - BASE.pelvisY;
    pose.pelvisY -= 2 * carry;
    pose.chestY -= 2 * carry;
    pose.headY -= 2 * carry;
    pose.py -= 2 * carry + pose.bowlerGripLift;
  } else if (view !== "batter") throw new Error(`Unknown camera view: ${view}`);
  return pose;
}

export function batterPhase(name, t) {
  const c = BATTER_CLIPS[name];
  if (t >= c.end) return "Ready";
  let phase = c.frames[0].phase;
  for (const frame of c.frames) if (t >= frame.time) phase = frame.phase;
  return phase;
}

export function gamePreparationWindow(name) {
  return name === "forwardDefence" ? 0.12 : BATTER_CLIPS[name].downswing + 0.07;
}

// Compress the study's preparation into the existing player's available window.
// Downswings and contact remain at their original times. Defence has no swing to protect.
export function gameMotionTime(name, t, windowBeforeContact = gamePreparationWindow(name)) {
  const clip = BATTER_CLIPS[name];
  const swing = name === "forwardDefence" ? 0 : clip.downswing;
  if (!(windowBeforeContact > swing)) throw new Error("Preparation window must exceed the protected downswing");
  if (t >= -swing) return t;
  const progress = Math.max(0, Math.min(1, (t + windowBeforeContact) / (windowBeforeContact - swing)));
  return clip.start + progress * (-swing - clip.start);
}

export function sampleGameBatterMotion(name, t, { view = "batter", windowBeforeContact = gamePreparationWindow(name) } = {}) {
  return sampleBatterMotion(name, gameMotionTime(name, t, windowBeforeContact), { view });
}
