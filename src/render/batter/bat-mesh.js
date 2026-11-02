import { add3, mul3, cross3, unit3 } from "./rig-3d.js";

/** A rigid willow prism carried by the solved hands, in the skeleton's XYZ coordinates. */
export function batMesh(skeleton) {
  const { topHand, batDir, angle, azimuth, face } = skeleton;
  const c = Math.cos(azimuth), s = Math.sin(azimuth), a = Math.cos(angle);
  // Transport the blade's width through the same rotation as its long axis.
  const baseWidth = unit3({ x: s * s + c * c * a, y: c * Math.sin(angle), z: s * c * (1 - a) });
  const baseNormal = unit3(cross3(batDir, baseWidth));
  const roll = Math.acos(Math.max(-1, Math.min(1, face)));
  const width = unit3(add3(mul3(baseWidth, Math.cos(roll)), mul3(baseNormal, Math.sin(roll))));
  const normal = unit3(cross3(batDir, width));
  const along = (t) => add3(topHand, mul3(batDir, t));
  const ring = (distance, halfWidth, halfDepth) => {
    const center = along(distance);
    return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([w, d]) =>
      add3(center, add3(mul3(width, halfWidth * w), mul3(normal, halfDepth * d))),
    );
  };
  const shoulder = ring(9, 2.7, 0.55);
  const toe = ring(36, 3, 1.05);
  const faces = [
    { kind: "face", points: [shoulder[0], toe[0], toe[1], shoulder[1]] },
    { kind: "back", points: [shoulder[3], shoulder[2], toe[2], toe[3]] },
    { kind: "edge", points: [shoulder[0], shoulder[3], toe[3], toe[0]] },
    { kind: "edge", points: [shoulder[1], toe[1], toe[2], shoulder[2]] },
    { kind: "toe", points: toe },
    { kind: "shoulder", points: shoulder },
  ];
  const grain = [0.2, 0.86].map((t) => {
    const distance = 9 + 27 * t;
    return add3(along(distance), add3(mul3(width, 0.65), mul3(normal, 0.55 + 0.5 * t)));
  });
  return { faces, grip: [along(-2), along(9)], grain, normal };
}
