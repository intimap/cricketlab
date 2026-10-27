import { clamp } from "../math.js";
import { BOUNDARY, ENDS, GRAVITY, RUN_LENGTH, PITCH_LENGTH, CREASE, distFromCentre } from "./geometry.js";
import { keeperSpot } from "./field.js";

/** How badly computer batters misjudge a run (seconds, standard deviation, for an average runner). */
const RUN_MISJUDGE = 0.36;

/** Fielder acceleration (m/s^2). */
const FIELDER_ACCEL = 5.5;

/** Distance covered in time t from a standing start, accelerating to topSpeed. */
function runDistance(t, topSpeed) {
  const tTop = topSpeed / FIELDER_ACCEL;
  return t < tTop ? 0.5 * FIELDER_ACCEL * t * t : 0.5 * topSpeed * tTop + topSpeed * (t - tTop);
}

/** Where the keeper (end 0) or bowler (end 1) stands to take a throw at the stumps. */
const coverSpot = (end) => ({ x: ENDS[end].x + 0.4, z: ENDS[end].z + (end === 0 ? -0.6 : 0.6) });

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
 *          keeper, bowler, spinner, outfield, noBall, freeHit, wide, aiRunning,
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
      throwing: null,
    };

    const addFielder = (player, role, spot, home) =>
      this.fielders.push({
        idx: this.fielders.length,
        player,
        role,
        spot,
        home: { ...home },
        pos: { ...home },
        target: null,
        state: "idle",
        busyUntil: 0,
        speed: 6 + 2 * player.field.speed,
        react: role === "keeper" ? 0.05 : role === "bowler" ? 0.55 : 0.16 + 0.16 * (1 - player.field.reflexes),
        stateAt: 0,
        curSpeed: 0,
      });
    addFielder(setup.keeper, "keeper", "wicketkeeper", keeperSpot(setup.spinner));
    addFielder(setup.bowler, "bowler", "bowler", { x: 0.9, z: 16.8 });
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
   * Predict the ball's path and pick the fielder who can get to it first
   * (to catch, stop or, failing that, pick it up), plus a backup fielder.
   */
  replan() {
    const path = this.forecast();
    const { res } = this.setup;
    let best = null;
    this.boundaryAt = null;
    this.predictedBoundary = false;
    for (const p of path) {
      if (p.out) {
        this.boundaryAt = p.t;
        break;
      }
    }

    for (const f of this.fielders) {
      if (f.state === "down") continue;
      const startAt = Math.max(this.t, f.busyUntil) + f.react;
      const reachBonus = f.role === "keeper" ? 1.5 : 1;
      let dive = null;
      for (const p of path) {
        if ((this.boundaryAt !== null && p.t >= this.boundaryAt) || (best && p.t >= best.t)) break;
        const travelled = Math.hypot(p.x - this.origin.x, p.z - this.origin.z);
        const catchable = res.touchedBat && !p.bounced && p.y > 0.12 && p.y < 2.7 && travelled > 2.2;
        const fieldable = p.y < (f.role === "keeper" ? 2.4 : 2.1);
        if (!catchable && !fieldable) continue;
        const dist = Math.hypot(f.pos.x - p.x, f.pos.z - p.z);
        const covered = runDistance(Math.max(0, p.t - startAt), f.speed);
        const reach = catchable ? (f.role === "keeper" ? 1.2 : 0.95) : reachBonus;
        const kind = catchable ? "catch" : res.touchedBat || res.padHit ? "stop" : f.role === "keeper" ? "collect" : "stop";
        const option = { fielder: f.idx, t: p.t, point: { x: p.x, y: p.y, z: p.z }, kind, dive: false, ballSpeed: p.v };
        if (dist <= reach + covered) {
          best = option;
          dive = null;
          break;
        }
        if (!dive && dist <= reach + covered + 1 && p.t - startAt > 0) dive = { ...option, dive: true };
      }
      if (dive && (!best || dive.t < best.t) && best?.fielder !== f.idx) best = dive;
    }

    if (!best) {
      // Nobody can intercept: whoever is quickest goes to where it stops (or the rope).
      const end = this.boundaryAt !== null ? path.find((p) => p.t >= this.boundaryAt) : path[path.length - 1];
      this.predictedBoundary = this.boundaryAt !== null;
      let fastest = -1;
      let fastestTime = 1e9;
      for (const f of this.fielders) {
        if (f.role === "keeper" && this.predictedBoundary) continue;
        const time = Math.hypot(f.pos.x - end.x, f.pos.z - end.z) / f.speed;
        if (time < fastestTime) {
          fastestTime = time;
          fastest = f.idx;
        }
      }
      if (fastest >= 0) {
        const f = this.fielders[fastest];
        best = {
          fielder: fastest,
          t: Math.max(this.t + f.react + fastestTime, end.t),
          point: { x: end.x, y: 0, z: end.z },
          kind: "pickup",
          dive: false,
          ballSpeed: 0,
        };
      }
    }

    this.plan = best;
    for (const f of this.fielders) {
      if (f.state === "chase" || f.state === "backup") {
        f.state = "idle";
        f.target = null;
      }
    }
    // Keeper and bowler get back to their stumps to take a throw, unless they're chasing.
    for (const f of this.fielders) {
      if ((f.role !== "keeper" && f.role !== "bowler") || f.idx === best?.fielder) continue;
      if (f.state !== "idle" && f.state !== "cover") continue;
      f.state = "cover";
      f.target = coverSpot(f.role === "keeper" ? 0 : 1);
    }
    if (!best) return;

    const chaser = this.fielders[best.fielder];
    chaser.state = "chase";
    chaser.target = { x: best.point.x, z: best.point.z };
    chaser.stateAt = this.t;

    let nearest = -1;
    let nearestDist = 1e9;
    for (const f of this.fielders) {
      if (f.idx === chaser.idx || f.role !== "field") continue;
      const dist = Math.hypot(f.pos.x - best.point.x, f.pos.z - best.point.z);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = f.idx;
      }
    }
    if (nearest >= 0 && nearestDist < 40) {
      const f = this.fielders[nearest];
      f.state = "backup";
      const to = { x: best.point.x - f.pos.x, z: best.point.z - f.pos.z };
      const k = Math.max(0, (nearestDist - 6) / nearestDist);
      f.target = { x: f.pos.x + to.x * k, z: f.pos.z + to.z * k };
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
      if (stumps && Math.hypot(holder.pos.x - stumps.x, holder.pos.z - stumps.z) > 1.5)
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
    if (plan.dive) {
      f.state = "dive";
      f.stateAt = this.t;
      this.emit("dive", { fielder: f.idx });
    }

    if (plan.kind === "catch") {
      const hands = f.role === "keeper" ? (skill.keeping + skill.catching) / 2 : skill.catching;
      const pace = clamp((plan.ballSpeed - 18) / 25) * 0.3;
      const chance = clamp(
        0.55 + 0.42 * hands - pace - (plan.dive ? 0.32 : 0) - (plan.point.y > 2.2 || plan.point.y < 0.25 ? 0.1 : 0),
        0.05,
        0.985,
      );
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
      if (plan.dive) {
        f.state = "down";
        f.stateAt = this.t;
      }
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
        if (plan.dive) {
          f.state = "down";
          f.stateAt = this.t;
        }
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
          this.breakDelay = 0.28 + dist / 22;
          this.idleSince = this.t;
          return;
        }
      }
      this.pickupAt = this.t + (plan.dive ? 0.75 : 0.35);
    }
  }

  /** Seconds until `runner` is safely in at `end` (Infinity if not heading there). */
  runnerTimeTo(runner, end) {
    if (runner.target === null) return runner.from === end ? 0 : Infinity;
    if (runner.target !== end) return Infinity;
    const dist = Math.abs((end === 1 ? 1 : 0) - runner.progress) * RUN_LENGTH;
    return Math.max(0, runner.startAt - this.t) + dist / runner.speed;
  }

  /** Throw to whichever end gives the best run-out chance (or the safe end). */
  throwBall(f) {
    const rng = this.setup.rng;
    const throwSpeed = 19 + 11 * f.player.field.arm;
    let end = 0;
    let bestMargin = -1e9;
    const arrival = [0, 1].map((e) => {
      const dist = Math.hypot(f.pos.x - ENDS[e].x, f.pos.z - ENDS[e].z);
      return this.t + 0.22 + dist / throwSpeed + 0.18;
    });
    for (const e of [0, 1]) {
      const times = this.runners.map((r) => this.runnerTimeTo(r, e));
      const safeIn = Math.min(...times);
      if (safeIn === 0) continue;
      const margin = (safeIn === Infinity ? 5 : safeIn) - (arrival[e] - this.t);
      if (this.running && margin > bestMargin) {
        bestMargin = margin;
        end = e;
      }
    }
    if (!this.running || bestMargin < -0.25) {
      const toStriker = Math.hypot(f.pos.x, f.pos.z);
      end = Math.hypot(f.pos.x, f.pos.z - PITCH_LENGTH) < toStriker * 0.55 ? 1 : 0;
      if (f.role === "keeper") end = 1;
    }
    // Keeper and bowler don't throw to their own end.
    if ((end === 0 && f.role === "keeper") || (end === 1 && f.role === "bowler")) end = end === 0 ? 1 : 0;

    let arriveAt = arrival[end];
    const wild = !rng.chance(0.8 + 0.18 * f.player.field.throwAcc);
    if (wild) arriveAt += rng.range(0.3, 0.9);
    const dist = Math.hypot(f.pos.x - ENDS[end].x, f.pos.z - ENDS[end].z);
    const chance = this.running && bestMargin > -0.25;
    const shyOdds = (dist < 20 ? 0.7 : dist < 35 ? 0.45 : dist < 50 ? 0.2 : 0.05) * (bestMargin > 2.5 ? 0.6 : 1);
    // A shy at the stumps: quicker, but may miss.
    const shy = chance && f.role === "field" && !wild && rng.chance(shyOdds);
    if (shy) arriveAt -= 0.06;

    this.ball.throwing = {
      from: { x: f.pos.x, y: 1.6, z: f.pos.z },
      to: {
        x: ENDS[end].x + (shy ? 0 : 0.3),
        y: shy ? 0.4 : 0.6,
        z: ENDS[end].z - (shy ? 0 : end === 0 ? 0.4 : -0.4),
      },
      t0: this.t + 0.22,
      t1: arriveAt - 0.12,
      end,
      fielder: f.idx,
      shy,
      wild,
      dist,
    };
    this.ball.held = -1;
    f.state = "throw";
    f.stateAt = this.t;
    this.emit("throw", { fielder: f.idx, end, text: wild ? "wild" : shy ? "shy" : "" });
  }

  arriveAtEnd(end, thrower) {
    const th = this.ball.throwing;
    this.ball.throwing = null;
    const rng = this.setup.rng;
    const f = this.fielders[thrower];
    const atRisk = this.riskRunner(end);

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
      this.emit("misfield", { fielder: thrower, end, text: "missed the stumps" });
      this.replan();
      return;
    }

    this.ball.atEnd = end;
    // Whoever is nearest the stumps takes the throw; if they aren't there yet they must run in.
    const spot = coverSpot(end);
    let receiver = null;
    let gap = Infinity;
    for (const x of this.fielders) {
      if (x.idx === thrower || x.state === "down" || x.state === "dive") continue;
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
      receiver.state = "cover";
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
        receiver.state = "hold";
      }
    }
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
      this.misjudge = this.setup.rng.normal(0, RUN_MISJUDGE * (1.3 - running) * (1 + (this.setup.pressure ?? 0)));
    }
    if (runTime + safety < ballBack + this.misjudge) this.requestRun();
  }

  moveFielders(dt) {
    for (const f of this.fielders) {
      if (f.state === "dive" && this.t - f.stateAt > 0.5) f.state = "down";
      if (f.state === "down" && this.t - f.stateAt > 1) f.state = "idle";
      if (
        !f.target ||
        this.t < Math.max(f.busyUntil, f.state === "chase" ? f.stateAt + f.react : 0) ||
        f.state === "hold" ||
        f.state === "down" ||
        f.state === "dive" ||
        f.state === "celebrate"
      ) {
        continue;
      }
      const dx = f.target.x - f.pos.x;
      const dz = f.target.z - f.pos.z;
      const dist = Math.hypot(dx, dz);
      const top = f.state === "backup" ? f.speed * 0.7 : f.speed;
      if (dist < 0.05) {
        f.curSpeed = 0;
        continue;
      }
      f.curSpeed = Math.min(top, f.curSpeed + FIELDER_ACCEL * dt);
      const step = Math.min(dist, f.curSpeed * dt);
      f.pos.x += (dx / dist) * step;
      f.pos.z += (dz / dist) * step;
    }
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
      strikerEnd: striker.from,
    };
  }

  /** World position of a runner (striker runs on the leg side, non-striker on the off). */
  runnerPos(runner) {
    return { x: runner.bat === this.setup.strikerIdx ? -1.1 : 1.1, z: CREASE + runner.progress * RUN_LENGTH };
  }
}
