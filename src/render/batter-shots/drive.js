// Authored poses on the current Cricket Lab rig.
export function extendDriveShots({ clip, stance, clips }) {
  const out = {};
  const weight = (phase) => (phase === "Load" ? 0.3 : phase === "Stride" ? 0.65 : phase === "Recover" ? 0.4 : 1);
  function drive(id, name, offsets, contacts, finish) {
    const source = clips.straightDrive;
    const frames = source.frames.map((f, i) => {
      if (i === 0 || i === source.frames.length - 1) return [f.time, f.phase, stance(), f.ease];
      const pose = { ...f.pose };
      const w = weight(f.phase);
      for (const [key, delta] of Object.entries(offsets)) pose[key] += delta * w;
      if (f.time === 0) Object.assign(pose, contacts);
      if (f.phase === "Finish" || f.phase === "Hold") Object.assign(pose, finish);
      return [f.time, f.phase, pose, f.ease];
    });
    return (out[id] = clip(name, source.downswing, source.plant, frames, { group: "Front-foot drives" }));
  }
  drive(
    "offDrive",
    "Off drive",
    { frontFootX: 2, chestX: 1, headX: 1, px: 2, py: -1, shoulderTurn: 5 },
    { px: 21, py: -45, angle: 5, plane: 0.7, batFace: 1 },
    { px: 5, py: -78, angle: -158, plane: 0.65, batFace: 0.4 },
  );
  drive(
    "coverDrive",
    "Cover drive",
    { frontFootX: 4, chestX: 3, headX: 2, px: 4, py: -2, shoulderTurn: 8 },
    { px: 24, py: -46, angle: 14, plane: 0.35, batFace: 1 },
    { px: 10, py: -77, angle: -145, plane: 0.45, batFace: 0.42 },
  );
  drive(
    "squareDrive",
    "Square drive",
    { frontFootX: 5, chestX: 4, headX: 4, px: 6, py: -3, shoulderTurn: 16 },
    { px: 26, py: -49, angle: 32, plane: 0.08, batFace: 1, chestX: 14 },
    { px: 18, py: -66, angle: 108, plane: 0.08, batFace: 0.5 },
  );
  drive(
    "onDrive",
    "On drive",
    { frontFootX: -5, chestX: -4, headX: -4, px: -4, shoulderTurn: -8 },
    { px: 12, py: -43, angle: -6, plane: 0.72, batFace: 1 },
    { px: -7, py: -76, angle: -158, plane: 0.65, batFace: 0.38 },
  );

  function loft(id, sourceId, name, finish) {
    const source = out[sourceId] ?? clips[sourceId];
    const frames = source.frames.map((f, i) => {
      if (i === 0) return [f.time - 0.03, f.phase, stance(), f.ease];
      if (i === source.frames.length - 1) return [1.05, "Ready", stance(), f.ease];
      const pose = { ...f.pose };
      let time = f.time;
      if (time < 0) time *= 0.1 / source.downswing;
      if (f.phase === "Load" || f.phase === "Stride" || f.time === -source.downswing) {
        pose.py -= 3;
        pose.angle += 14;
        pose.bowlerGripLift = -4;
      }
      if (f.time === 0) {
        pose.batFace = 1;
        pose.angle -= 5;
      }
      if (f.phase === "Extension") {
        time = 0.085;
        pose.py -= 4;
      }
      if (f.phase === "Finish") {
        time = 0.31;
        Object.assign(pose, finish);
      }
      if (f.phase === "Hold") {
        time = 0.48;
        Object.assign(pose, finish);
      }
      if (f.phase === "Recover") time = 0.72;
      return [time, f.phase, pose, f.ease];
    });
    return (out[id] = clip(name, 0.1, { front: [-0.065, 0.48], back: [frames[0][0], 0.48] }, frames, { group: "Lofted shots" }));
  }
  loft("loftedStraightDrive", "straightDrive", "Lofted straight drive", {
    px: 1,
    py: -82,
    angle: -177,
    plane: 0.74,
    batFace: 0.38,
  });
  loft("loftedOffDrive", "offDrive", "Lofted off drive", { px: 5, py: -81, angle: -165, plane: 0.63, batFace: 0.42 });
  loft("loftedCoverDrive", "coverDrive", "Lofted cover drive", { px: 10, py: -80, angle: -148, plane: 0.36, batFace: 0.44 });
  loft("loftedOnDrive", "onDrive", "Lofted on drive", { px: -8, py: -80, angle: -156, plane: 0.48, batFace: 0.38 });
  loft("loftedSquareDrive", "squareDrive", "Lofted square drive", { px: 20, py: -76, angle: 128, plane: 0.08, batFace: 0.48 });

  out.slogMidwicket = clip(
    "Slog over midwicket",
    0.1,
    { front: [-0.12, 0.42], back: [-0.12, 0.42] },
    [
      [-0.35, "Stance", stance()],
      [
        -0.25,
        "Set the base",
        {
          frontFootX: 13,
          frontFootY: -12,
          frontLift: 3,
          backFootX: -10,
          backFootY: -1,
          pelvisX: 0,
          pelvisY: -43,
          chestX: 3,
          headX: 4,
          px: 17,
          py: -59,
          angle: 108,
          plane: 0.3,
          hipTurn: 25,
          shoulderTurn: 42,
        },
      ],
      [-0.12, "Plant", { frontLift: 0, px: 18, py: -63, angle: 133 }],
      [-0.1, "Coil", { hipTurn: 18, shoulderTurn: 36 }, "in"],
      [0, "Contact", { px: 14, py: -46, angle: -45, plane: 0, batFace: 1, hipTurn: -8, shoulderTurn: -20 }],
      [
        0.13,
        "Rotate through",
        { px: -8, py: -64, angle: -123, hipTurn: -24, shoulderTurn: -42, frontHeel: 2, backHeel: 2, batFace: 0.7 },
        "out",
      ],
      [0.29, "Finish", { px: -18, py: -78, angle: -155, plane: 0.15, batFace: 0.4, shoulderTurn: -48 }],
      [0.42, "Hold", {}],
      [0.6, "Unwind", { px: -7, py: -51, angle: -112, frontHeel: 0, backHeel: 0 }],
      [
        0.76,
        "Recover",
        {
          px: 11,
          py: -48,
          angle: -38,
          plane: 0.45,
          frontFootX: 9,
          frontFootY: -10,
          backFootX: -9,
          backFootY: -1,
          hipTurn: 20,
          shoulderTurn: 22,
        },
      ],
      [1.01, "Ready", stance()],
    ],
    { group: "Lofted shots" },
  );

  return out;
}
