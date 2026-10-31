import { BOOT_TOE, HEEL_ANKLE_RISE } from "./batter-skeleton.js";
import { add3, mul3 } from "./rig-3d.js";

function ring(center, yaw, width, depth) {
  const across = { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) };
  const normal = { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, z]) =>
    add3(center, add3(mul3(across, width * x), mul3(normal, depth * z))),
  );
}

function shell(upper, lower) {
  return [
    ...[0, 1, 2, 3].map((i) => ({
      kind: i % 2 ? "side" : "main",
      points: [upper[i], lower[i], lower[(i + 1) % 4], upper[(i + 1) % 4]],
    })),
    { kind: "top", points: upper },
  ];
}

function boot(ankle, yaw, heel) {
  const axis = { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) };
  const side = { x: -axis.z, y: 0, z: axis.x };
  const base = ankle.y - 3 - heel * HEEL_ANKLE_RISE;
  const sole = [[BOOT_TOE, 2.6], [BOOT_TOE, -2.6], [-5, -3], [-5, 3]].map(([along, across]) => ({
    ...add3(ankle, add3(mul3(axis, along), mul3(side, across))),
    y: base + (along < 0 ? heel : 0),
  }));
  const upper = sole.map((p, i) => ({ ...p, y: p.y + (i < 2 ? 2.5 : 3.5) }));
  return [...shell(upper, sole), { kind: "sole", points: sole }];
}

/** Cloth panels and boots follow the same XYZ hip, shoulder and foot rotations as the bones. */
export function batterSurfaces(skeleton, front = false) {
  const { pelvis, chest, hipTurn, shoulderTurn } = skeleton;
  const shirtTop = ring(add3(chest, { x: 0, y: 1, z: 0 }), shoulderTurn, 10, 3.8);
  const waistCenter = add3(pelvis, { x: 0, y: 6, z: 0 });
  const waist = ring(waistCenter, hipTurn, 7, 3.5);
  const hipsBottom = ring(add3(pelvis, { x: 0, y: -4, z: 0 }), hipTurn, 7.5, 3.8);
  const backPoint = (center, yaw, depth) => add3(center, { x: Math.sin(yaw) * depth, y: 0, z: -Math.cos(yaw) * depth });
  return {
    shirt: shell(shirtTop, waist),
    hips: shell(waist, hipsBottom),
    frontBoot: boot(skeleton.frontFoot, skeleton.frontToeYaw, skeleton.frontHeel),
    backBoot: boot(skeleton.backFoot, skeleton.backToeYaw, skeleton.backHeel),
    seam: [
      backPoint(add3(chest, { x: 0, y: -4, z: 0 }), shoulderTurn, front ? -3.9 : 3.9),
      backPoint(waistCenter, hipTurn, front ? -3.6 : 3.6),
    ],
    number: backPoint(add3(chest, { x: 0, y: -6, z: 0 }), shoulderTurn, 4),
  };
}

export function drawCloth(panels, colour, shade, poly) {
  for (const panel of panels) poly(panel.points, panel.kind === "side" ? shade : colour);
}

export function drawBoot(panels, poly) {
  for (const panel of panels) poly(panel.points, panel.kind === "sole" ? "#d8d7cd" : panel.kind === "side" ? "#252c29" : "#3a3a3a");
}
