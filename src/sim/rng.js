/** Small seedable PRNG (mulberry32 variant) with a few distribution helpers. */
export class Rng {
  constructor(seed = (Math.random() * 2 ** 31) | 0) {
    this.state = seed >>> 0 || 1;
  }

  next() {
    let t = (this.state = (this.state + 1831565813) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo, hi) {
    return lo + (hi - lo) * this.next();
  }

  /** Gaussian sample (Box-Muller). */
  normal(mean = 0, sd = 1) {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  chance(p) {
    return this.next() < p;
  }

  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }
}
