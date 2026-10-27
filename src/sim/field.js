import { MID_PITCH, BOUNDARY, fromBearing, bearingOf } from "./geometry.js";

const spot = (name, bearing, dist) => ({ name, bearing, dist });

// Nine outfielders per preset (the keeper and bowler are added separately).
const PRESETS = {
  attacking: [
    spot("first slip", 173, 15.2),
    spot("second slip", 168, 15.2),
    spot("third slip", 163, 14.8),
    spot("gully", 128, 12),
    spot("point", 92, 22),
    spot("cover", 58, 27),
    spot("mid-off", 12, 28),
    spot("mid-on", -14, 28),
    spot("fine leg", -160, 55),
  ],
  balanced: [
    spot("first slip", 173, 15.2),
    spot("second slip", 168, 15.2),
    spot("gully", 128, 12),
    spot("point", 92, 23),
    spot("cover", 58, 27),
    spot("mid-off", 12, 28),
    spot("mid-on", -14, 28),
    spot("square leg", -95, 27),
    spot("fine leg", -160, 55),
  ],
  defensive: [
    spot("first slip", 173, 15.2),
    spot("point", 95, 24),
    spot("deep cover", 52, 60),
    spot("mid-off", 12, 27),
    spot("long-on", -8, 62),
    spot("mid-on", -18, 27),
    spot("deep midwicket", -58, 60),
    spot("deep square leg", -100, 58),
    spot("third man", 148, 58),
  ],
  spin: [
    spot("slip", 172, 3.2),
    spot("short leg", -95, 5.5),
    spot("point", 95, 22),
    spot("cover", 50, 26),
    spot("mid-off", 10, 27),
    spot("mid-on", -12, 27),
    spot("midwicket", -55, 28),
    spot("deep square leg", -98, 58),
    spot("long-on", -6, 62),
  ],
  // Short-ball trap: catchers for the top-edged hook and the fend.
  bouncer: [
    spot("first slip", 172, 15.2),
    spot("cover", 58, 27),
    spot("point", 92, 23),
    spot("mid-off", 12, 28),
    spot("short leg", -95, 5.5),
    spot("leg gully", -140, 11),
    spot("deep square leg", -95, 60),
    spot("deep fine leg", -155, 60),
    spot("mid-on", -14, 28),
  ],
  // Slips plus a leg slip for the ball that's set up to come back in.
  legSlip: [
    spot("first slip", 173, 15.2),
    spot("second slip", 168, 15.2),
    spot("gully", 128, 12),
    spot("cover", 58, 27),
    spot("mid-off", 12, 28),
    spot("mid-on", -14, 28),
    spot("short leg", -95, 5.5),
    spot("leg slip", -172, 14),
    spot("fine leg", -160, 55),
  ],
  // Everyone on the ring saving singles, to strangle the scoring.
  ring: [
    spot("first slip", 173, 15.2),
    spot("point", 92, 21),
    spot("cover", 58, 22),
    spot("extra cover", 35, 23),
    spot("mid-off", 12, 23),
    spot("mid-on", -14, 23),
    spot("midwicket", -55, 22),
    spot("square leg", -95, 21),
    spot("fine leg", -160, 30),
  ],
};

export const PRESET_ORDER = ["attacking", "balanced", "defensive", "spin", "bouncer", "legSlip", "ring"];
export const PRESET_LABELS = {
  attacking: "ATTACKING",
  balanced: "BALANCED",
  defensive: "DEFENSIVE",
  spin: "SPIN",
  bouncer: "BOUNCER TRAP",
  legSlip: "LEG SLIP TRAP",
  ring: "RING FIELD",
};

export function presetPlacements(preset) {
  return PRESETS[preset].map((s) => ({ name: s.name, pos: fromBearing(s.bearing, s.dist) }));
}

/** Conventional fielding position name for a point on the ground. */
export function positionName(pos) {
  const bearing = bearingOf(pos.x, pos.z);
  const fromStumps = Math.hypot(pos.x, pos.z);
  const deep = Math.hypot(pos.x, pos.z - MID_PITCH) > BOUNDARY * 0.62;
  const close = fromStumps < 9;
  const angle = Math.abs(bearing);
  const off = bearing >= 0;
  if (angle > 150) {
    if (deep) return off ? "third man" : "fine leg";
    if (off) return fromStumps < 20 ? "slip" : "third man";
    return close ? "leg slip" : "fine leg";
  }
  if (angle > 112) {
    if (off) return deep ? "third man" : "gully";
    return deep ? "deep fine leg" : "backward square";
  }
  if (angle > 72) {
    if (off) return deep ? "deep point" : close ? "silly point" : "point";
    return deep ? "deep square leg" : close ? "short leg" : "square leg";
  }
  if (angle > 30) {
    if (off) return deep ? "deep cover" : "cover";
    return deep ? "deep midwicket" : "midwicket";
  }
  if (off) return deep ? "long-off" : "mid-off";
  return deep ? "long-on" : "mid-on";
}

/** Where the wicketkeeper stands: up to the stumps for spin, back for pace. */
export function keeperSpot(spinner) {
  return spinner ? { x: 0.3, z: -0.9 } : { x: 0.3, z: -14 };
}

/** Keep a dragged fielder inside the boundary and off the pitch. */
export function clampFieldPosition(pos) {
  const dx = pos.x;
  const dz = pos.z - MID_PITCH;
  const dist = Math.hypot(dx, dz);
  const max = 64;
  let p = { ...pos };
  if (dist > max) p = { x: (dx / dist) * max, z: MID_PITCH + (dz / dist) * max };
  if (Math.abs(p.x) < 1.8 && p.z > 2 && p.z < 18) p.x = p.x < 0 ? -1.8 : 1.8;
  return p;
}
