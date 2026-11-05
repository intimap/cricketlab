import { clamp } from "../math.js";
import { BOUNDARY_SCORES, ENDS, distFromCentre } from "./geometry.js";
import { keeperSpot } from "./field.js";
import { stepFielder, setState, walkInSpot } from "./fielder-motion.js";
import { assignFieldingRoles } from "./fielder-ai.js";
import * as running from "./running.js";
import * as fielderCatch from "./fielder-catch.js";
import * as fielderThrow from "./fielder-throw.js";
import { stepBall } from "./ball-roll.js";
import { calledEnd } from "./fielding-calls.js";

/** Seconds to spare inside which surviving a run-out counts as a near miss. */
const NEAR_MISS = 0.35;

/**
 * Everything after the ball passes the batter: fielders chase, catch, stop
 * and throw; batters run; boundaries, catches and run-outs end it.
 *
 * Events are appended to `events` (with timestamps) for the scene to turn
 * into sounds and banners.
 *
 * setup: { res, strikerIdx, nonStrikerIdx, striker, nonStriker, fielders,
 *          keeper, bowler, bowlerHome?, spinner, outfield, noBall, freeHit, wide, aiRunning,
 *          aiAggression, aiRunRisk, pressure, deferLbw, rng }
 * deferLbw: don't give LBWs here; the scene handles the appeal (and DRS).
 */
export class BallInPlay {
  fielders = [];
  events = [];
  dead = false;
  /** When the scene should treat the ball as dead (allows a beat to show the end). */
  deadAt = 0;
  runs = 0;
  boundary = 0;
  wicket = null;
  catchDropped = null;
  /** The fielder currently going for the ball, and where/when they'll meet it. */
  plan = null;
  pickupAt = 0;
  boundaryAt = null;
  predictedBoundary = false;
  /** Each runner's end when the current run started, so it can be called back. */
  runStartFrom = null;
  runsAttempted = 0;
  /** The computer batters' error judging the next run (seconds); drawn once per decision. */
  misjudge = null;
  idleSince = 0;
  riskSince = null;
  /** A run-out that nearly happened: { shy } (a missed shy, or made it just in time). */
  nearMiss = null;
  /** How long a fielder holding the ball by the stumps takes to break them. */
  breakDelay = 0.28;
  crossedBoundary = false;

  constructor(setup) {
    this.setup = setup;
    const res = setup.res;
    this.t = res.start.t;
    this.origin = { ...res.start.pos };
    this.ball = {
      pos: { ...res.start.pos },
      vel: { ...res.start.vel },
      /** Off the bat (rad/s, + topspin): the first bounce feels it. */
      spin: res.start.spin ?? 0,
      bounced: !res.touchedBat,
      held: -1,
      atEnd: null,
      /** It got to `atEnd` by a throw (so it waits there), rather than in the hands of someone by the stumps. */
      thrownIn: false,
      throwing: null,
    };

    const addFielder = (player, role, spot, home) => {
      // The ring walked in with the bowler and is crouched ready as the ball arrives.
      const pos = role === "field" ? walkInSpot(home) : { ...home };
      const walked = pos.x !== home.x || pos.z !== home.z;
      this.fielders.push({
        idx: this.fielders.length,
        player,
        role,
        spot,
        home: { ...home },
        pos,
        target: null,
        state: walked ? "ready" : "idle",
        busyUntil: 0,
        speed: 6 + 2 * player.field.speed,
        react: role === "keeper" ? 0.05 : role === "bowler" ? 0.55 : 0.16 + 0.16 * (1 - player.field.reflexes),
        stateAt: 0,
        curSpeed: 0,
        heading: null,
        /** chase, cutoff or cover (see fielder-ai.js), and since when; the pace they go at; when the ball is due. */
        job: null,
        jobAt: 0,
        pace: 1,
        arriveBy: null,
        setAt: null,
      });
    };
    addFielder(setup.keeper, "keeper", "wicketkeeper", keeperSpot(setup.spinner));
    addFielder(setup.bowler, "bowler", "bowler", setup.bowlerHome ?? { x: 0.9, z: 16.8 });
    for (const f of setup.fielders) addFielder(f.player, "field", f.place.name, f.place.pos);

    // progress runs from 0 (striker's end) to 1 (bowler's end).
    const runSpeed = (p) => 5.9 + 2 * p.bat.running;
    this.runners = [
      { bat: setup.strikerIdx, progress: 0, target: null, from: 0, startAt: 0, speed: runSpeed(setup.striker) },
      { bat: setup.nonStrikerIdx, progress: 1, target: null, from: 1, startAt: 0, speed: runSpeed(setup.nonStriker) },
    ];
    this.idleSince = this.t;

    // On a no-ball or a free hit the batter can only be run out.
    this.safe = setup.noBall || setup.freeHit;
    if (res.bowled && !this.safe) {
      this.endWithWicket({ how: "bowled", batter: setup.strikerIdx }, res.playedOn ? "played on" : "");
      this.emit("bowled");
    } else if (res.lbw && !this.safe && !setup.deferLbw) {
      this.endWithWicket({ how: "lbw", batter: setup.strikerIdx });
      this.emit("lbw");
    } else {
      if (res.padHit) this.emit("pad");
      this.replan();
    }
  }

  emit(type, data = {}) {
    this.events.push({ t: this.t, type, ...data });
  }

  endWithWicket(wicket, text = "") {
    this.wicket = wicket;
    this.dead = true;
    this.deadAt = this.t + 0.8;
    if (text) this.emit("dead", { text });
  }

  get running() {
    return this.runners.some((r) => r.target !== null);
  }

  grounded(runner, end) {
    return running.grounded(this, runner, end);
  }

  requestRun() {
    return running.requestRun(this);
  }

  recall() {
    return running.recall(this);
  }

  /**
   * Predict the ball's path and give out the jobs (fielder-ai.js): who chases it (to catch, stop or,
   * failing that, pick it up), who cuts it off behind them, and who covers the stumps.
   */
  replan() {
    const path = this.forecast();
    const out = path.find((p) => p.out);
    this.boundaryAt = out ? out.t : null;
    const chasing = this.fielders.find((f) => f.job === "chase");
    const { plan, predictedBoundary, jobs } = assignFieldingRoles(this.fielders, path, {
      t: this.t,
      origin: this.origin,
      res: this.setup.res,
      chaser: chasing ? chasing.idx : null,
    });
    this.plan = plan;
    this.predictedBoundary = predictedBoundary;
    const given = new Map(jobs.map((j) => [j.idx, j]));
    for (const f of this.fielders) {
      const j = given.get(f.idx);
      if (!j) {
        // Stood down: stop where they are.
        if (f.job) {
          f.job = null;
          f.target = null;
          f.arriveBy = null;
          if (f.state === "chase" || f.state === "cutoff" || f.state === "cover" || f.state === "set")
            setState(f, "idle", this.t);
        }
        continue;
      }
      // A fielder kept on the same job carries on without a second reaction.
      if (f.job !== j.job) f.jobAt = this.t;
      f.job = j.job;
      f.target = j.target;
      f.pace = j.pace;
      f.arriveBy = j.job === "chase" ? plan.t : null;
      if (f.state === "idle" || f.state === "ready" || f.state === "chase" || f.state === "cutoff" || f.state === "cover")
        setState(f, j.job, f.state === j.job ? f.stateAt : this.t);
    }
  }

  /** The free ball's path from now until it stops or crosses the boundary. */
  forecast() {
    const b = { pos: { ...this.ball.pos }, vel: { ...this.ball.vel }, spin: this.ball.spin, bounced: this.ball.bounced };
    const path = [];
    const dt = 0.02;
    let t = this.t;
    for (let i = 0; i < 500; i++) {
      stepBall(b, dt, this.setup.outfield);
      t += dt;
      const speed = Math.hypot(b.vel.x, b.vel.z);
      const out = distFromCentre(b.pos.x, b.pos.z) > BOUNDARY_SCORES;
      path.push({ t, x: b.pos.x, y: b.pos.y, z: b.pos.z, v: speed, bounced: b.bounced, out });
      if (out || (speed < 0.05 && b.pos.y <= 0)) break;
    }
    return path;
  }

  step(dt) {
    if (this.dead) {
      this.t += dt;
      this.moveFielders(dt);
      return;
    }
    this.t += dt;
    const b = this.ball;

    if (b.throwing) {
      const th = b.throwing;
      const k = clamp((this.t - th.t0) / (th.t1 - th.t0));
      b.pos.x = th.from.x + (th.to.x - th.from.x) * k;
      b.pos.z = th.from.z + (th.to.z - th.from.z) * k;
      b.pos.y = th.from.y + (th.to.y - th.from.y) * k + Math.sin(k * Math.PI) * Math.min(6, (th.t1 - th.t0) * 3.2);
      if (k >= 1) {
        if (th.relayTo !== undefined) fielderThrow.arriveAtFielder(this, this.fielders[th.relayTo]);
        else this.arriveAtEnd(th.end, th.fielder);
      }
    } else if (b.held < 0) {
      const wasBounced = b.bounced;
      stepBall(b, dt, this.setup.outfield);
      // A catch is no longer on once it lands.
      if (!wasBounced && b.bounced && this.plan?.kind === "catch" && this.plan.t > this.t + 0.05) this.replan();
      if (!this.crossedBoundary && distFromCentre(b.pos.x, b.pos.z) > BOUNDARY_SCORES) {
        this.crossedBoundary = true;
        this.boundary = !b.bounced && this.setup.res.touchedBat ? 6 : 4;
        this.emit(this.boundary === 6 ? "six" : "four");
        this.dead = true;
        this.deadAt = this.t + 1.2;
      }
    } else {
      const holder = this.fielders[b.held];
      const stumps = b.atEnd !== null ? ENDS[b.atEnd] : null;
      // A throw to an unmanned end waits by the stumps for the fielder to arrive.
      if (stumps && b.thrownIn && Math.hypot(holder.pos.x - stumps.x, holder.pos.z - stumps.z) > 1.5)
        b.pos = { x: stumps.x + 0.3, y: 0.2, z: stumps.z };
      else b.pos = { x: holder.pos.x, y: 1, z: holder.pos.z };
    }

    if (this.plan && !this.dead && b.held < 0 && !b.throwing && this.t >= this.plan.t) this.resolvePlan();
    if (!this.dead && b.held >= 0 && !b.throwing && b.atEnd === null && this.t >= this.pickupAt) {
      this.throwBall(this.fielders[b.held]);
    }
    this.moveRunners(dt);
    if (this.setup.aiRunning) this.aiRun();

    if (!this.dead && b.atEnd !== null && !b.throwing) {
      // Ball is at the stumps: run out anyone short of their ground, else call it dead.
      const runner = this.riskRunner(b.atEnd);
      if (runner) {
        if (this.riskSince === null) this.riskSince = this.t;
        if (this.t - this.riskSince > this.breakDelay) this.runOut(runner, b.atEnd, b.held);
      } else {
        // Made his ground with the bails about to come off: a near miss worth talking about.
        if (this.riskSince !== null && this.breakDelay - (this.t - this.riskSince) < NEAR_MISS && !this.nearMiss) {
          this.nearMiss = { shy: false };
        }
        this.riskSince = null;
      }
      if (!this.running && !this.dead && this.t - this.idleSince > 0.55) {
        this.dead = true;
        this.deadAt = this.t + 0.3;
        this.emit("dead");
      }
    }
    if (this.running) this.idleSince = this.t;
    if (this.t > 40 && !this.dead) {
      this.dead = true;
      this.deadAt = this.t;
    }
    this.moveFielders(dt);
  }

  resolvePlan() {
    return fielderCatch.resolvePlan(this);
  }

  runnerTimeTo(runner, end) {
    return running.runnerTimeTo(this, runner, end);
  }

  /** Throw to whichever end gives the best run-out chance (or the keeper's), see fielder-throw.js. */
  throwBall(f) {
    const th = fielderThrow.planThrow(f, {
      t: this.t,
      rng: this.setup.rng,
      running: this.running,
      runners: this.runners,
      runnerTimeTo: (r, e) => this.runnerTimeTo(r, e),
      fielders: this.fielders,
      wasSet: !!f.wasSet,
      offBalance: !!f.dived,
      calledEnd: calledEnd(this),
    });
    // A called throw is used up.
    this.calledEnd = null;
    f.relayed = false;
    if (th.relayTo !== undefined) return fielderThrow.relayThrow(this, f, th);
    const { end, shy } = th;
    this.ball.throwing = {
      from: { x: f.pos.x, y: 1.6, z: f.pos.z },
      to: {
        x: ENDS[end].x + (shy ? 0 : 0.3),
        y: shy ? 0.4 : 0.6,
        z: ENDS[end].z - (shy ? 0 : end === 0 ? 0.4 : -0.4),
      },
      t0: th.t0,
      t1: th.arriveAt - 0.12,
      end,
      fielder: f.idx,
      shy,
      wild: th.wild,
      overthrow: th.overthrow,
      dist: th.dist,
    };
    this.ball.held = -1;
    f.dived = false;
    // A long throw takes a crow-hop first (fielder-motion.js turns it into the throw).
    setState(f, th.hop ? "crowHop" : "throw", this.t);
    this.emit("throw", { fielder: f.idx, end, text: th.wild ? "wild" : shy ? "shy" : "" });
  }

  arriveAtEnd(end, thrower) {
    return fielderThrow.arriveAtEnd(this, end, thrower);
  }

  runOn(th, end, thrower, text) {
    return fielderThrow.runOn(this, th, end, thrower, text);
  }

  riskRunner(end) {
    return running.riskRunner(this, end);
  }

  runOut(runner, end, fielderIdx, text = "") {
    return fielderThrow.runOut(this, runner, end, fielderIdx, text);
  }

  moveRunners(dt) {
    return running.moveRunners(this, dt);
  }

  aiRun() {
    return running.aiRun(this);
  }

  moveFielders(dt) {
    for (const f of this.fielders) stepFielder(f, dt, this.t);
  }

  /** Final result once the ball is dead. */
  outcome() {
    const res = this.setup.res;
    let kind;
    let runs = this.boundary ? Math.max(this.boundary, this.runs) : this.runs;
    if (res.touchedBat) kind = "bat";
    else if (this.setup.wide) kind = "wide";
    else if (res.padHit) {
      kind = res.legByesAllowed ? "legbye" : "none";
      if (!res.legByesAllowed) runs = 0;
    } else kind = "bye";
    if (runs === 0 && kind !== "wide") kind = res.touchedBat ? "bat" : "none";
    const striker = this.runners.find((r) => r.bat === this.setup.strikerIdx);
    return {
      runs,
      boundary: this.boundary,
      kind,
      wicket: this.wicket,
      catchDropped: this.catchDropped,
      nearRunout: this.wicket ? null : this.nearMiss,
      // A boundary leaves the striker on strike, however far they'd run.
      strikerEnd: this.boundary ? 0 : striker.from,
    };
  }

  runnerPos(runner) {
    return running.runnerPos(this, runner);
  }
}
