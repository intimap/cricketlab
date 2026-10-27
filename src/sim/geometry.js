// World coordinates, in metres. The striker's stumps are at the origin and the
// bowler's stumps at z = PITCH_LENGTH. x is across the pitch (positive = off
// side for the right-handed batters), y is height.

export const PITCH_LENGTH = 20.12;
/** z of the middle of the pitch, which is also the centre of the ground. */
export const MID_PITCH = 10.06;
/** Popping crease, measured from the stumps. */
export const CREASE = 1.22;
/** Distance a batter runs, crease to crease. */
export const RUN_LENGTH = 17.68;
/** Boundary radius from the centre of the ground. */
export const BOUNDARY = 66;
export const STUMPS_HALF_WIDTH = 0.114;
export const STUMPS_HEIGHT = 0.711;
export const BALL_RADIUS = 0.036;
export const GRAVITY = 9.81;

/** The two sets of stumps: 0 = striker's end, 1 = bowler's end. */
export const ENDS = [
  { x: 0, z: 0 },
  { x: 0, z: PITCH_LENGTH },
];

/** Point at `dist` metres from the striker's stumps on compass bearing `deg` (0 = straight down the ground). */
export function fromBearing(deg, dist) {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a) * dist, z: Math.cos(a) * dist };
}

/** Bearing in degrees of (x, z) as seen from the striker's stumps. */
export function bearingOf(x, z) {
  return (Math.atan2(x, z) * 180) / Math.PI;
}

export function distFromCentre(x, z) {
  return Math.hypot(x, z - MID_PITCH);
}
