import { CLOSE_CAMERA } from "../camera.js";
import { MID_PITCH } from "../../sim/geometry.js";

/**
 * The cameras a map is drawn through, as pinholes in the map's frame (venue-map.js): an eye, which way it
 * looks and its focal lengths (px). Each can project a point to its picture and give the ray through a pixel.
 *
 * - The close camera is the game's own (render/camera.js), 3.2 m up and 8.53 m behind the near stumps,
 *   looking along the pitch at one end of the ground. Its scenery is drawn without the stumps' widening,
 *   which only matters within a few centimetres of the middle stump.
 * - The wide view is a TV camera far off and high behind the striker (about 1.1 km, 20 degrees down, a long
 *   lens), so the scale is nearly even across the ground. Its whole-ground frame is 640x360; pictures for
 *   zooming in are drawn at 2x or 3x the detail, over the whole frame or part of it.
 */

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const v3 = (x, y, z) => ({ x, y, z });
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/** A pinhole: `eye`, `forward` and `right` (unit, at right angles), focal lengths and principal point, picture size. */
export function pinhole({ eye, forward, right, fx, fy, cx, cy, w, h, near = 0.5 }) {
  const up = cross(forward, right);
  return {
    eye,
    forward,
    right,
    up,
    fx,
    fy,
    cx,
    cy,
    w,
    h,
    near,
    /** Camera-space point: across, up, depth. */
    toCamera(p) {
      const d = v3(p.x - eye.x, p.y - eye.y, p.z - eye.z);
      return v3(dot(d, right), dot(d, up), dot(d, forward));
    },
    /** Picture point (px) and depth for a map point, or null behind the camera. */
    project(p) {
      const c = this.toCamera(p);
      if (c.z < near) return null;
      return { x: cx + (fx * c.x) / c.z, y: cy - (fy * c.y) / c.z, depth: c.z };
    },
    /** The ray through picture point (px, py): its direction in the map, scaled so 1 along it is 1 m of depth. */
    ray(px, py) {
      const a = (px - cx) / fx;
      const b = -(py - cy) / fy;
      return v3(right.x * a + up.x * b + forward.x, right.y * a + up.y * b + forward.y, right.z * a + up.z * b + forward.z);
    },
  };
}

/** The close camera looking at end `far` of the map (0 or 1), in the background's own rows (drawn 24 px up). */
export function closeCamera(far) {
  const c = CLOSE_CAMERA;
  const height = c.depthGain / c.heightGain;
  const back = c.cameraZ + MID_PITCH;
  const s = far === 0 ? 1 : -1;
  return pinhole({
    eye: v3(0, height, -back * s),
    forward: v3(0, 0, s),
    right: v3(s, 0, 0),
    // Beyond the stumps the game's lateral mapping is 0.95 of its gain (camera.js warpLateral).
    fx: c.lateralGain * 0.95,
    fy: c.heightGain,
    cx: 320,
    cy: c.horizonY,
    w: 640,
    h: 360,
  });
}

/** The part of the whole-ground frame drawn at 3x for close zooms (px of the 640 x 360 frame). */
export const HI_REGION = Object.freeze({ x: 130, y: 104, w: 380, h: 192 });

/** The TV camera: distance (m) from the middle of the ground, how far it looks down, and its focal length (px). */
export const TV = Object.freeze({ distance: 1100, down: 20, focal: 3750, cx: 320, cy: 194 });

/** The TV camera's eye and axes in the world (behind the striker, looking towards the bowler's end). */
function tvAxes() {
  const a = (TV.down * Math.PI) / 180;
  return {
    eye: v3(0, TV.distance * Math.sin(a), MID_PITCH - TV.distance * Math.cos(a)),
    forward: v3(0, -Math.sin(a), Math.cos(a)),
    right: v3(1, 0, 0),
  };
}

/**
 * The TV camera in the map for the bowler bowling from `end`, drawing `region` of the whole-ground frame
 * ({ x, y, w, h } in its px) at `scale` times the detail.
 */
export function tvCamera(end, scale = 1, region = { x: 0, y: 0, w: 640, h: 360 }) {
  const { eye, forward, right } = tvAxes();
  // The world turned round for end 1 (venue-map.js mapToWorld): x and z both flip, about the middle.
  const turn = (p, point) =>
    end === 0 ? v3(p.x, p.y, point ? p.z - MID_PITCH : p.z) : v3(-p.x, p.y, point ? MID_PITCH - p.z : -p.z);
  return pinhole({
    eye: turn(eye, true),
    forward: turn(forward, false),
    right: turn(right, false),
    fx: TV.focal * scale,
    fy: TV.focal * scale,
    cx: (TV.cx - region.x) * scale,
    cy: (TV.cy - region.y) * scale,
    w: Math.round(region.w * scale),
    h: Math.round(region.h * scale),
    near: 10,
  });
}

/**
 * The TV camera for the game's wide view (render/camera.js setWideCamera): world points to the
 * whole-ground frame and back. `s` scales the small figures: 1 is about 1.7 px a metre of height.
 */
export function tvWideCamera() {
  const { eye, forward, right } = tvAxes();
  const cam = pinhole({ eye, forward, right, fx: TV.focal, fy: TV.focal, cx: TV.cx, cy: TV.cy, w: 640, h: 360, near: 10 });
  return {
    tv: true,
    project(x, y, z) {
      const p = cam.project(v3(x, y, z));
      if (!p) return { x: TV.cx, y: -999, s: 0 };
      // A 1.8 m figure is 8 px x 1.45 x s tall (render/tiny-figures.js), so s from his true height on screen.
      const ppm = (TV.focal / p.depth) * Math.cos((TV.down * Math.PI) / 180);
      return { x: p.x, y: p.y, s: (1.8 * ppm) / 11.6 };
    },
    unproject(sx, sy) {
      const d = cam.ray(sx, sy);
      const t = d.y < -1e-9 ? -eye.y / d.y : 1e6;
      return { x: eye.x + d.x * t, z: eye.z + d.z * t };
    },
  };
}
