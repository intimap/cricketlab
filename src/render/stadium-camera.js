import { MID_PITCH, BOUNDARY } from "../sim/geometry.js";

// Measured inner parapet of the MCG composition (drawn at 640 x 360; the file is that size, flattened on the sky colour).
// Orthographic: a circular field projects to an ellipse; upright heights use
// the same pixels/metre and elevation, without stretching the pitch.
export const MCG_CAMERA = Object.freeze({ cx: 320, cy: 209, rx: 263, ry: 90 });

export function projectStadium(x, y, z, camera = MCG_CAMERA) {
  const scale = camera.rx / BOUNDARY;
  const elevation = Math.asin(camera.ry / camera.rx);
  return {
    x: camera.cx + x * scale,
    y: camera.cy + (MID_PITCH - z) * scale * Math.sin(elevation) - y * scale * Math.cos(elevation),
    s: 0.8,
  };
}

export function unprojectStadium(x, y, camera = MCG_CAMERA) {
  return { x: ((x - camera.cx) * BOUNDARY) / camera.rx, z: MID_PITCH - ((y - camera.cy) * BOUNDARY) / camera.ry };
}
