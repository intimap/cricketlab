import { clamp } from "../math.js";
import { Ball } from "./conditions.js";
import { presetPlacements } from "./field.js";
import { isSpinner } from "./teams.js";
import { EFFORT_STAMINA } from "./delivery.js";

/** Score, batting and bowling cards, field and ball state for one innings. */
export class Innings {
  runs = 0;
  wkts = 0;
  /** Legal balls bowled. */
  legal = 0;
  extras = { b: 0, lb: 0, w: 0, nb: 0 };
  striker = 0;
  nonStriker = 1;
  nextIn = 2;
  currentBowler = -1;
  lastOverBowler = -1;
  /** Ball-by-ball symbols for the current over (".", "1", "4", "W", "WD"...). */
  overBalls = [];
  partnership = { runs: 0, balls: 0 };
  fow = [];
  preset = "attacking";
  placements = presetPlacements("attacking");
  customField = false;
  newBallAvailable = false;

  constructor(batTeam, bowlTeam, pitch, oversLimit, rng) {
    this.batTeam = batTeam;
    this.bowlTeam = bowlTeam;
    this.pitch = pitch;
    this.oversLimit = oversLimit;
    this.rng = rng;
    this.bat = batTeam.players.map((p, i) => ({
      p,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      how: "",
      batted: i < 2,
      dotStreak: 0,
    }));
    this.bowl = bowlTeam.players
      .filter((p) => p.bowl)
      .map((p) => ({
        p,
        balls: 0,
        runs: 0,
        wkts: 0,
        maidens: 0,
        stamina: 1,
        /** Consecutive overs in the current spell. */
        spell: 0,
        /** Overs since this bowler last bowled. */
        rested: 9,
        /** Runs conceded this over. */
        overRuns: 0,
        lastOver: -9,
        /** Legal balls bowled in the innings, used to vary the plan through an over. */
        seq: 0,
      }));
    this.ball = new Ball(pitch.type.abrasion);
  }

  get overNo() {
    return Math.floor(this.legal / 6);
  }
  get ballInOver() {
    return this.legal % 6;
  }
  get oversText() {
    return `${this.overNo}.${this.ballInOver}`;
  }
  get isOver() {
    return this.wkts >= 10 || this.legal >= this.oversLimit * 6;
  }
  get keeper() {
    return this.bowlTeam.players.find((p) => p.keeper) ?? this.bowlTeam.players[6];
  }
  get bowler() {
    return this.bowl[this.currentBowler];
  }
  get runRate() {
    return this.legal ? (this.runs / this.legal) * 6 : 0;
  }

  /** How set, focused and tired a batter is. */
  batterState(index) {
    const b = this.bat[index];
    const skills = b.p.bat;
    const settled = 1 - Math.exp(-b.balls / 22);
    const attentionSpan = 110 + 160 * skills.concentration;
    let concentration = clamp(1 - Math.max(0, b.balls - attentionSpan) / 480) * (0.9 + 0.1 * skills.temperament);
    concentration *= 1 - clamp(b.dotStreak / 30) * 0.18 * (1 - skills.temperament);
    return { settled, concentration: clamp(concentration, 0.4, 1), fatigue: clamp(b.balls / 420) };
  }

  canBowl(index) {
    return index !== this.lastOverBowler;
  }

  setBowler(index) {
    this.currentBowler = index;
    this.bowl[index].overRuns = 0;
  }

  setPreset(preset) {
    this.preset = preset;
    this.placements = presetPlacements(preset);
    this.customField = false;
  }

  /** Stamina cost of one delivery; a mistimed release costs extra. */
  spendStamina(effort, releaseError) {
    const b = this.bowler;
    const err = Math.abs(releaseError);
    const rhythm = err < 0.03 ? 0.8 : 1 + clamp(err / 0.1) * 1.2;
    const style = isSpinner(b.p.bowl) ? 0.45 : b.p.bowl.style === "fast" ? 1.25 : 1;
    b.stamina = clamp(b.stamina - (0.0062 * style * EFFORT_STAMINA[effort] * rhythm) / (0.6 + 0.8 * b.p.bowl.stamina), 0.05, 1);
  }

  takeNewBall() {
    this.ball.renew();
    this.newBallAvailable = false;
  }

  /** Add a finished ball's record to the score. Returns what changed. */
  apply(rec) {
    const result = { overEnded: false, wicket: false, inningsOver: false, milestones: [] };
    const batter = this.bat[rec.striker];
    const bowler = this.bowl[rec.bowler];
    const before = { bat: batter.runs, part: this.partnership.runs };

    this.runs += rec.total;
    this.partnership.runs += rec.total;
    batter.runs += rec.runsBat;
    if (rec.extra.type !== "wd") {
      batter.balls++;
      this.partnership.balls++;
    }
    if (rec.boundary && rec.runsBat === rec.boundary) {
      if (rec.boundary === 4) batter.fours++;
      else batter.sixes++;
    }
    if (rec.total === 0 && rec.extra.type === null) batter.dotStreak++;
    else if (rec.runsBat > 0) batter.dotStreak = 0;

    const extra = rec.extra.type;
    if (extra === "wd") {
      this.extras.w += rec.extra.runs;
      bowler.runs += rec.extra.runs;
    } else if (extra === "nb") {
      this.extras.nb += 1;
      bowler.runs += 1 + rec.runsBat;
      this.extras.b += rec.extra.runs - 1;
    } else if (extra === "b") {
      this.extras.b += rec.extra.runs;
    } else if (extra === "lb") {
      this.extras.lb += rec.extra.runs;
    }
    if (extra !== "wd" && extra !== "nb") bowler.runs += rec.runsBat;
    bowler.overRuns += rec.total - (extra === "b" || extra === "lb" ? rec.extra.runs : 0);

    let symbol = rec.total === 0 ? "." : String(rec.total);
    if (extra === "wd") symbol = "WD";
    if (extra === "nb") symbol = "NB";
    if (rec.boundary === 4 && rec.runsBat === 4) symbol = "4";
    if (rec.boundary === 6) symbol = "6";
    if (rec.wicket) symbol = "W";
    this.overBalls.push(symbol);

    if (rec.wicket) {
      result.wicket = true;
      this.wkts++;
      const out = this.bat[rec.wicket.batter];
      out.out = true;
      out.how = rec.wicket.text;
      out.dotStreak = 0;
      if (rec.wicket.how !== "runout") bowler.wkts++;
      this.fow.push({ score: this.runs, wkt: this.wkts, name: out.p.short });
      this.partnership = { runs: 0, balls: 0 };
      if (this.wkts < 10 && this.nextIn < 11) {
        const next = this.nextIn++;
        this.bat[next].batted = true;
        if (this.striker === rec.wicket.batter) this.striker = next;
        else this.nonStriker = next;
      }
    }

    if (rec.legal) {
      this.legal++;
      bowler.balls++;
      bowler.seq++;
      this.ball.age(1);
      this.pitch.addOvers(1 / 6);
      if (rec.boundary) this.ball.hitFence();
    }

    const name = batter.p.short.toUpperCase();
    if (before.bat < 50 && batter.runs >= 50) result.milestones.push(`FIFTY for ${name}`);
    if (before.bat < 100 && batter.runs >= 100) result.milestones.push(`HUNDRED for ${name}!`);
    if (!rec.wicket && before.part < 50 && this.partnership.runs >= 50) result.milestones.push("50 PARTNERSHIP");
    if (!rec.wicket && before.part < 100 && this.partnership.runs >= 100) result.milestones.push("100 PARTNERSHIP");

    if (rec.legal && this.legal % 6 === 0) {
      result.overEnded = true;
      if (bowler.overRuns === 0) bowler.maidens++;
      bowler.lastOver = this.overNo - 1;
      bowler.spell++;
      bowler.rested = 0;
      for (const [i, other] of this.bowl.entries()) {
        if (i === rec.bowler) continue;
        other.rested++;
        other.stamina = clamp(other.stamina + 0.07 * (0.6 + 0.8 * other.p.bowl.recovery));
        if (other.rested >= 2) other.spell = 0;
      }
      this.lastOverBowler = rec.bowler;
      [this.striker, this.nonStriker] = [this.nonStriker, this.striker];
      this.overBalls = [];
      if (this.ball.overs >= 80 && this.ball.number === 1) this.newBallAvailable = true;
    }

    result.inningsOver = this.isOver;
    return result;
  }

  /** Swap ends if the batters crossed an odd number of times. */
  settleStrike(swapped) {
    if (swapped) [this.striker, this.nonStriker] = [this.nonStriker, this.striker];
  }

  bowlerFigures(b) {
    return `${b.wkts}-${b.runs}`;
  }

  bowlerOvers(b) {
    return `${Math.floor(b.balls / 6)}.${b.balls % 6}`;
  }
}
