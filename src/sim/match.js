import { PITCH_TYPES, Pitch } from "./conditions.js";
import { Innings } from "./innings.js";
import { Commentary } from "./commentary.js";
import { isSpinner } from "./teams.js";
import { bowlDelivery } from "./delivery.js";
import { resolveDelivery } from "./batting.js";
import { BallInPlay } from "./ball-in-play.js";
import { pickBowler, pickFieldPreset, pickDeliveryPlan, pickShot, battingAggression } from "./ai.js";

/**
 * Runs an innings ball by ball. The scene drives it for balls the player
 * takes part in; simBall() plays a whole ball with both sides on the AI.
 *
 * human: "bat" or "bowl" (the side the player controls).
 */
export class Match {
  needOver = true;

  constructor(batTeam, bowlTeam, pitchId, overs, rng, human) {
    this.batTeam = batTeam;
    this.bowlTeam = bowlTeam;
    this.rng = rng;
    this.human = human;
    this.inn = new Innings(batTeam, bowlTeam, new Pitch(PITCH_TYPES[pitchId]), overs, rng);
    this.comm = new Commentary(rng);
  }

  get spinner() {
    return isSpinner(this.inn.bowler?.p.bowl);
  }

  startOver(bowlerIdx) {
    const inn = this.inn;
    this.needOver = false;
    inn.setBowler(bowlerIdx ?? pickBowler(inn));
    if (this.human !== "bowl" && !inn.customField) inn.setPreset(pickFieldPreset(inn));
    if (inn.newBallAvailable && this.human !== "bowl") inn.takeNewBall();
  }

  aiPlan() {
    return pickDeliveryPlan(this.inn, this.rng);
  }

  deliver(intent, releaseError) {
    const inn = this.inn;
    const bowler = inn.bowler;
    const d = bowlDelivery(intent, bowler.p.bowl, bowler.stamina, inn.ball, inn.pitch, releaseError, this.rng);
    inn.spendStamina(intent.effort, releaseError);
    return d;
  }

  aiShot(delivery) {
    return pickShot(delivery, this.inn, this.rng);
  }

  /** Resolve the shot and set up the live ball. */
  resolve(intent, delivery, shot) {
    const inn = this.inn;
    const state = inn.batterState(inn.striker);
    const striker = inn.bat[inn.striker];
    const nonStriker = inn.bat[inn.nonStriker];
    const res = resolveDelivery(delivery, shot, striker.p.bat, state, inn.ball, this.spinner, this.rng);
    const live = new BallInPlay({
      res,
      strikerIdx: inn.striker,
      nonStrikerIdx: inn.nonStriker,
      striker: striker.p,
      nonStriker: nonStriker.p,
      fielders: this.fieldersFor(),
      keeper: inn.keeper,
      bowler: inn.bowler.p,
      spinner: this.spinner,
      outfield: inn.pitch.type.outfield,
      noBall: delivery.noBall,
      wide: res.wide,
      aiRunning: this.human !== "bat",
      aiAggression: battingAggression(inn, inn.striker),
      rng: this.rng,
    });
    return { intent, delivery, shot, res, live, striker: inn.striker, bowler: inn.currentBowler };
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
      shotName: contact.shotName,
      deliveryType: play.intent.type,
      pitched: delivery.pitchedAt,
      quality: contact.quality,
      dropped: out.catchDropped,
      lbwNote: res.lbwNote && !res.lbw ? res.lbwNote : "",
      reversing: delivery.reversing,
      bounceNote: delivery.bounceNote,
      beatBat,
    };
    inn.settleStrike(out.strikerEnd === 1);
    rec.commentary = this.comm.line(rec, inn);
    const applied = inn.apply(rec);
    if (applied.overEnded) this.needOver = true;
    return { rec, applied };
  }

  /** Play one ball entirely on the AI. */
  simBall() {
    if (this.needOver) this.startOver();
    const { intent, releaseError } = this.aiPlan();
    const delivery = this.deliver(intent, releaseError);
    const shot = this.aiShot(delivery);
    const play = this.resolve(intent, delivery, shot);
    play.live.setup.aiRunning = true;
    for (let i = 0; !(play.live.dead && play.live.t >= play.live.deadAt) && i++ < 2000; ) play.live.step(0.02);
    return this.finish(play);
  }
}
