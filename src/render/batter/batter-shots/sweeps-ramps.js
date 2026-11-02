// Authored poses on the current Cricket Lab rig.
export function extendSpecialShots({ clip, stance, clips }) {
  const out = {};
  function sweep(id, name, { reverse = false, paddle = false } = {}) {
    const contact = reverse
      ? { px: 21, py: -29, angle: 85, plane: 0, batFace: 1, shoulderTurn: 35 }
      : paddle
        ? { px: 9, py: -28, angle: 278, plane: 0.2, batFace: 0.8, shoulderTurn: 8 }
        : { px: 11, py: -25, angle: 275, plane: 0, batFace: 1, shoulderTurn: -12 };
    const load = reverse ? { px: 10, py: -41, angle: 210, plane: 0.1 } : { px: 13, py: -41, angle: 145, plane: 0.15 };
    const follow = reverse
      ? { px: 24, py: -38, angle: 111, shoulderTurn: 45 }
      : paddle
        ? { px: 4, py: -30, angle: 265, shoulderTurn: 0 }
        : { px: -2, py: -35, angle: 245, shoulderTurn: -30 };
    const finish = reverse
      ? { px: 15, py: -48, angle: 143, batFace: 0.4 }
      : paddle
        ? { px: 1, py: -33, angle: 255, batFace: 0.4 }
        : { px: -12, py: -43, angle: 230, batFace: 0.4 };
    return (out[id] = clip(
      name,
      reverse ? 0.1 : 0.09,
      { front: [-0.11, 0.27], back: [-0.11, 0.27] },
      [
        [-0.34, "Stance", stance()],
        [
          -0.25,
          "Get low",
          {
            frontFootX: 14,
            frontFootY: -9,
            frontLift: 3,
            backFootX: -11,
            backFootY: -2,
            pelvisX: -2,
            pelvisY: -31,
            crouch: 12,
            chestX: 4,
            chestY: -58,
            headX: 7,
            headY: -71,
            px: 13,
            py: -44,
            angle: reverse ? 155 : 105,
            plane: 0.3,
            hipTurn: 20,
            shoulderTurn: 30,
            bowlerGripLift: 3,
          },
        ],
        [
          -0.11,
          "Plant",
          {
            frontFootX: 22,
            frontFootY: -8,
            frontLift: 0,
            backFootX: -14,
            backFootY: -2,
            pelvisX: -3,
            pelvisY: -19,
            crouch: 24,
            chestX: 6,
            chestY: -44,
            headX: 10,
            headY: -57,
            hipTurn: 10,
            ...load,
          },
        ],
        [reverse ? -0.1 : -0.09, "Set the bat", load, "in"],
        [0, "Contact", contact],
        [0.08, "Sweep through", { ...follow, plane: paddle ? 0.12 : 0, batFace: 0.65 }, "out"],
        [0.2, "Finish", finish],
        [0.27, "Hold", {}],
        [
          0.45,
          "Rise",
          {
            frontFootX: 15,
            frontFootY: -10,
            frontLift: 2,
            backFootX: -11,
            backFootY: -2,
            pelvisX: -1,
            pelvisY: -31,
            crouch: 12,
            chestX: 4,
            chestY: -58,
            headX: 6,
            headY: -71,
            px: 12,
            py: -43,
            angle: reverse ? 100 : 150,
            plane: 0.3,
            hipTurn: 23,
            shoulderTurn: 30,
          },
        ],
        [0.78, "Ready", stance()],
      ],
      { group: "Sweeps" },
    ));
  }
  sweep("sweep", "Sweep");
  sweep("paddleSweep", "Paddle sweep", { paddle: true });
  sweep("reverseSweep", "Reverse sweep", { reverse: true });

  function ramp(id, name, contact, finish) {
    return (out[id] = clip(
      name,
      0.07,
      { front: [-0.105, 0.23], back: [-0.105, 0.23] },
      [
        [-0.28, "Stance", stance()],
        [
          -0.19,
          "Set the base",
          {
            frontFootX: 8,
            frontFootY: -10,
            frontLift: 1.5,
            backFootX: -9,
            backFootY: -2,
            pelvisX: 0,
            pelvisY: -38,
            crouch: 5,
            chestX: 4,
            chestY: -66,
            headX: 6,
            headY: -79,
            px: 13,
            py: -48,
            angle: 52,
            plane: 0.65,
            hipTurn: 25,
            shoulderTurn: 30,
            bowlerGripLift: 4,
          },
        ],
        [-0.105, "Plant", { frontLift: 0, pelvisY: -36, crouch: 7, chestY: -64, headY: -77, px: 14, py: -50, angle: 105 }],
        [-0.07, "Open the face", { angle: 120, batFace: 0.65 }, "in"],
        [0, "Contact", contact],
        [0.08, "Guide up", { ...finish, batFace: 0.7 }, "out"],
        [0.23, "Hold", { ...finish, batFace: 0.45 }],
        [
          0.43,
          "Recover",
          {
            frontFootX: 7,
            frontFootY: -10,
            pelvisY: -40,
            crouch: 3,
            chestY: -69,
            headY: -82,
            px: 12,
            py: -47,
            angle: 63,
            plane: 0.6,
            hipTurn: 28,
            shoulderTurn: 32,
          },
        ],
        [0.67, "Ready", stance()],
      ],
      { group: "Ramps and scoops" },
    ));
  }
  ramp(
    "rampKeeper",
    "Ramp over the keeper",
    { px: 13, py: -51, angle: 150, plane: 0.94, batFace: 1 },
    { px: 9, py: -67, angle: 169, plane: 0.9, shoulderTurn: 22 },
  );
  ramp(
    "rampSlips",
    "Ramp over the slips",
    { px: 20, py: -52, angle: 125, plane: 0.6, batFace: 1, shoulderTurn: 42 },
    { px: 20, py: -65, angle: 142, plane: 0.55, shoulderTurn: 46 },
  );
  ramp(
    "scoopFineLeg",
    "Scoop over fine leg",
    { px: 5, py: -50, angle: -130, plane: 0.5, batFace: 1, shoulderTurn: 5 },
    { px: -7, py: -62, angle: -154, plane: 0.45, shoulderTurn: -18 },
  );

  return out;
}
