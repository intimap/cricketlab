import { isSpinner } from "./teams.js";

const BATTLE_LINES = {
  tiredSpell: ["{w} is running on empty. Might be time for a change.", "That's a long spell from {w}. The legs are going."],
  noSpinner: ["Up in the box they're wondering why {s} hasn't had a bowl yet. This pitch is begging for spin."],
  pressure: ["The pressure is really building now. Something has to give."],
};

/** End-of-over messages use presentation dice, separate from the cricket. */
export class OverSummary {
  recent = [];
  constructor(rng) {
    this.rng = rng;
  }

  pick(lines) {
    const fresh = lines.filter((line) => !this.recent.includes(line));
    const line = this.rng.pick(fresh.length ? fresh : lines);
    this.recent.push(line);
    this.recent = this.recent.slice(-40);
    return line;
  }

  overSummary(inn) {
    const b = inn.bowl[inn.lastOverBowler];
    if (!b) return "";
    const runs = b.overRuns;
    let text;
    if (runs === 0) text = `Maiden from ${b.p.short}. Tight.`;
    else if (runs >= 10) text = `${runs} from the over. ${b.p.short} will want to forget that.`;
    else text = `${runs} from the over.`;
    const note = this.captaincyNote(inn, b);
    return note ? `${text} ${note}` : text;
  }

  /** Between overs: is the bowler cooked, should the spinner be on, is the pressure telling? */
  captaincyNote(inn, b) {
    const spinner = isSpinner(b.p.bowl);
    if (b.spell >= (spinner ? 10 : 6) && b.stamina < 0.45) return this.pick(BATTLE_LINES.tiredSpell).replace(/\{w\}/g, b.p.short);
    const idle = inn.bowl.find((x) => isSpinner(x.p.bowl) && x.balls === 0);
    if (idle && inn.pitch.wear > 0.12 && inn.overNo >= 15 && this.rng.chance(0.5)) {
      return this.pick(BATTLE_LINES.noSpinner).replace(/\{s\}/g, idle.p.short);
    }
    if (inn.pressure > 0.6 && this.rng.chance(0.5)) return this.pick(BATTLE_LINES.pressure);
    return "";
  }
}
