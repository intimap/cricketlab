import { BAT_FACE, BAT_EDGE } from "./kit.js";

const WILLOW = {
  face: BAT_FACE,
  back: "#d8b97c",
  edge: BAT_EDGE,
  toe: "#a17b45",
  shoulder: "#b8955a",
};

/** Draw the projected faces of the rigid 3D blade, farthest first, on the pixel grid. */
export function drawBat({ bat }, poly, line) {
  line(bat.grip[0], bat.grip[1], 2, "#2b2b33");
  for (const face of bat.faces) poly(face.points, WILLOW[face.kind]);
  if (bat.grainVisible) line(bat.grain[0], bat.grain[1], 0.5, "#cdb079");
}
