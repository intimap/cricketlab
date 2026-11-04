import { MID_PITCH } from "../../sim/geometry.js";

/**
 * A ground as a map: everything round the field placed in metres, so every view draws the same place.
 *
 * The map's frame is fixed to the ground: its centre is the middle of the pitch, `z` points to end 0 (for
 * Parklands the pavilion end), `x` to the right looking that way, `y` up. Bearings go round from end 0
 * (0) through the right-hand side (90) to end 1 (180). The game's world turns with the bowling: end 0 is
 * the bowler's end in even overs (the world's `z` points at it), end 1 in odd overs (turned round).
 *
 * A map is plain data (render/venue/parklands-map.js), drawn by the parts kit (venue-parts.js):
 *   name, ends            the ground's name and its two ends' names (end 0 first)
 *   boundary              the rope's radius (m), the sim's 66 m circle
 *   fence                 { radius, height }: the picket fence round the outfield
 *   grass                 { light, dark, stripe }: the outfield and its mowing stripes (m wide, across the pitch)
 *   parts                 [{ kind, ...}]: buildings, banks, trees, lights (see venue-parts.js for each kind)
 *   life                  spots kept for moving things later: flags, the scoreboard, the crowd's layer
 *   painted               { layerKey: { asset, fingerprint } }: layers painted over (venue-paint-over.js)
 */

/** The bowling end (0 or 1) for an over: end 0 starts each innings, as the commentary says. */
export const bowlingEndOf = (overNo) => overNo % 2;

/** Map point (x, z) to the world's (x, z) when the bowler bowls from `end`. */
export function mapToWorld(x, z, end) {
  return end === 0 ? { x, z: MID_PITCH + z } : { x: -x, z: MID_PITCH - z };
}

/** World point (x, z) to the map, when the bowler bowls from `end`. */
export function worldToMap(x, z, end) {
  return end === 0 ? { x, z: z - MID_PITCH } : { x: -x, z: MID_PITCH - z };
}

/** A direction (x, z) in the map turned into the world (or back: turning round is its own inverse). */
export const turnDirection = (x, z, end) => (end === 0 ? { x, z } : { x: -x, z: -z });

/** The map point at `bearing` degrees and `radius` metres from the centre. */
export function polar(bearing, radius) {
  const a = (bearing * Math.PI) / 180;
  return { x: Math.sin(a) * radius, z: Math.cos(a) * radius };
}

/** The bearing (degrees, 0..360) of map point (x, z). */
export function bearingOf(x, z) {
  return ((Math.atan2(x, z) * 180) / Math.PI + 360) % 360;
}

/** Is `bearing` within [from, to] going clockwise (wrapping through 0)? */
export function withinBearings(bearing, from, to) {
  const b = (bearing - from + 360) % 360;
  return b <= (to - from + 360) % 360;
}

/**
 * A short fingerprint of a map's layout and the cameras' numbers, so a layer painted over a template can
 * tell when the map has moved under it (venue-paint-over.js). The names and painted list don't count.
 */
export function fingerprint(map, cameraNumbers) {
  const text = JSON.stringify({ parts: map.parts, fence: map.fence, boundary: map.boundary, camera: cameraNumbers });
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
