import { drawSprite, drawFace, LAYER } from "./venue-raster.js";
import { V, face, wall, slope, frame, box, pitchedRoof } from "./venue-geometry.js";
import { polar } from "./venue-map.js";
import {
  PAL,
  hash,
  flat,
  weatherboard,
  brick,
  iron,
  windowed,
  clockFace,
  darker,
  bands,
  white,
  trim,
  post,
} from "./venue-materials.js";
import { personSprite } from "./venue-sprites.js";

/**
 * The pavilion (venue-parts.js): two storeys of white weatherboard on a brick plinth, a verandah with the
 * members' balcony over it and a roof over that, a pitched iron roof with chimneys, and the clock gable
 * in the middle with a flagpole on top. { bearing, radius, width, depth }, facing the middle.
 */

const front = (bearing) => (bearing + 180) % 360;

export function pavilion(pic, p) {
  const c = polar(p.bearing, p.radius);
  const facing = front(p.bearing);
  const { width: w, depth: d } = p;
  const f = frame(c, facing);
  const L = LAYER.buildings;
  const ground = 3.5;
  const upper = 6.6;
  const doors = [
    [w / 2 - 1.4, w / 2 + 1.4],
    [w * 0.2, w * 0.2 + 1.2],
    [w * 0.8 - 1.2, w * 0.8],
  ];
  const facade = bands([
    [0.9, brick()],
    [ground, darker(windowed(weatherboard(), { storeys: [[1.3, 2.9]], spacing: 3.2, width: 1.3, length: w, doors }), 0.74)],
    [upper, darker(windowed(weatherboard(), { storeys: [[4.2, 5.9]], spacing: 3.2, width: 1.3, length: w }), 0.82)],
  ]);
  const plain = windowed(weatherboard(), {
    storeys: [
      [1.3, 2.9],
      [4.2, 5.9],
    ],
    spacing: 3.4,
    width: 1.2,
    length: d,
  });
  box(
    pic,
    c,
    facing,
    w,
    d,
    0,
    upper,
    {
      front: facade,
      sides: plain,
      back: windowed(weatherboard(), {
        storeys: [
          [1.3, 2.9],
          [4.2, 5.9],
        ],
        length: w,
      }),
    },
    L,
  );
  pitchedRoof(pic, c, facing, w, d, upper, upper + 2.6, iron(), weatherboard(), L, 0.6);
  // The verandah below and balcony above it: a roof on posts, a white rail, another roof over that.
  const out = 2.8;
  const FL = f.point(-w / 2, -out);
  const FR = f.point(w / 2, -out);
  const into = { x: -f.front.x * out, z: -f.front.z * out };
  slope(pic, FL, FR, ground - 0.15, into, ground, flat(PAL.whiteLine, 4, 8), L);
  wall(pic, FL, FR, ground - 0.45, ground - 0.15, white, L);
  for (let k = 0; k <= Math.round(w / 3.6); k++) {
    const across = -w / 2 + (k * w) / Math.round(w / 3.6);
    box(pic, f.point(across, -out + 0.08), facing, 0.16, 0.16, 0, upper - 0.3, { front: post, sides: post }, L);
  }
  wall(pic, f.point(-w / 2, -out + 0.1), f.point(w / 2, -out + 0.1), ground, ground + 1.0, balustrade(), L, { twoSided: true });
  slope(pic, FL, FR, upper - 0.35, into, upper, iron(PAL.roofLight, PAL.roof, PAL.roofLight), L);
  wall(pic, FL, FR, upper - 0.65, upper - 0.35, trim, L);
  // Members on the balcony.
  for (let k = 0; k < Math.round(w * 0.7); k++) {
    if (hash(k, 3, 41) < 0.35) continue;
    const at = f.point(-w / 2 + 0.6 + hash(k, 1, 41) * (w - 1.2), -out * (0.35 + hash(k, 2, 41) * 0.4));
    drawSprite(pic, V(at.x, ground, at.z), () => personSprite(400 + k, true), LAYER.crowd, 0, 2);
  }
  // The clock gable over the middle, with its own roof back to the ridge and a flagpole on top.
  const gw = 12;
  const peak = upper + 3.6;
  const g0 = f.point(-gw / 2, -0.15);
  const g1 = f.point(gw / 2, -0.15);
  const gm = f.point(0, -0.15);
  const gable = (u, v, ppm, x, y) => {
    const clock = clockFace(gw / 2, 1.85, 0.85)(u, v, ppm);
    if (clock) return clock;
    return v < 0.5 / ppm + 0.12 || Math.abs(v - (1 - Math.abs(u - gw / 2) / (gw / 2)) * 3.6) < 0.2
      ? PAL.trim
      : weatherboard()(u, v, ppm, x, y);
  };
  drawFace(
    pic,
    face([V(g0.x, upper, g0.z), V(g1.x, upper, g1.z), V(gm.x, peak, gm.z)], gable, L, { outward: V(f.front.x, 0, f.front.z) }),
  );
  const back = { x: -f.front.x * 5.5, z: -f.front.z * 5.5 };
  const ridge = (gp) => ({ x: gp.x + back.x, z: gp.z + back.z });
  drawFace(
    pic,
    face(
      [V(g0.x, upper, g0.z), V(gm.x, peak, gm.z), V(ridge(gm).x, peak, ridge(gm).z), V(ridge(g0).x, upper, ridge(g0).z)],
      iron(),
      L,
      { outward: V(-f.right.x, 1, -f.right.z) },
    ),
  );
  drawFace(
    pic,
    face(
      [V(gm.x, peak, gm.z), V(g1.x, upper, g1.z), V(ridge(g1).x, upper, ridge(g1).z), V(ridge(gm).x, peak, ridge(gm).z)],
      iron(),
      L,
      { outward: V(f.right.x, 1, f.right.z) },
    ),
  );
  flagpole(pic, V(gm.x - f.front.x * 0.6, peak, gm.z - f.front.z * 0.6), 4.2, f);
  // Chimneys either end of the ridge.
  for (const across of [-w * 0.32, w * 0.32])
    box(
      pic,
      f.point(across, d / 2 - 0.5),
      facing,
      1,
      1,
      upper + 1.5,
      upper + 3.8,
      { front: brick(), sides: brick(), back: brick(), top: flat(PAL.shadowIn) },
      L,
    );
}

/** White balusters between a top and bottom rail, gaps between them. */
function balustrade() {
  return (u, v, ppm) => {
    if (v > 0.86 || v < 0.1) return v > 0.86 ? PAL.white : PAL.whiteLine;
    const px = 0.14 * ppm;
    const on = px >= 3 ? u % 0.14 < 0.06 : Math.floor(u * ppm) % 2 === 0;
    return on ? PAL.white : null;
  };
}

export function flagpole(pic, base, height, f) {
  const L = LAYER.buildings;
  const top = V(base.x, base.y + height, base.z);
  box(pic, { x: base.x, z: base.z }, 0, 0.12, 0.12, base.y, top.y, { front: post, sides: post, back: post }, L);
  // The flag: hung square to the ground's long axis, so both cameras see it (a spot for wind later).
  const a = { x: base.x + f.right.x * 0.06, z: base.z + f.right.z * 0.06 };
  const b = { x: a.x + f.right.x * 2.2, z: a.z + f.right.z * 2.2 };
  wall(pic, a, b, top.y - 1.4, top.y - 0.1, (u, v) => (v > 0.45 && v < 0.85 && u < 0.9 ? PAL.frame : PAL.trim), L, {
    twoSided: true,
  });
}
