import { callFromBooth } from "./broadcast-commentary.js";
import { matchPad } from "./pad-bindings.js";
import { COLORS } from "../engine/screen.js";
import { load, save } from "../engine/storage.js";
import { Rng } from "../sim/rng.js";
import { isSpinner } from "../sim/teams.js";
import { createMatch } from "../sim/formats.js";
import { feetOf, contactFor } from "../sim/feet.js";
import { pickBowler } from "../sim/ai.js";
import { callDuration } from "../render/booth.js";
import { teamKit } from "../render/skins.js";
import { buildGround } from "../render/ground.js";
import { updateVenue, venueArt } from "./venue-view.js";
import { GROUNDS, DEFAULT_GROUND } from "../render/grounds.js";
import { setWideCamera } from "../render/camera.js";
import { drawMatch } from "./match-view.js";
import { updateMatch } from "./match-update.js";
import { drawTimed } from "./effects-auto.js";
import * as decisions from "./match-decisions.js";
import * as beats from "./booth-beats.js";
import { createFeedback } from "./match-feedback.js";
import * as input from "./match-input.js";
import * as ball from "./match-ball.js";
import { GROUND_WEAR_STEPS } from "./match-ball.js";
import * as flight from "./match-flight.js";
import * as setup from "./match-setup.js";
import { PauseMenu } from "./pause-menu.js";
import { controlsSetting } from "./bat-stick.js";
import { ScoreboardScene } from "./scoreboard.js";
import { resultEntry } from "../sim/leaderboard.js";
import * as ending from "./match-ending.js";
import * as test from "./match-test.js";
import { updateLight, ballKindFor } from "./match-light.js";
import { assistSetting, noteAssist } from "./assists.js";

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
 *   forecast     the weather report before play (and each morning of a Test): scenes/match-test.js
 *   rain         play stopped for rain: scenes/match-rain.js
 */
export class MatchScene {
  phase = "ready";
  phaseT = 0;
  now = 0;
  /** Camera mode chosen by the player (auto/close/wide) and the view actually shown. */
  /** The camera picks its own view (close for the delivery, wide when the ball's in the field). */
  cam = "auto";
  view = "close";
  /** State of the ball being bowled; null between balls when bowling. */
  cur = null;
  banners = [];
  commentary = "";
  /** The caller's call for the ball on the HUD line: { who, text, from, t0 } (scenes/booth-beats.js). */
  callLine = null;
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
    /** How much help the player gets (scenes/assists.js); the match keeps the easiest level used. */
    this.assist = assistSetting();
    noteAssist(this.match, this.assist);
    this.nets = this.match.nets;
    /** The ground's backgrounds, built from its data and the pitch (and rebuilt as it wears). */
    this.ground = GROUNDS[cfg.ground] ?? GROUNDS[DEFAULT_GROUND];
    setWideCamera(this.ground.wide.camera);
    // The time of day and the weather, with the effects this machine is set to (scenes/match-light.js).
    updateLight(this);
    /** A Test's red ball (pink if it goes on under lights), limited overs' white one (render/sprites.js drawBall). */
    this.ballKind = ballKindFor(cfg);
    this.buildGround();
    /** Nets: balls faced or bowled, and how many the coach rated good. */
    this.netsTally = { balls: 0, good: 0 };
    /** Nets: the coach's verdict on the last ball. */
    this.feedback = null;
    const inn = this.match.inn;
    // Whites for a Test, coloured kits for everything else.
    const coloured = cfg.format !== "test";
    this.kitBat = teamKit(inn.batTeam, coloured);
    this.kitBowl = teamKit(inn.bowlTeam, coloured);
    const pitch = inn.pitch.type;
    this.commentary = this.nets
      ? `Nets: ${this.human === "bat" ? "face as many as you like" : "bowl as many as you like"}. The coach rates every ball.`
      : inn.target !== null
        ? `${inn.batTeam.name} need ${inn.runsNeeded} to win off ${inn.ballsLeft} balls.`
        : `${inn.batTeam.name} to bat on a ${pitch.name.toLowerCase()}. ${pitch.blurb}`;
    // The weather report first, then the first ball (or the choice of bowler).
    this.nextBall();
  }

  endInnings() {
    return ending.endInnings(this);
  }

  /** How the innings (or match) ended, for the end screen (scenes/match-ending.js). */
  get ending() {
    return ending.endingOf(this);
  }

  /** Does this game's result go on a high-score table (a finished match or Classic Match)? */
  get hasScoreboard() {
    return ending.hasScoreboard(this);
  }

  /** The player's side declares (a Test: scenes/match-test.js). */
  declare() {
    return test.declare(this);
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

  /** Which on-screen buttons a touch screen shows (engine/touch.js), and what a gamepad's press: pause, bat or bowl. */
  get touchMode() {
    if (this.phase === "pause") return "menu";
    return this.human === "bat" && controlsSetting() === "stick" ? "batStick" : this.human;
  }
  get padBinding() {
    return matchPad(this);
  }

  get spinner() {
    return isSpinner(this.inn.bowler?.p.bowl);
  }

  /** (Re)build the ground's backgrounds for the pitch as it is now. */
  buildGround() {
    const pitch = this.inn.pitch;
    this.groundWear = Math.floor(pitch.wear * GROUND_WEAR_STEPS);
    this.groundArt = venueArt(this, pitch) ?? buildGround(this.ground, this.game.images, pitch, 1, this.light);
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

  /** The striker's hand for what's on screen (+1 right, -1 left): the ball being played, else who's in. */
  get facing() {
    return this.cur?.delivery?.facing ?? this.match.facing;
  }

  /**
   * Screen right in the striker's frame: -1 when the close camera looks from the bowler's end (the world
   * turned round), and turned again for a left-hander, so the arrows always move things the way they look.
   */
  get screenTurn() {
    return (this.view === "close" && this.closeEnd === "bowl" ? -1 : 1) * this.facing;
  }

  toggleCloseEnd() {
    this.game.closeEnd = this.closeEnd === "bat" ? "bowl" : "bat";
    save("closeEnd", this.game.closeEnd);
    this.flash(this.closeEnd === "bat" ? "VIEW: BEHIND THE BATTER" : "VIEW: BEHIND THE BOWLER");
  }

  update(dt) {
    updateVenue(this, dt);
    updateMatch(this, dt);
  }

  /** The innings is over and acknowledged: the next innings, the high scores, or the menu. `enforce`: the follow-on call. */
  leaveInnings(enforce) {
    if (this.match.hasNextInnings) {
      this.match.nextInnings(enforce);
      this.game.scene = new MatchScene(this.game, this.cfg, this.match);
    } else if (this.hasScoreboard) {
      this.game.scene = new ScoreboardScene(this.game, this.cfg, resultEntry(this.match));
    } else {
      this.game.toMenu();
    }
  }

  draw() {
    drawTimed(this, () => drawMatch(this));
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
    this.banners.push({ text, sub, color, t0: this.now, dur, scale: 4, y: 96 });
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

  release(releaseError, rhythm) {
    return ball.release(this, releaseError, rhythm);
  }

  /** Ball time at which the ball reaches the bat for a given shot (and, for defence, foot), or these feet (sim/feet.js). */
  arrival(shotType, foot = null, feet = null) {
    const d = this.cur.delivery;
    const legs = feet ?? feetOf({ type: shotType, foot }, d.pitchedAt?.z ?? 0);
    return contactFor(d, legs, this.inn.bat[this.inn.striker].p.bat.footwork).at?.t ?? 0.6;
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

  updateFootwork(dt) {
    return input.updateFootwork(this, dt);
  }

  commitSwing(t, type, power, feet, variant, lifted = false) {
    return input.commitSwing(this, t, type, power, feet, variant, lifted);
  }

  commitDefend(t, foot, feet) {
    return input.commitDefend(this, t, foot, feet);
  }

  commitLeave(feet) {
    return input.commitLeave(this, feet);
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
    return ball.coachFeedback(this, rec);
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
