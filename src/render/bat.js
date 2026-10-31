import { BAT_FACE, BAT_EDGE } from "./kit.js";

const GRIP = "#2b2b33";
const EDGE_SHADE = "#886338";
const TOE = "#a17b45";
const GRAIN = "#cdb079";

/** A willow blade with separate face, edge and toe planes in the rig's local pixels. */
export function drawBat({ topHand, dir, near = 0, face = 1 }, poly, line) {
  const along = (distance) => ({ x: topHand.x + dir.x * distance, y: topHand.y + dir.y * distance });
  const shoulder = along(9);
  const toe = along(36);
  const length = Math.hypot(dir.x, dir.y) || 1;
  const axis = { x: dir.x / length, y: dir.y / length };
  const side = { x: -axis.y, y: axis.x };
  const visibleFace = Math.max(0, Math.min(1, Math.abs(face)));
  const edgeOn = Math.sqrt(1 - visibleFace * visibleFace);
  // The edge gets broader as the face turns away. Depth along the blade
  // reveals the toe when it points back towards the camera.
  const depth = 0.8 + 1.8 * edgeOn;
  const offset = {
    x: -side.x * depth + axis.x * near * 1.8,
    y: -side.y * depth + axis.y * near * 1.8,
  };
  const vertex = (center, width, edge, back = false) => ({
    x: center.x + side.x * width * edge + offset.x * (back ? 0.5 : -0.5),
    y: center.y + side.y * width * edge + offset.y * (back ? 0.5 : -0.5),
  });
  const shoulderWidth = 2.7 * visibleFace;
  const toeWidth = 3 * (1 + 0.45 * near) * visibleFace;
  const corners = (back = false, inset = 0) => [
    vertex(shoulder, Math.max(0, shoulderWidth - inset), 1, back),
    vertex(toe, Math.max(0, toeWidth - inset), 1, back),
    vertex(toe, Math.max(0, toeWidth - inset), -1, back),
    vertex(shoulder, Math.max(0, shoulderWidth - inset), -1, back),
  ];
  const front = corners();
  const back = corners(true);

  line(along(-2), shoulder, 2, GRIP);
  // Rear silhouette first, then the long edge and the squared-off end grain.
  poly(back, EDGE_SHADE);
  poly([front[3], front[2], back[2], back[3]], BAT_EDGE);
  poly([front[1], front[2], back[2], back[1]], TOE);
  poly(front, BAT_EDGE);
  if (visibleFace > 0.08) poly(corners(false, 0.35), BAT_FACE);

  // A fine bevel separates the bright face from the solid side wall.
  line(front[3], front[2], 0.65, GRAIN);
  if (visibleFace > 0.55) {
    const grainPoint = (t) => ({
      x: shoulder.x + (toe.x - shoulder.x) * t + side.x * visibleFace * 0.7 - offset.x * 0.5,
      y: shoulder.y + (toe.y - shoulder.y) * t + side.y * visibleFace * 0.7 - offset.y * 0.5,
    });
    line(grainPoint(0.18), grainPoint(0.87), 0.5, GRAIN);
  }
}
