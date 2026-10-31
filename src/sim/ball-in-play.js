import { clamp } from "../math.js";
import { BOUNDARY, ENDS, GRAVITY, RUN_LENGTH, CREASE, distFromCentre } from "./geometry.js";
import { keeperSpot } from "./field.js";
import { stepFielder, setState, walkInSpot } from "./fielder-motion.js";
import { assignFieldingRoles, coverSpot } from "./fielder-ai.js";
import { catchChance } from "./fielder-catch.js";
import { planThrow, gatherDelay } from "./fielder-throw.js";

/** How badly computer batters misjudge a run (seconds, standard deviation, for an average runner). */
const RUN_MISJUDGE = 0.36;
/** Seconds to spare inside which surviving a run-out counts as a near miss. */
const NEAR_MISS = 0.35;

/** Advance a free ball (in the air or along the ground) by dt. */
function stepBall(b, dt, outfield) {
  b.vel.y -= GRAVITY * dt;
  if (b.pos.y > 0.01) {
    const drag = 1 - 0.0063 * Math.hypot(b.vel.x, b.vel.y, b.vel.z) * dt;
    b.vel.x *= drag;
    b.vel.y *= drag;
    b.vel.z *= drag;
  }
  b.pos.x += b.vel.x * dt;
  b.pos.y += b.vel.y * dt;
  b.pos.z += b.vel.z * dt;
  if (b.pos.y <= 0) {
    b.pos.y = 0;
    if (b.vel.y < -1.6) {
      // Bounce: steeper landings keep less of their pace.
      const ground = Math.hypot(b.vel.x, b.vel.z) || 1;
      const keep = clamp(0.95 - 0.55 * (-b.vel.y / ground), 0.45, 0.94);
      b.vel.y = -b.vel.y * 0.3;
      b.vel.x *= keep;
      b.vel.z *= keep;
      b.bounced = true;
    } else {
      // Rolling: friction slows it, more on a slow outfield.
      b.vel.y = 0;
      b.bounced = true;
      const speed = Math.hypot(b.vel.x, b.vel.z);
      if (speed > 0) {
        const next = Math.max(0, speed - (2 * outfield + 0.25 * speed) * dt);
        b.vel.x *= next / speed;
        b.vel.z *= next / speed;
      }
    }
  }
}

/**
 * Everything after the ball passes the batter: fielders chase, catch, stop
 * and throw; batters run; boundaries, catches and run-outs end it.
 *
 * Events are appended to `events` (with timestamps) for the scene to turn
 * into sounds and banners.
 *
 * setup: { res, strikerIdx, nonStrikerIdx, striker, nonStriker, fielders,
 *          keeper, bowler, bowlerHome?, spinner, outfield, noBall, freeHit, wide, aiRunning,
 *          aiAggression, pressure, deferLbw, rng }
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
    return runner.target === null && runner.from === end;
  }

  /** Start a run (both batters). Returns false if a run can't be started now. */
  requestRun() {
    if (this.dead || this.wicket || this.running || this.boundary) return false;
    const first = this.runsAttempted === 0;
    this.runStartFrom = this.runners.map((r) => r.from);
    for (const [i, r] of this.runners.entries()) {
      r.target = r.from === 0 ? 1 : 0;
      r.startAt = this.t + (first ? (i === 0 ? 0.3 : 0.06) : 0.32);
    }
    this.runsAttempted++;
    this.emit("runStart");
    return true;
  }

  /** Send both batters back to where they started this run. */
  recall() {
    if (!this.running || !this.runStartFrom || this.dead) return false;
    for (const [i, r] of this.runners.entries()) {
      r.target = this.runStartFrom[i];
      r.from = this.runStartFrom[i] === 0 ? 1 : 0;
      r.startAt = this.t + 0.22;
    }
    this.runStartFrom = null;
    this.emit("recall");
    return true;
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
    const b = { pos: { ...this.ball.pos }, vel: { ...this.ball.vel }, bounced: this.ball.bounced };
    const path = [];
    const dt = 0.02;
    let t = this.t;
    for (let i = 0; i < 500; i++) {
      stepBall(b, dt, this.setup.outfield);
      t += dt;
      const speed = Math.hypot(b.vel.x, b.vel.z);
      const out = distFromCentre(b.pos.x, b.pos.z) > BOUNDARY;
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
      if (k >= 1) this.arriveAtEnd(th.end, th.fielder);
    } else if (b.held < 0) {
      const wasBounced = b.bounced;
      stepBall(b, dt, this.setup.outfield);
      // A catch is no longer on once it lands.
      if (!wasBounced && b.bounced && this.plan?.kind === "catch" && this.plan.t > this.t + 0.05) this.replan();
      if (!this.crossedBoundary && distFromCentre(b.pos.x, b.pos.z) > BOUNDARY) {
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

  /** The planned fielder reaches the ball: catch or drop, stop or misfield. */
  resolvePlan() {
    const plan = this.plan;
    const f = this.fielders[plan.fielder];
    const rng = this.setup.rng;
    const name = f.role === "keeper" ? "the keeper" : f.role === "bowler" ? "the bowler" : f.spot;
    const skill = f.player.field;
    this.plan = null;
    const wasSet = f.state === "set";
    // Jobs are done once they're at the ball.
    f.job = null;
    f.arriveBy = null;
    if (plan.dive) {
      setState(f, "dive", this.t);
      this.emit("dive", { fielder: f.idx });
    }

    if (plan.kind === "catch") {
      const chance = catchChance(f, plan, this.t);
      if (rng.chance(chance)) {
        this.ball.held = f.idx;
        this.ball.vel = { x: 0, y: 0, z: 0 };
        if (this.safe) {
          this.emit("gather", { fielder: f.idx, text: "no-ball" });
          this.pickupAt = this.t + 0.3;
        } else {
          this.emit("catch", { fielder: f.idx });
          f.state = "celebrate";
          f.stateAt = this.t;
          this.endWithWicket({ how: "caught", batter: this.setup.strikerIdx, fielder: name, caughtBehind: f.role === "keeper" });
        }
        return;
      }
      this.catchDropped = name;
      this.emit("drop", { fielder: f.idx });
      const v = this.ball.vel;
      const speed = Math.hypot(v.x, v.y, v.z) * 0.22;
      const dir = rng.range(0, Math.PI * 2);
      this.ball.vel = { x: Math.cos(dir) * speed, y: Math.abs(v.y) * 0.15, z: Math.sin(dir) * speed };
      this.ball.bounced = true;
      f.busyUntil = this.t + 0.8;
      if (plan.dive) setState(f, "down", this.t);
      this.replan();
      return;
    }

    if (plan.kind === "stop" || plan.kind === "collect" || plan.kind === "pickup") {
      const keeper = f.role === "keeper";
      const fumble =
        plan.kind === "pickup"
          ? 0.01
          : keeper && plan.kind === "collect"
            ? (1 - skill.keeping) * 0.09 + (plan.dive ? 0.12 : 0)
            : clamp(0.015 + 0.11 * clamp(plan.ballSpeed / 30) + (plan.dive ? 0.16 : 0) - 0.06 * skill.catching, 0.01, 0.4);
      if (rng.chance(fumble)) {
        this.emit(keeper ? "fumble" : "misfield", { fielder: f.idx });
        const v = this.ball.vel;
        const speed = Math.hypot(v.x, v.z) * 0.45;
        const dir = Math.atan2(v.x, v.z) + rng.normal(0, 0.5);
        this.ball.vel = { x: Math.sin(dir) * speed, y: 0, z: Math.cos(dir) * speed };
        this.ball.bounced = true;
        f.busyUntil = this.t + 0.9;
        if (plan.dive) setState(f, "down", this.t);
        this.replan();
        return;
      }
      this.ball.held = f.idx;
      this.ball.vel = { x: 0, y: 0, z: 0 };
      f.state = "hold";
      f.stateAt = this.t;
      f.target = null;
      f.curSpeed = 0;
      this.emit(keeper && plan.kind === "collect" ? "collect" : "stop", { fielder: f.idx });

      if (keeper && this.setup.res.stumpingChance && !this.safe && !this.setup.wide) {
        this.runners[0].progress = 0.08;
        this.emit("stumped", { fielder: f.idx });
        this.endWithWicket({ how: "stumped", batter: this.setup.strikerIdx, fielder: "the keeper" });
        return;
      }
      // Already by the stumps? Then no throw is needed.
      for (const end of [0, 1]) {
        const dist = Math.hypot(f.pos.x - ENDS[end].x, f.pos.z - ENDS[end].z);
        if (dist < 3 || (keeper && end === 0 && dist < 18 && !this.running)) {
          this.ball.atEnd = end;
          this.ball.thrownIn = false;
          this.breakDelay = 0.28 + dist / 22;
          this.idleSince = this.t;
          return;
        }
      }
      f.dived = plan.dive;
      f.wasSet = wasSet;
      this.pickupAt = this.t + gatherDelay(plan.dive);
    }
  }

  /** Seconds until `runner` is safely in at `end` (Infinity if not heading there). */
  runnerTimeTo(runner, end) {
    if (runner.target === null) return runner.from === end ? 0 : Infinity;
    if (runner.target !== end) return Infinity;
    const dist = Math.abs((end === 1 ? 1 : 0) - runner.progress) * RUN_LENGTH;
    return Math.max(0, runner.startAt - this.t) + dist / runner.speed;
  }

  /** Throw to whichever end gives the best run-out chance (or the keeper's), see fielder-throw.js. */
  throwBall(f) {
    const th = planThrow(f, {
      t: this.t,
      rng: this.setup.rng,
      running: this.running,
      runners: this.runners,
      runnerTimeTo: (r, e) => this.runnerTimeTo(r, e),
      fielders: this.fielders,
      wasSet: !!f.wasSet,
      offBalance: !!f.dived,
    });
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
    const th = this.ball.throwing;
    this.ball.throwing = null;
    const rng = this.setup.rng;
    const f = this.fielders[thrower];
    const atRisk = this.riskRunner(end);

    // Wild, and nobody backing up: it runs on past the stumps for overthrows.
    if (th.overthrow) {
      this.runOn(th, end, thrower, "overthrow");
      return;
    }

    if (th.shy && atRisk) {
      const hitChance = clamp(0.3 + 0.4 * f.player.field.throwAcc - th.dist / 90, 0.06, 0.6);
      if (rng.chance(hitChance)) {
        this.ball.atEnd = end;
        this.ball.held = -1;
        this.ball.vel = { x: 0, y: 0, z: 0 };
        this.runOut(atRisk, end, thrower, "direct hit");
        return;
      }
      // Missed: the ball runs on past the stumps.
      this.nearMiss = { shy: true };
      this.runOn(th, end, thrower, "missed the stumps");
      return;
    }

    this.ball.atEnd = end;
    this.ball.thrownIn = true;
    // Whoever is nearest the stumps takes the throw; if they aren't there yet they must run in.
    const spot = coverSpot(end);
    let receiver = null;
    let gap = Infinity;
    for (const x of this.fielders) {
      if (x.idx === thrower || x.state === "down" || x.state === "dive" || x.state === "getUp") continue;
      const d = Math.hypot(x.pos.x - spot.x, x.pos.z - spot.z);
      if (d < gap) {
        gap = d;
        receiver = x;
      }
    }
    // Seconds before the receiver can break the stumps.
    const getThere = receiver ? Math.max(0, gap - 1.2) / receiver.speed : 3;
    this.ball.held = receiver ? receiver.idx : -1;
    if (receiver) {
      receiver.target = spot;
      receiver.job = "cover";
      if (receiver.state !== "set") setState(receiver, "cover", this.t);
    }
    this.ball.vel = { x: 0, y: 0, z: 0 };
    this.emit("gather", { end });
    this.breakDelay = 0.28 + getThere;

    if (atRisk) {
      const hands = receiver
        ? receiver.role === "keeper"
          ? receiver.player.field.keeping
          : receiver.player.field.catching
        : 0.5;
      // Taking it on the run is harder than standing over the stumps.
      const onTheRun = 1 + Math.min(1, getThere);
      const fumbleChance = clamp((th.wild ? 0.35 : 0.12) * (1.4 - hands) * onTheRun, 0.03, 0.6);
      if (rng.chance(fumbleChance)) {
        this.breakDelay = getThere + rng.range(0.5, 1.2);
        this.emit("fumble", { fielder: receiver?.idx, end, text: "fumbled" });
      } else {
        this.breakDelay = getThere + rng.range(0.15, 0.45) + (th.wild ? rng.range(0.15, 0.45) : 0);
      }
      this.riskSince = this.t;
      this.idleSince = this.t;
      return;
    }

    this.idleSince = this.t;
    this.riskSince = null;
    // Nobody in danger here; if the other end is still open, relay the ball on.
    if (this.running && receiver) {
      const other = end === 0 ? 1 : 0;
      const safeIn = Math.min(...this.runners.map((r) => this.runnerTimeTo(r, other)));
      if (safeIn > 1.25 && safeIn !== Infinity) {
        this.ball.atEnd = null;
        this.pickupAt = this.t + 0.1 + getThere;
        setState(receiver, "hold", this.t);
        receiver.job = null;
      }
    }
  }

  /** A throw that got past the stumps (a missed shy, or wild with no one backing up) runs on. */
  runOn(th, end, thrower, text) {
    const rng = this.setup.rng;
    const dx = th.to.x - th.from.x;
    const dz = th.to.z - th.from.z;
    const len = Math.hypot(dx, dz) || 1;
    const speed = rng.range(7, 15);
    this.ball.atEnd = null;
    this.ball.held = -1;
    this.ball.bounced = true;
    this.ball.pos = { x: ENDS[end].x + rng.normal(0, 0.4), y: 0.3, z: ENDS[end].z };
    this.ball.vel = { x: (dx / len) * speed + rng.normal(0, 1.5), y: 0, z: (dz / len) * speed };
    this.riskSince = null;
    this.emit("misfield", { fielder: thrower, end, text });
    this.replan();
  }

  /** The batter who would be run out at `end` if the stumps were broken now. */
  riskRunner(end) {
    if (this.runners.some((r) => this.grounded(r, end))) return null;
    const moving = this.runners.filter((r) => r.target !== null);
    if (!moving.length) return null;
    moving.sort((a, b) => Math.abs(a.progress - end) - Math.abs(b.progress - end));
    return moving[0];
  }

  runOut(runner, end, fielderIdx, text = "") {
    const f = this.fielders[fielderIdx];
    this.emit("runout", { end, who: runner.bat, fielder: fielderIdx, text });
    this.endWithWicket({
      how: "runout",
      batter: runner.bat,
      fielder: f ? (f.role === "field" ? f.spot : f.role === "keeper" ? "the keeper" : "the bowler") : "",
    });
  }

  moveRunners(dt) {
    let wasRunning = false;
    for (const r of this.runners) {
      if (r.target === null || this.t < r.startAt) {
        if (r.target !== null) wasRunning = true;
        continue;
      }
      wasRunning = true;
      const dir = r.target === 1 ? 1 : -1;
      r.progress += (dir * r.speed * dt) / RUN_LENGTH;
      if ((dir > 0 && r.progress >= 1) || (dir < 0 && r.progress <= 0)) {
        r.progress = r.target;
        r.from = r.target;
        r.target = null;
      }
    }
    if (wasRunning && !this.running) {
      // Both made their ground: the run counts if they actually swapped ends.
      if (
        this.runStartFrom &&
        this.runners.every((r, i) => r.from !== this.runStartFrom[i]) &&
        (!this.dead || this.wicket === null)
      ) {
        this.runs++;
        this.emit("runDone");
      }
      this.runStartFrom = null;
      this.idleSince = this.t;
      this.misjudge = null;
    }
  }

  /** Computer-controlled running: go if the run beats the ball, turn back if it won't. */
  aiRun() {
    if (this.dead || this.wicket || this.boundary) return;
    const b = this.ball;
    const aggression = this.setup.aiAggression;
    if (this.running) {
      const r = this.runners[0];
      const done = r.target === 1 ? r.progress : 1 - r.progress;
      if (done < 0.4 && b.throwing) {
        const end = b.throwing.end;
        if (Math.min(...this.runners.map((x) => this.runnerTimeTo(x, end))) > b.throwing.t1 - this.t + 0.5) this.recall();
      }
      return;
    }
    if (this.plan?.kind === "catch" || this.predictedBoundary || b.atEnd !== null) return;

    // Estimated time until the ball could be back at either set of stumps.
    let ballBack = Infinity;
    const throwSpeed = 24;
    const returnTime = (pos, delay) =>
      Math.min(...[0, 1].map((e) => delay + 0.22 + Math.hypot(pos.x - ENDS[e].x, pos.z - ENDS[e].z) / throwSpeed + 0.18));
    if (b.throwing) ballBack = b.throwing.t1 - this.t;
    else if (b.held >= 0) ballBack = returnTime(this.fielders[b.held].pos, Math.max(0, this.pickupAt - this.t));
    else if (this.plan) ballBack = returnTime({ x: this.plan.point.x, z: this.plan.point.z }, this.plan.t - this.t + 0.35);

    const slowest = Math.min(...this.runners.map((r) => r.speed));
    const runTime = RUN_LENGTH / slowest + (this.runsAttempted === 0 ? 0.32 : 0.36);
    const safety = 0.85 - 0.6 * aggression;
    if (this.misjudge === null) {
      const running = (this.setup.striker.bat.running + this.setup.nonStriker.bat.running) / 2;
      // Pressure makes them hurry their calls.
      this.misjudge = this.setup.rng.normal(0, RUN_MISJUDGE * (1.3 - running) * (1 + 0.5 * (this.setup.pressure ?? 0)));
    }
    if (runTime + safety < ballBack + this.misjudge) this.requestRun();
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

  /** World position of a runner (striker runs on the leg side, non-striker on the off). */
  runnerPos(runner) {
    return { x: runner.bat === this.setup.strikerIdx ? -1.1 : 1.1, z: CREASE + runner.progress * RUN_LENGTH };
  }
}
