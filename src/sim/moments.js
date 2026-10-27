/**
 * Spots what makes a ball worth talking about beyond its bare result: a
 * drought ending, pressure building, a hat-trick on, a stand broken, a
 * run-out that nearly was. It reads the innings as it stood *before* the
 * ball is added, and keeps a little memory of its own. Deterministic, so it
 * never disturbs the match's dice.
 *
 * Returns { kind, n, k } (the numbers worth quoting) or null.
 */
/** Movement worth a comment (metres), and pace (km/h). A jaffa needs less, as long as it beats the bat. */
const BIG_SWING = 0.6;
const BIG_TURN = 0.7;
const RAPID_KMH = 157;
const JAFFA_SWING = 0.4;
const JAFFA_SEAM = 0.07;
const JAFFA_TURN = 0.45;
/** Balls before the same movement remark can come round again. */
const MOVEMENT_COOLDOWN = 36;

export class MomentTracker {
  /** Consecutive balls without a run, for the batting side. */
  teamDots = 0;
  /** Batter index -> boundaries in a row. */
  boundaryRun = new Map();
  /** Bowler index -> wicket or not on his last two legal balls. */
  lastBalls = new Map();
  /** Bowler index -> whether his last completed over was a maiden. */
  lastMaiden = new Map();
  /** Batter index -> times beaten this over. */
  beaten = new Map();
  over = -1;
  /** Balls seen, and when each movement remark was last made. */
  balls = 0;
  saidAt = new Map();

  read(rec, inn) {
    this.balls++;
    if (rec.over !== this.over) {
      this.over = rec.over;
      this.beaten.clear();
    }
    const bowler = inn.bowl[rec.bowler];
    const dotsBefore = this.teamDots;
    this.teamDots = rec.total === 0 ? this.teamDots + 1 : 0;

    let boundaries = this.boundaryRun.get(rec.striker) ?? 0;
    if (rec.extra.type !== "wd") {
      boundaries = rec.boundary && rec.runsBat === rec.boundary ? boundaries + 1 : 0;
      this.boundaryRun.set(rec.striker, boundaries);
    }
    const bowlerWicket = !!rec.wicket && rec.wicket.how !== "runout";
    const last = this.lastBalls.get(rec.bowler) ?? [];
    if (rec.legal) this.lastBalls.set(rec.bowler, [...last, bowlerWicket].slice(-2));
    if (rec.beatBat) this.beaten.set(rec.striker, (this.beaten.get(rec.striker) ?? 0) + 1);

    const overEnds = rec.legal && (inn.legal + 1) % 6 === 0;
    const byes = rec.extra.type === "b" || rec.extra.type === "lb" ? rec.extra.runs : 0;
    const overRuns = bowler.overRuns + rec.total - byes;
    const maidenBefore = this.lastMaiden.get(rec.bowler) ?? false;
    if (overEnds) this.lastMaiden.set(rec.bowler, overRuns === 0);

    return this.pick(rec, inn, { bowler, bowlerWicket, last, dotsBefore, boundaries, overEnds, overRuns, maidenBefore });
  }

  pick(rec, inn, s) {
    const m = (kind, n = 0, k = 0) => ({ kind, n, k });
    const batter = inn.bat[rec.wicket ? rec.wicket.batter : rec.striker];
    const runsAfter = batter.runs + (rec.wicket && rec.wicket.batter !== rec.striker ? 0 : rec.runsBat);

    if (rec.wicket) {
      if (s.bowlerWicket && s.last.length === 2 && s.last[0] && s.last[1]) return m("hatTrick");
      if (s.bowlerWicket && s.last[s.last.length - 1]) return m("twoInTwo");
      if (s.bowlerWicket && s.bowler.wkts === 4) return m("fiveFor");
      if (runsAfter >= 90 && runsAfter < 100) return m("outInNineties", runsAfter);
      if (runsAfter === 0 && batter.balls === 0) return m("goldenDuck");
      if (runsAfter === 0 && batter.balls >= 20) return m("longDuck", batter.balls + 1);
      if (runsAfter === 0) return m("duck");
      // A collapse: three or more wickets inside 25 runs. n = runs since the first of them, k = wickets.
      const score = inn.runs + rec.total;
      const falls = inn.fow.filter((f) => score - f.score <= 25);
      if (falls.length >= 2) return m("collapse", score - falls[0].score, falls.length + 1);
      const stand = inn.partnership.runs + rec.total;
      if (stand >= 50) return m("standBroken", stand);
      if (runsAfter >= 50) return m("bigKnockEnds", runsAfter);
      if (s.bowlerWicket && s.bowler.wkts === 2) return m("bowlerThird");
      return null;
    }
    const scoreAfter = inn.runs + rec.total;
    if (inn.target !== null && scoreAfter >= inn.target) return m("winningRuns");
    if (batter.runs < 100 && runsAfter >= 100) return m("hundred", batter.balls + 1);
    if (batter.runs < 50 && runsAfter >= 50) return m("fifty", batter.balls + 1);
    const stand = inn.partnership.runs;
    const standAfter = stand + rec.total;
    if (Math.floor(standAfter / 50) > Math.floor(stand / 50)) return m("partnership", Math.floor(standAfter / 50) * 50);
    if (rec.nearRunout) return m(rec.nearRunout.shy ? "shyMissed" : "nearRunout");
    if (rec.dropped) return m("droppedOn", batter.runs);
    if (rec.runsBat > 0 && batter.runs === 0 && batter.balls >= 12) return m("offTheMark", batter.balls + 1);
    if (rec.runsBat > 0 && batter.dotStreak >= 10) return m("droughtEnds", batter.dotStreak);
    if (s.boundaries >= 3) return m("threeInARow");
    if (s.boundaries === 2) return m("backToBack");
    if (rec.boundary && s.dotsBefore >= 12) return m("pressureReleased", s.dotsBefore);
    if (batter.runs < 90 && runsAfter >= 90 && runsAfter < 100) return m("intoNineties", runsAfter);
    if (Math.floor(scoreAfter / 100) > Math.floor(inn.runs / 100)) return m("teamMilestone", Math.floor(scoreAfter / 100) * 100);
    const ballsLeft = inn.ballsLeft - (rec.legal ? 1 : 0);
    if (s.overEnds && inn.target !== null && ballsLeft > 0 && ballsLeft <= 36) {
      return m("equation", inn.target - scoreAfter, ballsLeft);
    }
    if (s.overEnds && s.overRuns >= 12) return m("bigOver", s.overRuns);
    const spellBalls = s.bowler.balls + 1;
    if (s.overEnds && s.overRuns <= 2 && spellBalls >= 36 && (s.bowler.runs * 6) / spellBalls < 2.2) {
      return m("tightSpell", s.bowler.runs + s.overRuns);
    }
    if (s.overEnds && s.overRuns === 0) return m(s.maidenBefore ? "maidenAgain" : "maiden");
    if (rec.total === 0 && this.teamDots >= 12 && this.teamDots % 6 === 0) return m("dotsBuilding", this.teamDots);
    if (rec.beatBat && this.beaten.get(rec.striker) >= 2) return m("beatenAgain", this.beaten.get(rec.striker));
    return this.movementMoment(rec, m);
  }

  /** A ball that did something special: a jaffa, big swing or turn, or real pace (the speed gun shows the figures). */
  movementMoment(rec, m) {
    const mv = rec.movement;
    if (!mv) return null;
    const fresh = (kind) => this.balls - (this.saidAt.get(kind) ?? -MOVEMENT_COOLDOWN) >= MOVEMENT_COOLDOWN;
    const say = (kind, n, k) => {
      this.saidAt.set(kind, this.balls);
      return m(kind, n, k);
    };
    const cm = (v) => Math.round(Math.abs(v) * 100);
    const way = (v) => (v > 0 ? "AWAY" : "BACK IN");
    const big = Math.abs(mv.swing) >= Math.abs(mv.offPitch) ? mv.swing : mv.offPitch;
    if (
      rec.beatBat &&
      (Math.abs(mv.swing) >= JAFFA_SWING || (mv.spin ? Math.abs(mv.offPitch) >= JAFFA_TURN : Math.abs(mv.offPitch) >= JAFFA_SEAM))
    ) {
      return say("jaffa", cm(big), way(big));
    }
    if (mv.kmh >= RAPID_KMH && fresh("rapid")) return say("rapid", Math.round(mv.kmh));
    if (Math.abs(mv.swing) >= BIG_SWING && fresh("bigSwing")) return say("bigSwing", cm(mv.swing), way(mv.swing));
    if (mv.spin && Math.abs(mv.offPitch) >= BIG_TURN && fresh("bigTurn"))
      return say("bigTurn", cm(mv.offPitch), way(mv.offPitch));
    return null;
  }
}
