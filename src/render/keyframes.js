/** Keyframed motion shared by the rigs (render/batter/, render/bowler/). */

/**
 * A channel's value at t through its keyframes: a monotone cubic (Fritsch-Carlson), so every keyframe is hit
 * exactly and motion carries its speed through them (no jolt at contact) without overshooting a pose; it
 * comes to rest where a movement turns back, like the top of the backlift.
 */
export function smoothAt(times, ys, t) {
  const n = times.length;
  let k = 0;
  while (k < n - 2 && t > times[k + 1]) k++;
  const h = times[k + 1] - times[k] || 1e-4;
  const slope = (i) => (ys[i + 1] - ys[i]) / (times[i + 1] - times[i] || 1e-4);
  const tangent = (i) => {
    if (i <= 0) return slope(0);
    if (i >= n - 1) return slope(n - 2);
    const d0 = slope(i - 1);
    const d1 = slope(i);
    if (d0 * d1 <= 0) return 0;
    const h0 = times[i] - times[i - 1];
    const h1 = times[i + 1] - times[i];
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / d0 + w2 / d1);
  };
  const s = Math.max(0, Math.min(1, (t - times[k]) / h));
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * ys[k] +
    (s3 - 2 * s2 + s) * h * tangent(k) +
    (-2 * s3 + 3 * s2) * ys[k + 1] +
    (s3 - s2) * h * tangent(k + 1)
  );
}
