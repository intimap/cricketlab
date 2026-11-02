import { callFromBooth } from "./broadcast-commentary.js";
import { updateReviewAudio } from "./match-audio.js";
import { REVIEW_END } from "../render/match-broadcast.js";
import { skipCelebration } from "./celebrations.js";
import { COLORS } from "../engine/screen.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { load, save } from "../engine/storage.js";
import { Rng } from "../sim/rng.js";
import { isSpinner } from "../sim/teams.js";
import { createMatch } from "../sim/formats.js";
import { crossingAtZ } from "../sim/delivery.js";
import { releaseError } from "../sim/runup.js";
import { battingFeedback, bowlingFeedback } from "../sim/coach.js";
import { CONTACT_Z_FRONT, CONTACT_Z_BACK, playsBack } from "../sim/batting.js";
import { pickBowler } from "../sim/ai.js";
import { makeKit } from "../render/sprites.js";
import { callDuration } from "../render/booth.js";
import { buildGround } from "../render/ground.js";
import { GROUNDS, DEFAULT_GROUND } from "../render/grounds.js";
import { LIGHTS } from "../render/light.js";
import { setWideCamera } from "../render/camera.js";
import { drawMatch } from "./match-view.js";
import * as decisions from "./match-decisions.js";
import * as beats from "./booth-beats.js";
import { createFeedback, stepFeedback } from "./match-feedback.js";
import * as input from "./match-input.js";
import * as ball from "./match-ball.js";
import { GROUND_WEAR_STEPS } from "./match-ball.js";
import * as flight from "./match-flight.js";
import * as setup from "./match-setup.js";
import { PauseMenu } from "./pause-menu.js";
import { ScoreboardScene } from "./scoreboard.js";
import { boardFor, resultEntry } from "../sim/leaderboard.js";

/**
 * One innings, played ball by ball. Phases:
 *   ready        (batting) waiting for Space to face up
 *   setup        (bowling) choosing delivery, line, length, effort, field
 *   chooseBowler (bowling) picking who bowls the next over
 *   runup        bowler running in
 *   flight       ball in the air / in play
 *   after        ball dead, showing the result
 *   return       fielders walking back
 *   overEnd, simSummary, fieldEdit, pause, inningsEnd
 */
export class MatchScene {
  phase = "ready";
  phaseT = 0;
  now = 0;
  /** Camera mode chosen by the player (auto/close/wide) and the view actually shown. */
  cam = "auto";
  view = "close";
  /** State of the ball being bowled; null between balls when bowling. */
  cur = null;
  banners = [];
  commentary = "";
  /** The commentary box's calls for the last ball: [{ who, text, t0 }], in speaking order. */
  booth = null;
  commT = 0;
  timeScale = 1;
  // Player's bowling choices.
  target = { line: 0.22, length: 6.5 };
  deliveryType = "outswing";
  effort = "med";
  selBowler = 0;
  simLines = [];
  /** Flying bails and stump splinters. */
  particles = [];
  walkOff = null;
  sledges = [];
  /** A close fielder's chirp after the bat is beaten: { text, t0 }. */
  chirp = null;
  dragIdx = -1;
  pausedFrom = "ready";
  pauseMenu = new PauseMenu();

  /** cfg: the menu choice (see createMatch); `match`: carry on an existing match into its next innings. */
  constructor(game, cfg, match = null) {
    this.game = game;
    this.cfg = cfg;
    this.match = match ?? createMatch(cfg, new Rng());
    this.human = this.match.human;
    this.nets = this.match.nets;
    /** The ground's backgrounds, built from its data and the pitch (and rebuilt as it wears). */
    this.ground = GROUNDS[cfg.ground] ?? GROUNDS[DEFAULT_GROUND];
    setWideCamera(this.ground.wide.camera);
    this.light = LIGHTS[cfg.light] ?? LIGHTS.midday;
    this.buildGround();
    /** Nets: balls faced or bowled, and how many the coach rated good. */
    this.netsTally = { balls: 0, good: 0 };
    /** Nets: the coach's verdict on the last ball. */
    this.feedback = null;
    const inn = this.match.inn;
    this.kitBat = makeKit(inn.batTeam.colour, inn.batTeam.colour2);
    this.kitBowl = makeKit(inn.bowlTeam.colour, inn.bowlTeam.colour2);
    const pitch = inn.pitch.type;
    this.commentary = this.nets
      ? `Nets: ${this.human === "bat" ? "face as many as you like" : "bowl as many as you like"}. The coach rates every ball.`
      : inn.target !== null
        ? `${inn.batTeam.name} need ${inn.runsNeeded} to win off ${inn.ballsLeft} balls.`
        : `${inn.batTeam.name} to bat on a ${pitch.name.toLowerCase()}. ${pitch.blurb}`;
    if (this.human === "bowl") {
      this.match.inn.setPreset("attacking");
      this.toChooseBowler();
    } else {
      this.nextBall();
    }
  }

  endInnings() {
    this.setPhase("inningsEnd");
    if (this.ending.good === true && this.cfg.format === "classic") {
      save("classicsWon", { ...load("classicsWon", {}), [this.cfg.classic]: true });
    }
    if (this.ending.good === true) sfx.cheer(1);
    else if (this.ending.good === false) sfx.groan();
  }

  /** How the innings (or match) ended, for the end screen: { title, sub, good?, next }. */
  get ending() {
    const match = this.match;
    const inn = this.inn;
    if (match.hasNextInnings) {
      return { title: "INNINGS BREAK", sub: `${inn.bowlTeam.name.toUpperCase()} NEED ${inn.runs + 1} TO WIN`, next: true };
    }
    const result = match.result;
    if (!result) return { title: inn.wkts >= 10 ? "ALL OUT" : "END OF SPELL", sub: `${inn.runs}/${inn.wkts}` };
    const humanSide = this.human === "bat" ? inn.batTeam : inn.bowlTeam;
    const good = result.winner === humanSide ? true : result.winner === null ? null : false;
    if (this.cfg.format === "classic") {
      return { title: good ? "CHALLENGE COMPLETE!" : "CHALLENGE FAILED", sub: result.text.toUpperCase(), good };
    }
    return {
      title: result.text.toUpperCase(),
      sub: good ? "WELL PLAYED!" : good === null ? "WHAT A FINISH!" : "BETTER LUCK NEXT TIME",
      good,
    };
  }

  /** Does this game's result go on a high-score table (a finished match or Classic Match)? */
  get hasScoreboard() {
    return !this.match.hasNextInnings && !!this.match.result && !!boardFor(this.cfg);
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseT = 0;
    if (phase === "runup") beats.onRunup(this);
  }

  get inn() {
    return this.match.inn;
  }

  /** Timing meter, floating words, hit-stop and eased bars (match-feedback.js). */
  juice = createFeedback();

  /** Counts up each ball, so on-screen toggles (POWER) switch off for the next one. */
  touchEpoch = 0;

  /** Which on-screen buttons a touch screen shows (engine/touch.js): the pause menu's, or batting or bowling. */
  get touchMode() {
    return this.phase === "pause" ? "menu" : this.human;
  }

  get spinner() {
    return isSpinner(this.inn.bowler?.p.bowl);
  }

  /** (Re)build the ground's backgrounds for the pitch as it is now. */
  buildGround() {
    const pitch = this.inn.pitch;
    this.groundWear = Math.floor(pitch.wear * GROUND_WEAR_STEPS);
    this.groundArt = buildGround(this.ground, this.game.images, pitch, 1, this.light);
  }

  nextBall() {
    return ball.nextBall(this);
  }

  newBall(intent, aiReleaseError) {
    return ball.newBall(this, intent, aiReleaseError);
  }

  toChooseBowler() {
    this.selBowler = pickBowler(this.inn);
    this.setPhase("chooseBowler");
  }

  /** Which end the close camera sits at: "bat" (behind the striker) or "bowl" (behind the bowler). Remembered. */
  get closeEnd() {
    return (this.game.closeEnd ??= load("closeEnd", "bat"));
  }

  /** -1 when the close camera looks from the bowler's end (screen left/right is the world turned round), else 1. */
  get screenTurn() {
    return this.view === "close" && this.closeEnd === "bowl" ? -1 : 1;
  }

  toggleCloseEnd() {
    this.game.closeEnd = this.closeEnd === "bat" ? "bowl" : "bat";
    save("closeEnd", this.game.closeEnd);
    this.flash(this.closeEnd === "bat" ? "VIEW: BEHIND THE BATTER" : "VIEW: BEHIND THE BOWLER");
  }

  update(dt) {
    this.now += dt;
    const striker = this.inn.bat[this.inn.striker];
    stepFeedback(this.juice, this.now, dt, this.human === "bat" && striker ? striker.eye : null, this.inn.pressure);
    this.phaseT += dt;
    this.commT += dt;

    if (this.phase === "pause") {
      const action = this.pauseMenu.update();
      if (action === "view") this.toggleCloseEnd();
      if (action === "resume") this.setPhase(this.pausedFrom);
      else if (action === "quit") this.game.toMenu();
      return;
    }
    if (keys.pressed("Escape") && this.phase !== "inningsEnd" && this.phase !== "fieldEdit") {
      this.pausedFrom = this.phase;
      this.pauseMenu.open();
      this.setPhase("pause");
      return;
    }
    if (keys.pressed("KeyC")) {
      this.cam = this.cam === "auto" ? "close" : this.cam === "close" ? "wide" : "auto";
      this.flash(`CAMERA: ${this.cam.toUpperCase()}`);
      if (this.cam !== "auto") this.view = this.cam;
    }
    if (keys.pressed("KeyB")) this.toggleCloseEnd();

    switch (this.phase) {
      case "ready":
        this.updateFootwork(dt);
        this.updateReady();
        break;
      case "setup":
        this.updateSetup();
        break;
      case "runup":
        this.updateFootwork(dt);
        this.updateRunup(dt);
        this.updateBatInput();
        break;
      case "flight":
        this.updateFootwork(dt);
        this.updateFlight(dt);
        if (this.human === "bowl" && keys.pressed("KeyH")) this.appeal();
        break;
      case "appeal":
        // A moment to shout after the ball is dead.
        if (keys.pressed("KeyH")) this.appeal();
        if (this.cur.appealed || this.phaseT > 1.1) this.decideLbw();
        break;
      case "decision":
        this.updateDecision();
        break;
      case "review":
        updateReviewAudio(this);
        if (this.phaseT > REVIEW_END) this.endReview();
        break;
      case "after": {
        this.updateFlight(dt);
        if (skipCelebration(this)) break;
        const wicket = !!this.cur?.done?.rec.wicket;
        if (this.nets) {
          // Take your time over the coach's verdict.
          if (this.phaseT > 0.6 && (keys.pressed("Space") || keys.pressed("Enter"))) this.setPhase("return");
          break;
        }
        if (wicket && this.cam === "auto" && this.phaseT > 1) this.view = "wide";
        if (this.phaseT > this.afterDuration()) this.setPhase("return");
        break;
      }
      case "return":
        this.updateReturn(dt);
        break;
      case "overEnd":
        // Finish the recap before changing ends, unless the player moves on.
        if ((this.phaseT > 2.4 && this.now >= this.boothEndsAt()) || keys.pressed("Space") || keys.pressed("Enter"))
          this.nextBall();
        break;
      case "chooseBowler":
        this.updateChooseBowler();
        break;
      case "simSummary":
        if (this.phaseT > 0.4 && (keys.pressed("Space") || keys.pressed("Enter"))) this.nextBall();
        break;
      case "fieldEdit":
        this.updateFieldEdit();
        break;
      case "inningsEnd":
        if (this.phaseT > 0.8 && (keys.pressed("Enter") || keys.pressed("Space"))) {
          if (this.match.hasNextInnings) {
            this.match.nextInnings();
            this.game.scene = new MatchScene(this.game, this.cfg, this.match);
          } else if (this.hasScoreboard) {
            this.game.scene = new ScoreboardScene(this.game, this.cfg, resultEntry(this.match));
          } else {
            this.game.toMenu();
          }
        }
        break;
    }

    this.banners = this.banners.filter((b) => this.now - b.t0 < b.dur);
    for (const p of this.particles) {
      p.vy -= 9.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt;
      if (p.y < 0) {
        p.y = 0;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw() {
    drawMatch(this);
  }

  banner(text, color, dur, scale, y, t0 = this.now) {
    this.banners.push({ text, color, t0, dur, scale, y });
  }

  /** Small notice near the top of the screen. */
  flash(text, color = COLORS.cream) {
    this.banner(text, color, 1, 2, 40);
  }

  /** Big centre-screen announcement. */
  big(text, color, sub, dur = 1.8) {
    this.banners.push({ text, sub, color, t0: this.now, dur, scale: 5, y: 96 });
  }

  betweenBalls() {
    return setup.betweenBalls(this);
  }

  updateReady() {
    return setup.updateReady(this);
  }

  updateSetup() {
    return setup.updateSetup(this);
  }

  cyclePreset() {
    return setup.cyclePreset(this);
  }

  updateChooseBowler() {
    return setup.updateChooseBowler(this);
  }

  updateFieldEdit() {
    return setup.updateFieldEdit(this);
  }

  updateRunup(dt) {
    return input.updateRunup(this, dt);
  }

  release(releaseError) {
    return ball.release(this, releaseError);
  }

  /** Ball time at which the ball reaches the bat for a given shot (and, for defence, foot). */
  arrival(shotType, foot = null) {
    const d = this.cur.delivery;
    const back = playsBack(shotType, foot, d.pitchedAt?.z ?? 0);
    return crossingAtZ(d.samples, back ? CONTACT_Z_BACK : CONTACT_Z_FRONT)?.t ?? 0.6;
  }

  /** Ball time, counting negative through the end of the run-up. */
  clock() {
    const cur = this.cur;
    return cur.delivery ? cur.t : cur.tRun - cur.runupDur;
  }

  // The player's batting controls: see match-input.js.
  updateBatInput() {
    return input.updateBatInput(this);
  }

  shotVariant(type) {
    return input.shotVariant(this, type);
  }

  updateFootwork(dt) {
    return input.updateFootwork(this, dt);
  }

  commitSwing(t, type, power) {
    return input.commitSwing(this, t, type, power);
  }

  commitDefend(t, foot) {
    return input.commitDefend(this, t, foot);
  }

  commitLeave() {
    return input.commitLeave(this);
  }

  updateFlight(dt) {
    return flight.updateFlight(this, dt);
  }

  runDirection(live) {
    return flight.runDirection(this, live);
  }

  runCommand(live, end) {
    return flight.runCommand(this, live, end);
  }

  handleEvents(events) {
    return flight.handleEvents(this, events);
  }

  knockStumps(z, wide = false) {
    return flight.knockStumps(this, z, wide);
  }

  ballDead() {
    return ball.ballDead(this);
  }

  // Appeals, the umpire and reviews: see match-decisions.js.
  appeal() {
    return decisions.appeal(this);
  }

  decideLbw() {
    return decisions.decideLbw(this);
  }

  updateDecision() {
    return decisions.updateDecision(this);
  }

  get reviewTimeLeft() {
    return decisions.reviewTimeLeft(this);
  }

  startReview(side) {
    return decisions.startReview(this, side);
  }

  endReview() {
    return decisions.endReview(this);
  }

  endDecision() {
    return decisions.endDecision(this);
  }

  completeBall() {
    return ball.completeBall(this);
  }

  flashEye({ before, after }) {
    return ball.flashEye(this, { before, after });
  }

  /** When the last scheduled commentary call comes off air. */
  boothEndsAt() {
    if (!this.booth?.length) return this.now;
    const last = this.booth[this.booth.length - 1];
    const end = last.t0 + callDuration(last);
    return Number.isFinite(end) ? end : this.now;
  }

  /** Who in the commentary box calls this ball, and what they say (one or two voices). */
  callFromBooth(done) {
    return callFromBooth(this, done);
  }

  /** The nets coach's verdict on the ball just finished. */
  coachFeedback(rec) {
    const cur = this.cur;
    const spinner = this.spinner;
    if (this.human === "bat") return battingFeedback({ delivery: cur.delivery, shot: cur.shot, rec, spinner });
    const r = cur.runup;
    const err = r && cur.releaseMark != null ? releaseError(r, cur.releaseMark) : 0;
    const perfect = !!r && Math.abs(err) <= r.zone;
    return bowlingFeedback({ delivery: cur.delivery, intent: cur.intent, releaseError: err, perfect, rec, spinner });
  }

  afterDuration() {
    return ball.afterDuration(this);
  }

  updateReturn(dt) {
    return ball.updateReturn(this, dt);
  }

  simulate(overs) {
    return ball.simulate(this, overs);
  }
}
