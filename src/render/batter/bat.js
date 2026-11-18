import { BAT_FACE, BAT_EDGE } from "../kit.js";

const WILLOW = {
  face: BAT_FACE,
  back: "#d8b97c",
  edge: BAT_EDGE,
  toe: "#a17b45",
  shoulder: "#b8955a",
};

/** A power swing's glow: the blade's faces red-hot, and a red halo round it (`glow` 0..1). */
const HOT = { face: "#ff5a3c", back: "#e8432c", edge: "#c2301f", toe: "#a82418", shoulder: "#d23a24" };
const HALO = "rgba(255,52,32,0.55)";

/** Draw the projected faces of the rigid 3D blade, farthest first, on the pixel grid. */
export function drawBat({ bat }, poly, line, grip = "#2b2b33", glow = 0) {
  line(bat.grip[0], bat.grip[1], 2, grip);
  const hot = glow > 0.5;
  if (glow > 0)
    for (const face of bat.faces)
      face.points.forEach((p, i) => line(p, face.points[(i + 1) % face.points.length], 1 + 2 * glow, HALO));
  for (const face of bat.faces) poly(face.points, (hot ? HOT : WILLOW)[face.kind]);
  if (bat.grainVisible) line(bat.grain[0], bat.grain[1], 0.5, "#cdb079");
}
