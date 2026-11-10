import { bowlerFieldingHome, armOf } from "./bowling-side.js";
import { noteFeet } from "./styles.js";
import { facingOf, mirrorDelivery, toStriker } from "./handedness.js";
import { scout } from "./scouting.js";
import { PITCH_TYPES, Pitch } from "./conditions.js";
import { Innings } from "./innings.js";
import { Commentary } from "./commentary.js";
import { Rng } from "./rng.js";
import { MomentTracker } from "./moments.js";
import { isSpinner } from "./teams.js";
import { bowlDelivery, aimAllowance, movementOf } from "./delivery.js";
import { resolveDelivery } from "./batting.js";
import { plainCall } from "./call.js";
import { footworkWord } from "./footwork-words.js";
import { nextEye, offStrikeEye, eyeMultiplier } from "./eye.js";
import { BallInPlay } from "./ball-in-play.js";
import { pickBowler, pickOverPlan, pickFieldPreset, pickDeliveryPlan, pickShot, battingAggression, runningRisk } from "./ai.js";
import { describeBall } from "./plans.js";
import { clamp } from "../math.js";
import { bearingOf } from "./geometry.js";
import { TestClock, TEST_WEAR, testOverEnded, testNextInnings, testResult } from "./test-match.js";
import { showerComes, limitedRain, revisedTarget } from "./rain.js";
import { callBouncer } from "./bouncer-law.js";
import { practicePlan, keepPractice } from "./practice.js";

/** How often the on-field umpire gets an LBW wrong, either way. */
const UMPIRE_ERROR = 0.15;

/**
 * Runs a game innings by innings, ball by ball. The scene drives it for balls
 * the player takes part in; simBall() plays a whole ball with both sides on the AI.
 *
 * human: "bat" or "bowl" (the side the player controls in the current innings).
 * opts:  { innings: 1 or 2, start: { overs, runs, wkts }, target, nets, test, ground, weather } - see formats.js.
 *        A Test (opts.test) plays to a clock (sim/test-match.js): each innings lasts as long as the time left.
 */
export class Match {
  needOver = true;
  /** Every innings so far; `inn` is the one in progress. */
  innings = [];

  constructor(batTeam, bowlTeam, pitchId, overs, rng, human, opts = {}) {
    this.batTeam = batTeam;
    this.bowlTeam = bowlTeam;
    this.rng = rng;
    this.human = human;
    /** The player's side, whichever end it's at: roles follow it from innings to innings. */
    this.humanTeam = human === "bat" ? batTeam : bowlTeam;
    this.overs = overs;
    this.nets = !!opts.nets;
    /** A Test's clock: the day, the overs left and each day's weather (null in limited-overs games). */
    this.clock = opts.test ? new TestClock(rng, opts.ground) : null;
    this.totalInnings = this.clock ? 4 : (opts.innings ?? 1);
    // Limited-overs games (anything with a target to set or chase) are played in a hurry, more so the shorter they are.
    const limited = !this.clock && (this.totalInnings > 1 || opts.target);
    this.tempo = limited ? clamp((60 - overs) / 55, 0.15, 1) : 0;
    this.pitch = new Pitch(PITCH_TYPES[pitchId]);
    if (this.clock) this.pitch.wearScale = TEST_WEAR;
    /** The weather (sim/weather.js): a Test's changes day by day. */
    this.weather = this.clock?.weather ?? opts.weather ?? null;
    if (this.weather) this.pitch.weather = this.weather;
    // The commentary has its own dice (seeded from the match's), so what's said never changes what happens.
    this.comm = new Commentary(new Rng(rng.state ^ 0x5bd1e995));
    this.overCommentary = this.comm;
    /** One booth per match, retained across innings; presentation dice arrive from the scene. */
    this.booth = this.comm.booth;
    this.beginInnings(batTeam, bowlTeam, opts.target ?? null);
    if (opts.start) this.inn.startFrom(opts.start);
  }

  beginInnings(batTeam, bowlTeam, target) {
    // Same pitch throughout, so it keeps wearing; a new ball each innings.
    // A Test innings lasts as long as there's time left in the match.
    this.inn = new Innings(batTeam, bowlTeam, this.pitch, this.clock ? this.clock.oversLeft : this.overs, this.rng);
    this.inn.test = !!this.clock;
    this.inn.target = target;
    this.inn.tempo = this.tempo;
    this.inn.nets = this.nets;
    this.comm.beginInnings(this.inn);
    this.innings.push(this.inn);
    this.moments = new MomentTracker();
    this.needOver = true;
  }

  /** Is there another innings to play once this one is over? */
  get hasNextInnings() {
    return this.inn.isOver && this.innings.length < this.totalInnings && !this.result;
  }

  /**
   * Swap sides: the team that bowled now chases one more than the total. In a Test, `enforce` is the
   * player's follow-on call (sim/test-match.js).
   */
  nextInnings(enforce) {
    if (this.clock) return testNextInnings(this, enforce);
    const first = this.inn;
    this.human = this.human === "bat" ? "bowl" : "bat";
    // One more than their total, or the revised target if rain has cut the game (sim/rain.js).
    this.beginInnings(first.bowlTeam, first.batTeam, revisedTarget(this, first.runs));
  }

  /** The batting side calls its innings closed (a Test only). */
  declare() {
    if (this.clock && !this.inn.isOver) this.inn.declared = true;
  }

  /**
   * Once a chase is over (or a Test is decided): { winner (team or null for a tie or draw), text, draw }.
   * Null before then.
   */
  get result() {
    if (this.clock) return testResult(this);
    const inn = this.inn;
    if (inn.target === null || !inn.isOver) return null;
    if (inn.chaseWon) {
      const left = 10 - inn.wkts;
      return { winner: inn.batTeam, text: `${inn.batTeam.name} win by ${left} wicket${left === 1 ? "" : "s"}` };
    }
    const margin = inn.target - 1 - inn.runs;
    if (margin === 0) return { winner: null, text: "Match tied" };
    return { winner: inn.bowlTeam, text: `${inn.bowlTeam.name} win by ${margin} run${margin === 1 ? "" : "s"}` };
  }

  get spinner() {
    return isSpinner(this.inn.bowler?.p.bowl);
  }

  startOver(bowlerIdx) {
    const inn = this.inn;
    this.needOver = false;
    inn.setBowler(bowlerIdx ?? pickBowler(inn));
    // A new bowler mid-over (the last one taken off) starts the bouncer count afresh.
    inn.overBouncers = 0;
    // Bowling, the player's captain plans with only what the player has seen given away (sim/scouting.js).
    const known = this.human === "bowl" ? !!inn.bat[inn.striker].weaknessShown : undefined;
    inn.overPlan = pickOverPlan(inn, this.rng, known);
    if (this.human !== "bowl" && !inn.customField) inn.setPreset(pickFieldPreset(inn));
    if (inn.newBallAvailable && this.human !== "bowl") inn.takeNewBall();
  }

  aiPlan() {
    const plan = pickDeliveryPlan(this.inn, this.rng);
    // Practice: the ball the player asked for, its line allowed for (sim/practice.js).
    if (this.practice) return practicePlan(this, plan, this.rng);
    // The computer's lines are set for where the ball should arrive; deliver() allows for the turn.
    return { ...plan, intent: { ...plan.intent, byComputer: true } };
  }

  /** +1 if the striker bats right-handed, -1 left: the sim works in his frame (sim/handedness.js). */
  get facing() {
    return facingOf(this.inn.bat[this.inn.striker].p);
  }

  deliver(intent, releaseError) {
    const inn = this.inn;
    const bowler = inn.bowler;
    // Aimed relative to the striker (+ line is his off side), bowled in the world, then seen from his end.
    // Turn that comes into a right-hander goes away from a left-hander, so the computer's lines (set for
    // right-handers) aim off for twice it: the ball then arrives where it would against a right-hander.
    // A left-armer is bowled as a right-armer in a mirrored world (swing named by the batter), then turned back.
    const facing = this.facing;
    const arm = armOf(bowler.p.bowl);
    const flip = facing * arm;
    const allow = intent.byComputer
      ? aimAllowance(intent, bowler.p.bowl, inn.ball, inn.pitch, flip, intent.wicketSide, "leftArm")
      : 0;
    const swung = arm < 0 ? { outswing: "inswing", inswing: "outswing" }[intent.type] : null;
    const world = bowlDelivery(
      { ...intent, type: swung ?? intent.type, line: (intent.line + allow) * flip },
      bowler.p.bowl,
      bowler.stamina,
      inn.ball,
      inn.pitch,
      releaseError,
      this.rng,
    );
    const d = { ...(flip < 0 ? mirrorDelivery(world) : world), intent, facing, arm };
    inn.spendStamina(intent.effort, releaseError);
    // Too many bouncers (sim/bouncer-law.js); not in the nets.
    if (!this.nets) callBouncer(inn, bowler, d);
    // Disguised deliveries: does the striker pick it out of the hand?
    if (d.disguised) {
      const bat = inn.bat[inn.striker].p.bat;
      const picks = this.rng.chance(intent.type === "slower" ? 0.3 + 0.4 * bat.vsPace : 0.25 + 0.45 * bat.vsSpin);
      if (!picks) {
        d.notPicked = true;
        d.expectedSpinKick = d.decoySpinKick;
        if (intent.type === "slower") d.paceMisread = true;
      }
    }
    return d;
  }

  aiShot(delivery) {
    return pickShot(delivery, this.inn, this.rng);
  }

  /**
   * Resolve the shot and set up the live ball. LBWs are left for the scene's
   * appeal unless deferLbw is false (whole-ball simulation).
   */
  resolve(intent, delivery, shot, deferLbw = true) {
    const inn = this.inn;
    const state = inn.batterState(inn.striker);
    const striker = inn.bat[inn.striker];
    const nonStriker = inn.bat[inn.nonStriker];
    // Where the fielders are (plus the bowler, straight), for a well-hit ball to find the gaps.
    const field = [0, ...inn.placements.slice(0, 9).map((p) => bearingOf(p.pos.x, p.pos.z))];
    // Every batter's eye, the computer's as well as the player's, helps the shot (see eye.js).
    shot.eyeMult = eyeMultiplier(striker.eye);
    // And his own bat (sim/bats.js).
    shot.blade = striker.p.blade;
    const res = resolveDelivery(delivery, shot, striker.p.bat, state, inn.ball, this.spinner, this.rng, field);
    const live = new BallInPlay({
      res,
      strikerIdx: inn.striker,
      nonStrikerIdx: inn.nonStriker,
      striker: striker.p,
      nonStriker: nonStriker.p,
      fielders: this.fieldersFor(),
      keeper: inn.keeper,
      bowler: inn.bowler.p,
      bowlerHome: toStriker(bowlerFieldingHome(this.spinner, intent.wicketSide, armOf(inn.bowler.p.bowl)), this.facing),
      spinner: this.spinner,
      outfield: inn.pitch.outfield,
      noBall: delivery.noBall,
      freeHit: inn.freeHit,
      wide: res.wide,
      aiRunning: this.human !== "bat",
      aiAggression: battingAggression(inn, inn.striker),
      aiRunRisk: runningRisk(inn, inn.striker),
      pressure: inn.pressure,
      deferLbw,
      rng: this.rng,
    });
    return { intent, delivery, shot, res, live, striker: inn.striker, bowler: inn.currentBowler };
  }

  /** Is there an LBW appeal to be made on this play? */
  lbwAppeal(play) {
    const res = play.res;
    return res.padHit && (res.lbw || !!res.lbwNote) && !play.live.safe && !play.live.wicket;
  }

  /**
   * The on-field umpire's call on an LBW appeal: wrong UMPIRE_ERROR of the time either way (the tight
   * ones are a toss-up). He gets slower to give them the more he's pestered.
   */
  umpireLbw(play) {
    const res = play.res;
    const fed = this.inn.irritation;
    if (res.lbw) return !this.rng.chance(UMPIRE_ERROR + 0.05 * fed);
    if (res.lbwNote === "umpire's call, not out") return this.rng.chance(Math.max(0.1, 0.45 - 0.05 * fed));
    return this.rng.chance(Math.max(0, UMPIRE_ERROR - 0.05 * fed));
  }

  /** Ball-tracking: "out", "umpiresCall" or "notOut", plus the reason shown on screen. */
  tracking(play) {
    const res = play.res;
    if (res.lbw) return { verdict: "out", reason: "WICKETS: HITTING" };
    if (res.lbwNote === "umpire's call, not out") return { verdict: "umpiresCall", reason: "WICKETS: UMPIRE'S CALL" };
    const reason =
      {
        "pitched outside leg": "PITCHING: OUTSIDE LEG",
        "outside the line": "IMPACT: OUTSIDE OFF",
        "going over the top": "WICKETS: GOING OVER",
      }[res.lbwNote] ?? "WICKETS: MISSING";
    return { verdict: "notOut", reason };
  }

  /** Turn a play into an LBW dismissal (after an upheld appeal or review). */
  giveLbw(play) {
    const live = play.live;
    live.wicket = { how: "lbw", batter: play.striker };
    live.runs = 0;
    live.boundary = 0;
    live.dead = true;
  }

  /** Fill the field placements with the fielding side (not the keeper or bowler). */
  fieldersFor() {
    const inn = this.inn;
    const others = inn.bowlTeam.players.filter((p) => !p.keeper && p !== inn.bowler.p);
    return inn.placements.slice(0, 9).map((place, i) => ({ player: others[i % others.length], place }));
  }

  /** Score a finished play: work out extras and the dismissal, add commentary, update the innings. */
  finish(play) {
    const inn = this.inn;
    const out = play.live.outcome();
    const { delivery, res, shot } = play;
    // The bowlers see where his feet go (sim/styles.js).
    noteFeet(inn.bat[inn.striker], shot, delivery.pitchedAt?.z ?? 0);
    const noBall = delivery.noBall;
    const wide = res.wide && !noBall;
    let runsBat = 0;
    let extra = { type: null, runs: 0 };
    if (wide) extra = { type: "wd", runs: 1 + out.runs };
    else if (noBall) {
      if (out.kind === "bat") {
        runsBat = out.runs;
        extra = { type: "nb", runs: 1 };
      } else {
        extra = { type: "nb", runs: 1 + out.runs };
      }
    } else if (out.kind === "bat") runsBat = out.runs;
    else if (out.kind === "bye") extra = { type: "b", runs: out.runs };
    else if (out.kind === "legbye") extra = { type: "lb", runs: out.runs };
    if (extra.type && extra.runs === 0) extra.type = null;

    let wicket = null;
    if (out.wicket) {
      const bowler = inn.bowler.p.short;
      const fielder = out.wicket.fielder ?? "";
      const plain = (name) => (name.startsWith("the ") ? name.slice(4) : name);
      const text = {
        bowled: `b ${bowler}`,
        lbw: `lbw b ${bowler}`,
        stumped: `st ${inn.keeper.short} b ${bowler}`,
        caught: out.wicket.caughtBehind
          ? `c ${inn.keeper.short} b ${bowler}`
          : fielder === "the bowler"
            ? `c & b ${bowler}`
            : `c ${plain(fielder)} b ${bowler}`,
        runout: `run out (${plain(fielder)})`,
      }[out.wicket.how];
      wicket = { ...out.wicket, text };
    }

    const contact = res.contact;
    const beatBat =
      !res.touchedBat &&
      (contact.missReason === "beaten" || contact.missReason === "early" || contact.missReason === "late") &&
      !res.padHit;
    const rec = {
      seenBall: shot.battle?.seenBall ?? describeBall(delivery),
      battle: shot.battle ?? null,
      freeHit: inn.freeHit,
      bouncerNoBall: !!delivery.bouncerNoBall,
      /** A disguised ball (googly, arm ball, slower ball) he didn't pick out of the hand. */
      notPicked: !!delivery.notPicked,
      /** The umpire's word on too many bouncers: "warning" (first and final) or "suspended" (taken off). */
      bouncerWarning: delivery.bouncerWarning ?? null,
      over: inn.overNo,
      ball: inn.ballInOver + 1,
      legal: !wide && !noBall,
      bowler: play.bowler,
      striker: play.striker,
      runsBat,
      extra,
      total: runsBat + extra.runs,
      boundary: out.boundary,
      wicket,
      shot: shot.type,
      contact: contact.kind,
      impact: contact.impact ? { ...contact.impact } : null,
      shotName: contact.shotName,
      deliveryType: play.intent.type,
      pitched: delivery.pitchedAt,
      quality: contact.quality,
      dropped: out.catchDropped,
      lbwNote: res.lbwNote && !res.lbw ? res.lbwNote : "",
      reversing: delivery.reversing,
      exit: contact.exit ? { x: contact.exit.x, z: contact.exit.z } : null,
      bounceNote: delivery.bounceNote,
      beatBat,
      missReason: contact.missReason,
      /** Ball-tracking's verdict when it hit the pad: "hitting", "missing", "pitched outside leg"... */
      padVerdict: res.padHit ? (res.lbw ? "hitting" : res.lbwNote.replace(", not out", "")) : "",
    };
    rec.nearRunout = out.nearRunout;
    // What the commentators read off the ball: his feet, his timing, a dive or a batter sent back.
    rec.feet = footworkWord(res, shot.type, delivery.pitchedAt?.z ?? 0)?.key ?? null;
    rec.stride = shot.feet?.stride ?? null;
    rec.timing = Number.isFinite(contact.timing) ? contact.timing : null;
    rec.dived = !!out.dived;
    rec.recalled = !!out.recalled;
    rec.movement = movementOf(delivery);
    rec.moment = this.moments.read(rec, inn);
    // Has the striker given his weakness away? (sim/scouting.js)
    rec.scout = scout(inn, rec);
    // The striker's eye builds or dents with his shot; his partner's fades at the other end.
    const batter = inn.bat[play.striker];
    const partner = inn.bat[play.live.setup.nonStrikerIdx];
    partner.eye = offStrikeEye(partner.eye);
    rec.eye = { before: batter.eye, after: nextEye(batter.eye, shot, res) };
    batter.eye = rec.eye.after;
    inn.settleStrike(out.strikerEnd === 1);
    rec.call = plainCall(rec, delivery, this.spinner);
    const applied = inn.apply(rec);
    this.comm.remember(rec, inn);
    if (applied.overEnded) this.needOver = true;
    if (this.practice) keepPractice(this);
    // A bowler taken off mid-over: another finishes it.
    if (rec.bouncerWarning === "suspended" && !applied.overEnded && !inn.isOver) this.needOver = true;
    if (applied.overEnded && this.clock) testOverEnded(this, applied);
    else if (applied.overEnded && !(this.innings.length > 1 && inn.isOver) && showerComes(this)) {
      // Rain stops a limited-overs game: overs cut and the chase revised.
      applied.rain = limitedRain(this);
      applied.inningsOver = inn.isOver;
    }
    return { rec, applied };
  }

  /** Play one ball entirely on the AI. */
  simBall() {
    if (this.needOver) this.startOver();
    const { intent, releaseError } = this.aiPlan();
    const delivery = this.deliver(intent, releaseError);
    const shot = this.aiShot(delivery);
    const play = this.resolve(intent, delivery, shot, false);
    play.live.setup.aiRunning = true;
    for (let i = 0; !(play.live.dead && play.live.t >= play.live.deadAt) && i++ < 2000; ) play.live.step(0.02);
    return this.finish(play);
  }
}
