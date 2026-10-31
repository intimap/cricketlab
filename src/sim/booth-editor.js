import { BoothCaller } from "./booth-caller.js";
import { BOOTH_STORIES } from "./booth-stories.js";
import { boothContext } from "./booth-context.js";
import { boothWords, safeBoothCalls } from "./booth-policy.js";

const editors = new WeakMap();

/** A match's booth has its own topic and line memory, separate from the cricket RNG. */
export class BoothEditor {
  caller = new BoothCaller();
  ball = 0;
  quiet = 0;
  dots = 0;
  drops = [];
  recent = [];
  topics = new Map();
  lastTopic = null;
  innings = null;
  lastLegal = null;

  edit(rec, hpd, names, rng, fits = () => true, context = {}) {
    const primary = this.caller.call(rec, hpd, names, rng, fits);
    const analysis = this.context(rec, hpd, names, rng, fits, {
      ...context, lead: primary ? (primary.who + 1) % 3 : rec.over % 3,
    });
    return { calls: safeBoothCalls([...(primary ? [primary] : []), ...analysis.calls.slice(0, 1)], hpd, fits), picks: [] };
  }

  context(rec, hpd, names, rng, fits = () => true, { inn = null, beforePressure, lead = rec.over % 3 } = {}) {
    this.ball++;
    if (inn !== this.innings) {
      this.quiet = 0;
      this.dots = 0;
      this.drops = [];
      this.lastLegal = null;
      this.innings = inn;
    }
    // An AI-simulated passage is a gap in booth coverage, not a run of observed dots.
    if (inn && this.lastLegal !== null && inn.legal - (rec.legal ? 1 : 0) !== this.lastLegal) {
      this.quiet = 0;
      this.dots = 0;
    }
    this.lastLegal = inn?.legal ?? null;
    const quiet = rec.total <= 1 && !rec.wicket && !rec.boundary && !rec.extra?.type && !rec.dropped && !rec.nearRunout;
    this.quiet = quiet ? this.quiet + 1 : 0;
    this.dots = rec.total === 0 ? this.dots + 1 : 0;
    if (rec.dropped && !rec.freeHit && rec.extra?.type !== "nb" && inn) {
      this.drops.push({ batter: rec.striker, on: inn.bat[rec.striker].runs });
    }
    const duty = lead;
    const options = boothContext(rec, inn, this, beforePressure);
    for (const option of options) {
      const story = BOOTH_STORIES[option.topic];
      if (!story || this.ball - (this.topics.get(option.topic) ?? -Infinity) < story.rest) continue;
      // Closely related story names cannot evade a topic cooldown.
      const group = option.topic.startsWith("chase") ? "chase" : option.topic;
      if (this.ball - (this.topics.get(group) ?? -Infinity) < story.rest) continue;
      if (option.topic === this.lastTopic && story.rest > 0) continue;
      const facts = { b: names.batter, w: names.bowler, ...option.facts };
      const render = text => text.replace(/\{([^}]+)\}/g, (_, key) => String(facts[key] ?? `{${key}}`)).toUpperCase();
      // The primary voice already called the ball; another adds context when there is something to say.
      for (const who of [duty, (duty + 1) % 3, (duty + 2) % 3]) {
        const choices = story.lines[who].map(render).filter(text =>
          !this.recent.includes(boothWords(text)) && safeBoothCalls([{ who, text }], hpd, fits).length);
        if (!choices.length) continue;
        const text = choices[Math.min(choices.length - 1, Math.floor(rng.random() * choices.length))];
        const calls = [{ who, text, topic: option.topic }];
        const safe = safeBoothCalls(calls, hpd, fits);
        for (const call of safe) this.recent.push(boothWords(call.text));
        this.recent = this.recent.slice(-40);
        this.topics.set(option.topic, this.ball);
        this.topics.set(group, this.ball);
        this.lastTopic = option.topic;
        return { calls: safe, picks: [] };
      }
    }
    return { calls: [], picks: [] };
  }
}

/** Compatible entry point; pack supplies the per-match identity for call and context memory. */
export function editBoothCall(rec, hpd, names, rng, pack, fits, context) {
  let editor = pack && editors.get(pack);
  if (!editor) {
    editor = new BoothEditor();
    if (pack) editors.set(pack, editor);
  }
  return editor.edit(rec, hpd, names, rng, fits, context);
}
