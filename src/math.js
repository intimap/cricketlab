export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

export const toRad = (deg) => (deg * Math.PI) / 180;

/** Signed difference a - b in degrees, wrapped to [-180, 180). */
export function angleDiff(a, b) {
  return ((a - b + 540) % 360) - 180;
}

export const easeIn = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k;
};

export const easeOut = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return 1 - (1 - k) * (1 - k);
};
