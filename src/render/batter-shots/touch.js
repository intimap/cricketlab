// Authored poses on the current Cricket Lab rig.
export function extendTouchShots({ clip, stance, clips }) {
  const out = {};
  function glance(id, name, backFoot = false) {
    const feet = backFoot
      ? { backFootX: -11, backFootY: 0, frontFootX: 5, frontFootY: -7 }
      : { backFootX: -8, backFootY: -2, frontFootX: 10, frontFootY: -12 };
    return (out[id] = clip(
      name,
      backFoot ? 0.075 : 0.085,
      { front: [-0.12, 0.2], back: [-0.12, 0.2] },
      [
        [-0.27, "Stance", stance()],
        [
          -0.18,
          backFoot ? "Move back" : "Small stride",
          {
            ...feet,
            frontLift: backFoot ? 0 : 2,
            backLift: backFoot ? 1.5 : 0,
            pelvisX: backFoot ? -2 : 1,
            pelvisY: -43,
            chestX: 2,
            chestY: -71,
            headX: 4,
            headY: -84,
            px: 12,
            py: -47,
            angle: 39,
            hipTurn: 25,
            shoulderTurn: 30,
            bowlerGripLift: 4,
          },
        ],
        [-0.12, "Plant", { frontLift: 0, backLift: 0 }],
        [backFoot ? -0.075 : -0.085, "Prepare wrists", { px: 12, py: -47, angle: 35, plane: 0.45 }, "in"],
        [0, "Contact", { px: 10, py: -43, angle: -24, plane: 0.28, batFace: 0.9, shoulderTurn: 18 }],
        [0.065, "Turn the face", { px: 5, py: -44, angle: -45, plane: 0.08, batFace: 0.5, shoulderTurn: 8 }, "out"],
        [0.2, "Finish", { px: 1, py: -45, angle: -55, batFace: 0.4 }],
        [
          0.39,
          "Recover",
          { px: 11, py: -43, angle: -7, plane: 0.4, frontFootX: 8, frontFootY: -10, backFootX: -9, backFootY: -1 },
        ],
        [0.63, "Ready", stance()],
      ],
      { group: backFoot ? "Back-foot shots" : "Front-foot drives" },
    ));
  }
  glance("legGlance", "Leg glance");
  glance("backFootLegGlance", "Back-foot leg glance", true);

  out.clipOffPads = clip(
    "Clip off the pads",
    0.085,
    { front: [-0.12, 0.24], back: [-0.12, 0.24] },
    [
      [-0.28, "Stance", stance()],
      [
        -0.18,
        "Small stride",
        {
          frontFootX: 10,
          frontFootY: -12,
          frontLift: 2,
          pelvisX: 1,
          chestX: 4,
          headX: 6,
          px: 14,
          py: -49,
          angle: 58,
          hipTurn: 25,
          shoulderTurn: 28,
        },
      ],
      [-0.12, "Plant", { frontLift: 0 }],
      [-0.085, "Load", { px: 14, py: -50, angle: 65, plane: 0.35 }, "in"],
      [0, "Contact", { px: 11, py: -42, angle: -22, plane: 0.25, batFace: 1, chestX: 5, headX: 7, shoulderTurn: 14 }],
      [0.07, "Roll through", { px: 2, py: -47, angle: -61, plane: 0, batFace: 0.65, hipTurn: 12, shoulderTurn: -8 }, "out"],
      [0.24, "Finish", { px: -5, py: -49, angle: -78, batFace: 0.35 }],
      [
        0.43,
        "Recover",
        { px: 10, py: -46, angle: -17, plane: 0.4, frontFootX: 8, frontFootY: -10, hipTurn: 25, shoulderTurn: 22 },
      ],
      [0.69, "Ready", stance()],
    ],
    { group: "Front-foot drives" },
  );

  out.backFootDefence = clip(
    "Back-foot defence",
    0.12,
    { front: [-0.07, 0.17], back: [-0.07, 0.17] },
    [
      [-0.25, "Stance", stance()],
      [
        -0.15,
        "Move back",
        {
          backFootX: -11,
          backFootY: 0,
          backLift: 1.5,
          frontFootX: 5,
          frontFootY: -7,
          pelvisX: -3,
          pelvisY: -43,
          chestX: 0,
          chestY: -72,
          headX: 1,
          headY: -85,
          px: 12,
          py: -46,
          angle: 20,
        },
      ],
      [-0.07, "Plant", { backLift: 0, px: 12, py: -44, angle: 7 }],
      [0, "Contact", { px: 12, py: -44, angle: 3, plane: 0.82, batFace: 1 }],
      [0.07, "Absorb", { px: 11, py: -44, angle: 0 }, "out"],
      [0.17, "Hold", {}],
      [
        0.36,
        "Recover",
        {
          backFootX: -9,
          backFootY: -1,
          frontFootX: 6,
          frontFootY: -9,
          backLift: 1,
          pelvisX: -1,
          chestX: 2,
          headX: 3,
          px: 12,
          py: -44,
          angle: 9,
        },
      ],
      [0.57, "Ready", stance()],
    ],
    { group: "Defence and leave", kind: "defence" },
  );

  out.leave = clip(
    "Leave",
    0,
    { front: [-0.28, 0.65], back: [-0.28, 0.65] },
    [
      [-0.28, "Stance", stance()],
      [-0.22, "Watch", { px: 11, py: -46, angle: 34, chestX: 2, headX: 3 }],
      [-0.1, "Lift away", { px: 6, py: -71, angle: 132, chestX: 0, headX: 1, shoulderTurn: 28 }],
      [0, "Ball passage", { px: 3, py: -85, angle: 169, plane: 0.74, batFace: 0.5, chestX: -1, headX: 0 }],
      [0.17, "Watch through", {}],
      [0.4, "Lower the bat", { px: 11, py: -56, angle: 92, plane: 0.7, batFace: 0.7, chestX: 1, headX: 2 }],
      [0.65, "Ready", stance()],
    ],
    { group: "Defence and leave", kind: "leave", event: "passage" },
  );
  return out;
}
