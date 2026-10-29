import BALL_CALLS from "./commentary-pack/v1/ball_calls.json" with { type: "json" };
import COMMENTATOR_LINES from "./commentary-pack/v1/commentator_lines.json" with { type: "json" };
import MATCH_CONTEXT from "./commentary-pack/v1/match_context.json" with { type: "json" };

/**
 * The commentary pack (commentary-pack/v1, see its CLAUDE_INTEGRATION.md):
 * lines that each say when they're true of a ball, picked fresh. Three banks:
 *   ball_calls         what happened on the ball, for whoever is on the microphone ("neutral");
 *   commentator_lines  a commentator's reaction to it, now and then;
 *   match_context      a line for one of the moments MomentTracker spots.
 * Presentation only: the dice are passed in, never the match's.
 */
const BANKS = {
  ball_calls: BALL_CALLS.entries,
  commentator_lines: COMMENTATOR_LINES.entries,
  match_context: MATCH_CONTEXT.entries,
};

/** The moments the pack has lines for (others keep the box's own lines). */
export const PACK_MOMENTS = new Set(MATCH_CONTEXT.entries.map((e) => e.requires["rec.moment.kind"]).filter(Boolean));

const MISSING = Symbol("missing");
/** A pack field path ("rec.extra.type") on { rec, facts }; a path that isn't there is MISSING, unlike null. */
function at(root, path) {
  let value = root;
  for (const part of path.split(".")) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, part)) return MISSING;
    value = value[part];
  }
  return value;
}

const same = (a, b) => typeof a === typeof b && a === b;
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const TESTS = {
  in: (v, list) => list.some((x) => same(v, x)),
  not_in: (v, list) => !list.some((x) => same(v, x)),
  truthy: (v, want) => Boolean(v) === want,
  gte: (v, n) => finite(v) && v >= n,
  gt: (v, n) => finite(v) && v > n,
  lte: (v, n) => finite(v) && v <= n,
  lt: (v, n) => finite(v) && v < n,
};

/** Does every one of the entry's conditions hold? */
function matches(entry, ctx) {
  return Object.entries(entry.requires).every(([path, test]) => {
    const value = at(ctx, path);
    if (value === MISSING) return false;
    if (test === null || typeof test !== "object") return same(value, test);
    return Object.entries(test).every(([op, arg]) => TESTS[op]?.(value, arg) ?? false);
  });
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** The entry's text with its placeholders filled, or null if one has nothing to fill it (then it can't be used). */
function render(entry, ctx) {
  const { rec, names } = ctx;
  const k = rec.moment?.k;
  const values = {
    b: names.b,
    w: names.w,
    f: rec.dropped || rec.wicket?.fielder,
    r: rec.total,
    s: rec.shotName,
    n: rec.moment?.n,
    k: typeof k === "number" ? (NUMBER_WORDS[k] ?? String(k)) : k,
  };
  let ok = true;
  const text = entry.text.replace(/\{([^{}]+)\}/g, (_, key) => {
    const v = values[key];
    if (v === null || v === undefined || v === "") ok = false;
    return String(v);
  });
  return ok ? text : null;
}

/** Everything a line can test: the ball record, plus the one derived fact the pack uses. */
export function packContext(rec, names) {
  const facts = {};
  if (finite(rec.movement?.swing)) facts.swing_abs_m = Math.abs(rec.movement.swing);
  return { rec, facts, names };
}

/** How many recent picks a repeated idea (repeat_group) is kept out of. */
const GROUP_MEMORY = 4;

/**
 * Picks lines for one match and remembers what was said (kept through an
 * innings change; a new match starts afresh).
 */
export class PackVoice {
  /** Balls delivered so far (illegal ones too): the clock for cooldowns. */
  ball = 0;
  history = { ball_calls: [], commentator_lines: [], match_context: [] };

  /** A ball has been delivered. */
  tick() {
    this.ball++;
  }

  /**
   * The best fresh line from `bank` for this ball, as { bank, entry, text }, or null.
   * opts: speaker ("neutral" for ball calls), random (() => 0..1, presentation dice),
   * relax (if every match is on cooldown, use the least recently said rather than nothing:
   * only for the call that must be made), fits (text => whether it fits the box).
   */
  choose(bank, ctx, { speaker = "neutral", random, relax = false, fits = () => true }) {
    const usable = [];
    for (const entry of BANKS[bank]) {
      if (entry.speaker !== speaker || !matches(entry, ctx)) continue;
      const text = render(entry, ctx);
      if (text !== null) usable.push({ bank, entry, text });
    }
    if (!usable.length) return null;
    // A shorter line that fits beats a better one that would be cut off.
    const fitting = usable.filter((u) => fits(u.text));
    const pool0 = fitting.length ? fitting : usable;
    const top = Math.max(...pool0.map((u) => u.entry.priority));
    const tier = pool0.filter((u) => u.entry.priority === top);
    const history = this.history[bank];
    const lastSaid = (id) => history.findLast((h) => h.id === id)?.ball ?? -Infinity;
    let pool = tier.filter((u) => this.ball - lastSaid(u.entry.id) >= u.entry.cooldown_balls);
    if (!pool.length) {
      if (!relax) return null;
      const oldest = Math.min(...tier.map((u) => lastSaid(u.entry.id)));
      pool = tier.filter((u) => lastSaid(u.entry.id) === oldest);
    }
    const recentGroups = new Set(history.slice(-GROUP_MEMORY).map((h) => h.group));
    const freshGroups = pool.filter((u) => !recentGroups.has(u.entry.repeat_group));
    if (freshGroups.length) pool = freshGroups;
    let roll = random() * pool.reduce((sum, u) => sum + u.entry.weight, 0);
    return pool.find((u) => (roll -= u.entry.weight) < 0) ?? pool[pool.length - 1];
  }

  /** Remember a line once it has actually been put on air. */
  said(pick) {
    this.history[pick.bank].push({ id: pick.entry.id, group: pick.entry.repeat_group, ball: this.ball });
  }
}
