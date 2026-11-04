/**
 * A small renderer for ground scenery: flat faces (walls, roofs, seating, banks) filled through a camera
 * (venue-cameras.js) with a depth test, each pixel coloured by its face's material at that spot, and
 * sprites (trees, people) at a point. It works on plain arrays, so the tools can run it without a browser.
 *
 * A picture keeps, per pixel: the colour in daylight, its depth, the surface's normal (for relighting),
 * which paintable layer it belongs to and a few flags (venue-light.js reads them).
 */

/** The layers a picture is split into, back to front, for painting over (venue-paint-over.js). */
export const LAYERS = ["sky", "trees", "ground", "buildings", "crowd", "fence", "field"];
export const LAYER = Object.fromEntries(LAYERS.map((name, i) => [name, i]));

/** Pixel flags: takes the buildings' and trees' shadows; a window (lit at night); a floodlight's lamp. */
export const FLAG = { shadowed: 1, window: 2, lamp: 4, field: 8 };

export function makePicture(cam) {
  const n = cam.w * cam.h;
  return {
    cam,
    w: cam.w,
    h: cam.h,
    rgba: new Uint8ClampedArray(n * 4),
    depth: new Float32Array(n).fill(Infinity),
    normal: new Int8Array(n * 3),
    layer: new Uint8Array(n),
    flags: new Uint8Array(n),
  };
}

/** Write one pixel if it's nearer than what's there. */
export function putPixel(pic, x, y, depth, colour, normal, layer, flags = 0) {
  if (x < 0 || y < 0 || x >= pic.w || y >= pic.h) return false;
  const i = y * pic.w + x;
  if (depth >= pic.depth[i]) return false;
  pic.depth[i] = depth;
  const j = i * 4;
  pic.rgba[j] = colour[0];
  pic.rgba[j + 1] = colour[1];
  pic.rgba[j + 2] = colour[2];
  pic.rgba[j + 3] = 255;
  pic.normal[i * 3] = normal.x * 127;
  pic.normal[i * 3 + 1] = normal.y * 127;
  pic.normal[i * 3 + 2] = normal.z * 127;
  pic.layer[i] = layer;
  pic.flags[i] = flags;
  return true;
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Clip a camera-space polygon to depth >= near (Sutherland-Hodgman against one plane). */
function clipNear(points, near) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const ina = a.z >= near;
    const inb = b.z >= near;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (near - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near });
    }
  }
  return out;
}

/**
 * Fill a flat convex face. face: { points (map), normal (unit, outward), origin, u, v (unit axes in its
 * plane: u along, v up), shade(u, v, ppm, x, y) -> [r, g, b, flags?, layer?] or null to leave a gap,
 * layer, flags, twoSided, bright (a shade on the whole face, 1 as it is) }. u and v reach the shader in metres from the origin; ppm is pixels per metre there.
 */
export function drawFace(pic, face) {
  const cam = pic.cam;
  const eye = cam.eye;
  if (!face.twoSided && dot(sub(eye, face.points[0]), face.normal) <= 0) return;
  const clipped = clipNear(
    face.points.map((p) => cam.toCamera(p)),
    cam.near,
  );
  if (clipped.length < 3) return;
  const screen = clipped.map((c) => ({ x: cam.cx + (cam.fx * c.x) / c.z, y: cam.cy - (cam.fy * c.y) / c.z }));
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of screen) {
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
  }
  const y0 = Math.max(0, Math.ceil(top - 0.5));
  const y1 = Math.min(pic.h - 1, Math.floor(bottom - 0.5));
  if (y0 > y1) return;
  // The face's plane against rays through each pixel: depth t = (n . (origin - eye)) / (n . ray).
  const n = face.normal;
  const reach = dot(n, sub(face.origin, eye));
  const facing = face.twoSided && dot(sub(eye, face.points[0]), n) < 0 ? { x: -n.x, y: -n.y, z: -n.z } : n;
  const { right: R, up: U, forward: F, fx, fy, cx: pcx, cy: pcy } = cam;
  const o = face.origin;
  const fu = face.u;
  const fv = face.v;
  // Each pixel's ray is R*a + U*b + F; along the normal that's a*nR + b*nU + nF.
  const nR = dot(n, R);
  const nU = dot(n, U);
  const nF = dot(n, F);
  const ex = eye.x - o.x;
  const ey = eye.y - o.y;
  const ez = eye.z - o.z;
  const depth = pic.depth;
  const shade = face.shade;
  const layer = face.layer;
  const flags = face.flags ?? 0;
  const k = face.bright ?? 1;
  const dimmed = [0, 0, 0, 0, 0];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    let left = Infinity;
    let right = -Infinity;
    for (let i = 0; i < screen.length; i++) {
      const a = screen[i];
      const b = screen[(i + 1) % screen.length];
      if ((a.y <= cy && b.y > cy) || (b.y <= cy && a.y > cy)) {
        const x = a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    const x0 = Math.max(0, Math.ceil(left - 0.5));
    const x1 = Math.min(pic.w - 1, Math.floor(right - 0.5));
    const bb = -(cy - pcy) / fy;
    const ubx = U.x * bb + F.x;
    const uby = U.y * bb + F.y;
    const ubz = U.z * bb + F.z;
    const alongRow = bb * nU + nF;
    for (let x = x0; x <= x1; x++) {
      const a = (x + 0.5 - pcx) / fx;
      const along = a * nR + alongRow;
      if (along < 1e-9 && along > -1e-9) continue;
      const t = reach / along;
      if (t < cam.near || t >= depth[y * pic.w + x]) continue;
      const px = ex + (R.x * a + ubx) * t;
      const py = ey + (R.y * a + uby) * t;
      const pz = ez + (R.z * a + ubz) * t;
      const colour = shade(px * fu.x + py * fu.y + pz * fu.z, px * fv.x + py * fv.y + pz * fv.z, fy / t, x, y);
      // A material can flag a pixel (a window) or move it to another layer (the crowd in a stand).
      if (!colour) continue;
      if (k !== 1) {
        dimmed[0] = colour[0] * k;
        dimmed[1] = colour[1] * k;
        dimmed[2] = colour[2] * k;
        putPixel(pic, x, y, t, dimmed, facing, colour[4] ?? layer, colour[3] ?? flags);
      } else putPixel(pic, x, y, t, colour, facing, colour[4] ?? layer, colour[3] ?? flags);
    }
  }
}

/**
 * A sprite standing at map point `at`: make() gives paint(put, x, y, ppm) (only made once the sprite is
 * known to be in the picture), which draws it round picture point (x, y), ppm
 * pixels to the metre there, through put(px, py, colour, lift = 0): lift (m) brings a pixel forward so a
 * tree's near side covers its own far side. The normal faces the camera, tipped up. `size` (m) is how far
 * it reaches across and up, so one wholly out of the picture is skipped.
 */
export function drawSprite(pic, at, make, layer, flags = 0, size = 3) {
  const p = pic.cam.project(at);
  if (!p) return;
  const ppm = pic.cam.fy / p.depth;
  // Skip it unless some of it (`size` m across and up) is in the picture.
  const reach = size * ppm;
  if (p.x + reach < 0 || p.x - reach >= pic.w || p.y + 2 < 0 || p.y - reach * 1.2 >= pic.h) return;
  const f = pic.cam.forward;
  const normal = { x: -f.x * 0.6, y: 0.8, z: -f.z * 0.6 };
  const put = (px, py, colour, lift = 0) =>
    putPixel(pic, Math.round(px), Math.round(py), p.depth - lift, colour, normal, layer, flags);
  /** Would a pixel here (whole px) at this lift show? So a painter can skip working out hidden ones. */
  put.shows = (px, py, lift = 0) => px >= 0 && py >= 0 && px < pic.w && py < pic.h && p.depth - lift < pic.depth[py * pic.w + px];
  make()(put, p.x, p.y, ppm);
}

/**
 * The ground under everything: for each pixel whose ray meets the ground (y = 0) and no nearer surface,
 * shade(x, z, footX, footZ, px, py, out) fills out with [r, g, b, flags, layer] and returns true, or
 * false to leave it. footX and footZ are how much ground (m) the pixel covers across and along, so lines
 * can be held to a pixel wide however far off. Only rows from `fromRow` down, or within `rect`.
 */
export function drawGround(pic, shade, fromRow = 0, rect = null) {
  const cam = pic.cam;
  const { eye, right: R, up: U, forward: F, fx, fy, cx } = cam;
  // The cameras here keep their right level (R.y = R.z = 0), so each row meets the ground at one depth.
  if (R.y !== 0 || R.z !== 0) throw new Error("drawGround needs a level camera");
  const out = [0, 0, 0, 0, 0];
  const normal = { x: 0, y: 1, z: 0 };
  const x0 = rect ? Math.max(0, rect.x0) : 0;
  const x1 = rect ? Math.min(pic.w - 1, rect.x1) : pic.w - 1;
  const ya = Math.max(fromRow, rect ? rect.y0 : 0);
  const yb = rect ? Math.min(pic.h - 1, rect.y1) : pic.h - 1;
  const depth = pic.depth;
  for (let y = ya; y <= yb; y++) {
    const b = -(y + 0.5 - cam.cy) / fy;
    const dy = U.y * b + F.y;
    if (dy >= -1e-9) continue;
    const t = -eye.y / dy;
    const gz = eye.z + (U.z * b + F.z) * t;
    const dx0 = U.x * b + F.x;
    // The ground the next row down covers, for how far one row reaches along the ground.
    const b2 = b - 1 / fy;
    const dy2 = U.y * b2 + F.y;
    const footZ = dy2 < -1e-9 ? Math.abs(eye.z + (U.z * b2 + F.z) * (-eye.y / dy2) - gz) : t;
    const footX = t / fx;
    const row = y * pic.w;
    for (let x = x0; x <= x1; x++) {
      if (t >= depth[row + x]) continue;
      const a = (x + 0.5 - cx) / fx;
      const gx = eye.x + (R.x * a + dx0) * t;
      if (!shade(gx, gz, footX, footZ, x, y, out)) continue;
      putPixel(pic, x, y, t, out, normal, out[4], out[3]);
    }
  }
}
