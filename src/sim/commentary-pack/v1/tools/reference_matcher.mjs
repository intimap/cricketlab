// Standalone content-contract reference. This is not installed in the game.
const MISSING = Symbol('missing');
export function at(root, path) {
  let value = root;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return MISSING;
    value = value[part];
  }
  return value;
}
export function context(rec, names = {}) {
  const facts = {};
  if (typeof rec.movement?.swing === 'number' && Number.isFinite(rec.movement.swing)) {
    facts.swing_abs_m = Math.abs(rec.movement.swing);
  }
  return { rec, facts, names };
}
const equal = (a, b) => typeof a === typeof b && a === b;
export function matches(entry, ctx) {
  return Object.entries(entry.requires).every(([path, condition]) => {
    const value = at(ctx, path);
    if (value === MISSING) return false;
    if (condition === null || typeof condition !== 'object') return equal(value, condition);
    return Object.entries(condition).every(([op, test]) => {
      switch (op) {
        case 'in': return test.some(item => equal(value, item));
        case 'not_in': return !test.some(item => equal(value, item));
        case 'truthy': return Boolean(value) === test;
        case 'gte': return typeof value === 'number' && Number.isFinite(value) && value >= test;
        case 'gt': return typeof value === 'number' && Number.isFinite(value) && value > test;
        case 'lte': return typeof value === 'number' && Number.isFinite(value) && value <= test;
        case 'lt': return typeof value === 'number' && Number.isFinite(value) && value < test;
        default: throw new Error(`Unknown condition operator ${op}`);
      }
    });
  });
}
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function render(entry, ctx) {
  const { rec, names } = ctx;
  const rawK = rec.moment?.k;
  const values = {
    b: names.b, w: names.w, f: rec.dropped || rec.wicket?.fielder,
    r: rec.total, s: rec.shotName, n: rec.moment?.n,
    k: typeof rawK === 'number' ? (numberWords[rawK] ?? String(rawK)) : rawK,
  };
  return entry.text.replace(/\{([^{}]+)\}/g, (_, key) => {
    const value = values[key];
    if (value === null || value === undefined || value === '') throw new Error(`Missing placeholder {${key}} for ${entry.id}`);
    return String(value);
  });
}
export function choose(entries, ctx, { speaker = 'neutral', ball = 0, history = [], rng, allowCooldownRelaxation = true } = {}) {
  if (typeof rng !== 'function') throw new Error('Pass a presentation-only RNG function');
  const matched = entries.filter(entry => entry.speaker === speaker && matches(entry, ctx));
  const usable = matched.flatMap(entry => {
    try { return [{ entry, text: render(entry, ctx) }]; } catch { return []; }
  });
  if (!usable.length) return null;
  const priority = Math.max(...usable.map(item => item.entry.priority));
  const tier = usable.filter(item => item.entry.priority === priority);
  const lastUse = id => history.filter(item => item.id === id).at(-1)?.ball ?? -Infinity;
  let pool = tier.filter(item => ball - lastUse(item.entry.id) >= item.entry.cooldown_balls);
  let relaxedLineCooldown = false;
  if (!pool.length) {
    if (!allowCooldownRelaxation) return null;
    relaxedLineCooldown = true;
    const oldest = Math.min(...tier.map(item => lastUse(item.entry.id)));
    pool = tier.filter(item => lastUse(item.entry.id) === oldest);
  }
  const recentGroups = new Set(history.slice(-4).map(item => item.repeat_group));
  const freshGroups = pool.filter(item => !recentGroups.has(item.entry.repeat_group));
  if (freshGroups.length) pool = freshGroups;
  let roll = rng() * pool.reduce((sum, item) => sum + item.entry.weight, 0);
  const selected = pool.find(item => (roll -= item.entry.weight) < 0) ?? pool.at(-1);
  return { ...selected, relaxed_line_cooldown: relaxedLineCooldown };
}
