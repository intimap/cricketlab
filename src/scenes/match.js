import { COLORS } from "../engine/screen.js";
import { keys, mouse, arrowBearing } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { load, save } from "../engine/storage.js";
import { clamp } from "../math.js";
import { Rng } from "../sim/rng.js";
import { isSpinner } from "../sim/teams.js";
import { createMatch } from "../sim/formats.js";
import { PITCH_LENGTH } from "../sim/geometry.js";
import { EFFORTS, crossingAtZ } from "../sim/delivery.js";
import { planRunup, meterPos, releaseError, METER_FROM } from "../sim/runup.js";
import { CONTACT_Z_FRONT, CONTACT_Z_BACK, SWING_TIME, NORMAL_CHARGE } from "../sim/batting.js";
import { PRESET_ORDER, PRESET_LABELS, positionName, clampFieldPosition } from "../sim/field.js";
import { pickBowler } from "../sim/ai.js";
import { pickSledges, pickChirp } from "../sim/commentary.js";
import { boothCall } from "../sim/commentators.js";
import { makeKit } from "../render/sprites.js";
import { scheduleCalls } from "../render/booth.js";
import { projectWide, unprojectWide } from "../render/camera.js";
import { drawMatch } from "./match-view.js";
import { PauseMenu } from "./pause-menu.js";

/** Backlift before the downswing, normal and power shots. */
const BACKLIFT_TIME = 0.07;
const POWER_BACKLIFT_TIME = 0.2;
const POWER_CHARGE = 0.95;
/** The player's timing window is wider than the AI's. */
const PLAYER_TIMING_WINDOW = 1.35;
/** Ball time runs slower while the player is waiting to play a shot. */
const PLAYER_SLOWMO = 0.8;
const SHOT_KEYS = { KeyS: "drive", KeyQ: "cutpull", KeyW: "loft" };
/** How long the scene lingers after a wicket. */
const WICKET_PAUSE = 6.5;
const MAX_SLEDGES = 3;
const SLEDGE_GAP = 1.5;
/** Seconds of holding left/right in the run-up for full aftertouch. */
const AFTERTOUCH_BUILD = 0.5;

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
    const inn = this.match.inn;
    this.kitBat = makeKit(inn.batTeam.colour, inn.batTeam.colour2);
    this.kitBowl = makeKit(inn.bowlTeam.colour, inn.bowlTeam.colour2);
    const pitch = inn.pitch.type;
    this.commentary =
      inn.target !== null
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

  setPhase(phase) {
    this.phase = phase;
    this.phaseT = 0;
  }

  get inn() {
    return this.match.inn;
  }

  get spinner() {
    return isSpinner(this.inn.bowler?.p.bowl);
  }

  nextBall() {
    const inn = this.inn;
    if (inn.isOver) {
      this.endInnings();
      return;
    }
    if (this.match.needOver) {
      if (this.human === "bowl") {
        this.toChooseBowler();
        return;
      }
      this.match.startOver();
    }
    this.particles = [];
    this.walkOff = null;
    this.sledges = [];
    this.timeScale = 1;
    if (this.cam === "auto") this.view = "close";
    if (inn.freeHit) this.big("FREE HIT", COLORS.gold, "THE BATTER CAN ONLY BE RUN OUT", 1.6);
    if (this.human === "bat") {
      const { intent, releaseError } = this.match.aiPlan();
      this.cur = this.newBall(intent, releaseError);
      this.setPhase("ready");
    } else {
      const skills = inn.bowler.p.bowl;
      if (!skills.repertoire.includes(this.deliveryType)) this.deliveryType = skills.repertoire[0];
      this.cur = null;
      this.setPhase("setup");
    }
  }

  newBall(intent, aiReleaseError) {
    const spinner = this.spinner;
    const style = this.inn.bowler.p.bowl.style;
    // The player's run-up varies ball to ball (see runup.js); the AI's is steady.
    const runup = this.human === "bowl" ? planRunup(style, intent.effort, this.inn.bowler.stamina) : null;
    return {
      intent,
      aiReleaseError,
      runup,
      runupDur: runup ? runup.dur : spinner ? 1.5 : style === "fast" ? 2.5 : 2.2,
      runupStartZ: spinner ? 25.5 : 33,
      /** Time since the run-up started. */
      tRun: 0,
      delivery: null,
      /** Ball time since release. */
      t: 0,
      shot: null,
      play: null,
      // Striker animation timeline (ball time).
      swingType: null,
      backliftAt: 0,
      swingAt: null,
      defendAt: null,
      leaveAt: null,
      contactDone: false,
      bounceDone: false,
      strikeAt: null,
      done: null,
      /** Index of the next live-ball event to handle. */
      lastEv: 0,
      lineAtBat: 0,
    };
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
        this.updateReady();
        break;
      case "setup":
        this.updateSetup();
        break;
      case "runup":
        this.updateRunup(dt);
        this.updateBatInput();
        break;
      case "flight":
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
        if (this.phaseT > 3.4 || (this.phaseT > 1.2 && keys.pressed("Space"))) this.endReview();
        break;
      case "after": {
        this.updateFlight(dt);
        const wicket = !!this.cur?.done?.rec.wicket;
        if (wicket && this.cam === "auto" && this.phaseT > 1) this.view = "wide";
        if (this.phaseT > this.afterDuration() || (wicket && this.phaseT > 2.5 && keys.pressed("Space"))) this.setPhase("return");
        break;
      }
      case "return":
        this.updateReturn(dt);
        break;
      case "overEnd":
        if (this.phaseT > 2.4 || keys.pressed("Space") || keys.pressed("Enter")) this.nextBall();
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

  /** Keys available between balls: simulate, or look at the field. */
  betweenBalls() {
    if (keys.pressed("KeyO")) {
      this.simulate(1);
      return true;
    }
    if (keys.pressed("KeyP")) {
      this.simulate(5);
      return true;
    }
    if (keys.pressed("KeyV")) {
      this.setPhase("fieldEdit");
      this.view = "wide";
      return true;
    }
    return false;
  }

  updateReady() {
    if (this.betweenBalls()) return;
    if (this.phaseT > 0.25 && keys.pressed("Space")) this.setPhase("runup");
  }

  updateSetup() {
    if (this.betweenBalls()) return;
    const skills = this.inn.bowler.p.bowl;
    const step = keys.down("ShiftLeft") || keys.down("ShiftRight") ? 0.25 : 1;
    // Arrows move the crosshair the way you press on screen, whichever end the camera is at.
    const turned = this.screenTurn;
    if (keys.pressed("ArrowLeft")) this.target.line -= 0.05 * step * turned;
    if (keys.pressed("ArrowRight")) this.target.line += 0.05 * step * turned;
    if (keys.pressed("ArrowUp")) this.target.length += 0.5 * step * turned;
    if (keys.pressed("ArrowDown")) this.target.length -= 0.5 * step * turned;
    this.target.line = clamp(this.target.line, -0.9, 1.1);
    this.target.length = clamp(this.target.length, 0.5, 12.5);
    for (let i = 0; i < skills.repertoire.length; i++) {
      if (keys.pressed(`Digit${i + 1}`)) {
        this.deliveryType = skills.repertoire[i];
        sfx.click();
      }
    }
    if (keys.pressed("KeyE")) {
      this.effort = EFFORTS[(EFFORTS.indexOf(this.effort) + 1) % 3];
      sfx.click();
    }
    if (keys.pressed("KeyF")) {
      this.cyclePreset();
      this.flash(`FIELD: ${PRESET_LABELS[this.inn.preset]}`);
    }
    if (keys.pressed("KeyN") && this.inn.newBallAvailable) {
      this.inn.takeNewBall();
      this.big("NEW BALL", COLORS.red, undefined, 1.2);
    }
    if (keys.pressed("Space")) {
      const intent = { type: this.deliveryType, line: this.target.line, length: this.target.length, effort: this.effort };
      this.cur = this.newBall(intent, 0);
      this.setPhase("runup");
    }
  }

  cyclePreset() {
    const i = PRESET_ORDER.indexOf(this.inn.preset);
    this.inn.setPreset(PRESET_ORDER[(i + 1) % PRESET_ORDER.length]);
  }

  updateChooseBowler() {
    const inn = this.inn;
    const count = inn.bowl.length;
    if (keys.pressed("ArrowUp")) this.selBowler = (this.selBowler + count - 1) % count;
    if (keys.pressed("ArrowDown")) this.selBowler = (this.selBowler + 1) % count;
    for (let i = 0; i < count; i++) {
      if (keys.pressed(`Digit${i + 1}`)) this.selBowler = i;
    }
    if ((keys.pressed("Enter") || keys.pressed("Space")) && inn.canBowl(this.selBowler)) {
      this.match.startOver(this.selBowler);
      const skills = inn.bowler.p.bowl;
      this.deliveryType = skills.repertoire[0];
      if (isSpinner(skills)) {
        this.target = { line: 0.25, length: 5.4 };
        if (!inn.customField) inn.setPreset("spin");
      } else {
        this.target = { line: 0.22, length: 6.4 };
        if (inn.preset === "spin" && !inn.customField) inn.setPreset("attacking");
      }
      this.nextBall();
    }
  }

  updateFieldEdit() {
    const inn = this.inn;
    if (keys.pressed("KeyF") && this.human === "bowl") this.cyclePreset();
    if (this.human === "bowl") {
      if (mouse.pressed) {
        // Grab the nearest fielder within 12px.
        let nearest = -1;
        let best = 12;
        inn.placements.forEach((place, i) => {
          const p = projectWide(place.pos.x, 0, place.pos.z);
          const dist = Math.hypot(p.x - mouse.x, p.y - 4 - mouse.y);
          if (dist < best) {
            best = dist;
            nearest = i;
          }
        });
        this.dragIdx = nearest;
      }
      if (mouse.down && this.dragIdx >= 0) {
        const pos = clampFieldPosition(unprojectWide(mouse.x, mouse.y));
        inn.placements[this.dragIdx] = { name: positionName(pos), pos };
        inn.customField = true;
      }
      if (mouse.released) this.dragIdx = -1;
    }
    if (keys.pressed("KeyV") || keys.pressed("Enter") || keys.pressed("Escape")) {
      this.view = this.cam === "wide" ? "wide" : "close";
      this.setPhase(this.human === "bowl" ? "setup" : "ready");
    }
  }

  updateRunup(dt) {
    const cur = this.cur;
    cur.tRun += dt;
    if (this.human === "bowl") {
      // Aftertouch: hold left or right through the run-up for extra swing or spin that way.
      const held = (keys.down("ArrowRight") ? 1 : 0) - (keys.down("ArrowLeft") ? 1 : 0);
      if (held && cur.tRun > cur.runupDur * 0.3) {
        cur.aftertouch = clamp((cur.aftertouch ?? 0) + (held * this.screenTurn * dt) / AFTERTOUCH_BUILD, -1, 1);
      }
      // Release on Space: early drops it short, late drags it full, very late is a no-ball.
      const r = cur.runup;
      const pos = meterPos(r, cur.tRun);
      if (keys.pressed("Space") && pos > METER_FROM) {
        const stamina = this.inn.bowler.stamina;
        let err = releaseError(r, pos);
        cur.releaseMark = pos;
        // Inside the gold zone the release is perfect; outside it, fatigue makes it worse.
        if (Math.abs(err) <= r.zone) {
          err = 0;
          this.flash("PERFECT RELEASE", COLORS.gold);
        } else {
          err *= 1.3 - 0.3 * stamina;
        }
        this.release(clamp(err, -0.35, 0.3));
      } else if (releaseError(r, pos) > 0.17) {
        cur.releaseMark = pos;
        this.release(0.17 + Math.random() * 0.03);
      }
    } else if (cur.tRun >= cur.runupDur + clamp(cur.aiReleaseError, -0.08, 0.08)) {
      this.release(cur.aiReleaseError);
    }
  }

  release(releaseError) {
    const cur = this.cur;
    if (cur.aftertouch) cur.intent = { ...cur.intent, aftertouch: cur.aftertouch };
    cur.delivery = this.match.deliver(cur.intent, releaseError);
    cur.t = 0;
    const atBat = crossingAtZ(cur.delivery.samples, CONTACT_Z_FRONT);
    cur.lineAtBat = atBat ? atBat.x : 0;
    if (this.human === "bowl") {
      // The AI batter's shot is decided now; schedule its animation.
      const shot = this.match.aiShot(cur.delivery);
      cur.shot = shot;
      cur.play = this.match.resolve(cur.intent, cur.delivery, shot);
      const arrive = this.arrival(shot.type);
      if (shot.type === "defend") cur.defendAt = arrive - 0.25;
      else if (shot.type === "leave") cur.leaveAt = arrive - 0.28;
      else {
        cur.swingAt = arrive - SWING_TIME[shot.type] + shot.timingError;
        cur.swingType = shot.type;
        cur.backliftAt = cur.swingAt - (shot.charge > 0.7 ? POWER_BACKLIFT_TIME : BACKLIFT_TIME);
      }
    }
    if (cur.delivery.noBall) this.banner("NO BALL", COLORS.gold, 1.2, 3, 50, this.now + 0.25);
    this.setPhase("flight");
  }

  /** Ball time at which the ball reaches the bat for a given shot. */
  arrival(shotType) {
    const d = this.cur.delivery;
    const pitchZ = d.pitchedAt?.z ?? 0;
    const back =
      shotType === "cutpull" ||
      shotType === "ramp" ||
      (shotType === "defend" && pitchZ > 6.8) ||
      (shotType === "leave" && pitchZ > 7);
    return crossingAtZ(d.samples, back ? CONTACT_Z_BACK : CONTACT_Z_FRONT)?.t ?? 0.6;
  }

  /** Ball time, counting negative through the end of the run-up. */
  clock() {
    const cur = this.cur;
    return cur.delivery ? cur.t : cur.tRun - cur.runupDur;
  }

  updateBatInput() {
    if (this.human !== "bat" || !this.cur) return;
    const cur = this.cur;
    if (cur.shot) return;
    const t = this.clock();
    if (!cur.delivery) return;
    const power = keys.down("ShiftLeft") || keys.down("ShiftRight");
    for (const [key, type] of Object.entries(SHOT_KEYS)) {
      if (keys.pressed(key) && !cur.shot) this.commitSwing(t, this.shotVariant(type), power);
    }
    if (keys.pressed("KeyA") && !cur.shot) this.commitDefend(t);
    if (cur.delivery && !cur.shot) {
      const arrive = crossingAtZ(cur.delivery.samples, CONTACT_Z_FRONT)?.t ?? 0.6;
      if (t > arrive + 0.05) this.commitLeave();
    }
  }

  /** Down + W is a ramp; down + left/right + Q is a sweep / reverse sweep. */
  shotVariant(type) {
    if (!keys.down("ArrowDown")) return type;
    const left = keys.down("ArrowLeft");
    const right = keys.down("ArrowRight");
    if (type === "loft") return "ramp";
    if (type === "cutpull" && left !== right) return left ? "sweep" : "reverseSweep";
    return type;
  }

  commitSwing(t, type, power) {
    const cur = this.cur;
    cur.swingType = type;
    cur.backliftAt = t;
    cur.swingAt = t + (power ? POWER_BACKLIFT_TIME : BACKLIFT_TIME);
    const timingError = cur.swingAt + SWING_TIME[type] - this.arrival(type);
    if (power) this.flash("POWER!", COLORS.gold);
    cur.shot = {
      type,
      charge: power ? POWER_CHARGE : NORMAL_CHARGE,
      timingError,
      aim: arrowBearing(),
      windowMult: PLAYER_TIMING_WINDOW,
    };
    cur.play = this.match.resolve(cur.intent, cur.delivery, cur.shot);
  }

  commitDefend(t) {
    const cur = this.cur;
    const arrive = this.arrival("defend");
    cur.defendAt = t;
    cur.shot = {
      type: "defend",
      charge: 0,
      timingError: Math.max(0, t + 0.12 - arrive),
      aim: arrowBearing(),
      windowMult: PLAYER_TIMING_WINDOW,
    };
    cur.play = this.match.resolve(cur.intent, cur.delivery, cur.shot);
  }

  commitLeave() {
    const cur = this.cur;
    cur.leaveAt = this.clock();
    cur.shot = { type: "leave", charge: 0, timingError: 0, aim: null };
    cur.play = this.match.resolve(cur.intent, cur.delivery, cur.shot);
  }

  updateFlight(dt) {
    const cur = this.cur;
    if (!cur.delivery) return;
    if (cur.strikeAt !== null) {
      // Slow motion just after a clean strike, then cut to the wide view.
      const since = this.now - cur.strikeAt;
      this.timeScale = since < 0.75 ? 0.3 : 1;
      if (since >= 0.75 && this.cam === "auto" && this.view === "close") this.view = "wide";
    }
    const slowmo = this.human === "bat" && !cur.contactDone ? PLAYER_SLOWMO : 1;
    cur.t += dt * this.timeScale * slowmo;
    this.updateBatInput();
    const d = cur.delivery;
    if (!cur.bounceDone && d.bounceIndex >= 0 && cur.t >= d.samples[d.bounceIndex].t) {
      cur.bounceDone = true;
      sfx.bounce();
    }
    const play = cur.play;
    if (!play) return;
    const res = play.res;

    if (!cur.contactDone && cur.t >= res.start.t) {
      cur.contactDone = true;
      const kind = res.contact.kind;
      if (res.touchedBat) {
        if (kind === "middle") sfx.bat(res.contact.quality);
        else sfx.edge();
        if (kind === "middle" && play.shot.type !== "defend" && res.contact.quality > 0.25) {
          cur.strikeAt = this.now;
          this.banner("STRIKE!", COLORS.gold, 0.9, 4, 70);
        } else if (play.shot.type === "defend" || kind !== "middle") {
          const exit = res.contact.exit;
          if (Math.hypot(exit.x, exit.z) > 9) cur.strikeAt = this.now;
        }
      } else if (res.padHit) {
        sfx.pad();
        if (res.lbw || res.lbwNote) {
          sfx.appeal();
          this.banner("HOWZAT?", COLORS.cream, 0.9, 3, 60);
        }
      }
      if (res.bowled) this.knockStumps(0);
      if (res.wide) this.banner("WIDE", COLORS.gold, 1.2, 3, 50);
    }

    if (cur.contactDone) {
      const live = play.live;
      for (let i = 0; live.t < cur.t && i++ < 50; ) live.step(Math.min(1 / 120, cur.t - live.t + 1e-6));
      this.handleEvents(live.events);
      if (this.cam === "auto" && this.view === "close" && !res.touchedBat && cur.t > res.start.t + 0.9 && !live.dead)
        this.view = "wide";
      if (
        this.cam === "auto" &&
        this.view === "close" &&
        res.touchedBat &&
        cur.strikeAt === null &&
        cur.t > res.start.t + 1 &&
        !live.dead
      ) {
        this.view = "wide";
      }
      if (this.human === "bat" && this.phase === "flight") {
        if (keys.pressed("ArrowUp")) this.runCommand(live, 1);
        if (keys.pressed("ArrowDown")) this.runCommand(live, 0);
      }
      if (this.phase === "flight" && live.dead && live.t >= live.deadAt && !cur.done) this.ballDead();
    }
  }

  /** Which run key the player should press next (1 = up, 0 = down), or null. */
  runDirection(live) {
    if (live.dead) return null;
    const r = live.runners[0];
    if (r.target !== null) return r.target === 1 ? 0 : 1;
    return r.from === 0 ? 1 : 0;
  }

  /** Up = run towards the bowler's end, down = towards the striker's end. */
  runCommand(live, end) {
    const r = live.runners[0];
    if (r.target === null) {
      if (r.from !== end && live.requestRun()) this.flash("YES! RUN!", COLORS.gold);
    } else if (r.target !== end && live.recall()) {
      this.flash("NO! GET BACK!", COLORS.gold);
    }
  }

  /** Turn new live-ball events into sounds and banners. */
  handleEvents(events) {
    const cur = this.cur;
    for (; cur.lastEv < events.length; cur.lastEv++) {
      const ev = events[cur.lastEv];
      switch (ev.type) {
        case "four":
          this.big("FOUR!", COLORS.gold);
          sfx.cheer(0.7);
          break;
        case "six":
          this.big("SIX!", COLORS.gold);
          sfx.cheer(1);
          break;
        case "catch":
          sfx.gloves();
          sfx.cheer(0.9);
          break;
        case "drop":
          this.banner("DROPPED!", COLORS.red, 1.2, 3, 60);
          sfx.groan();
          break;
        case "runout":
        case "stumped": {
          sfx.stumps();
          sfx.cheer(0.9);
          if (ev.text === "direct hit") this.banner("DIRECT HIT!", COLORS.gold, 1.2, 3, 60);
          const end = ev.type === "stumped" ? 0 : (ev.end ?? 0);
          this.knockStumps(end === 0 ? 0 : PITCH_LENGTH, true);
          break;
        }
        case "bowled":
          sfx.stumps();
          sfx.cheer(0.9);
          break;
        case "lbw":
          sfx.cheer(0.8);
          break;
        case "throw":
          sfx.throw();
          break;
        case "gather":
        case "stop":
        case "collect":
          sfx.gloves();
          break;
        case "misfield":
        case "fumble":
          sfx.groan();
          if (ev.text) this.banner(ev.text.toUpperCase() + "!", COLORS.cream, 1.1, 2, 60);
          break;
        case "runDone":
          sfx.click();
          break;
      }
    }
  }

  /** Send bails and splinters flying from the stumps at depth z. */
  knockStumps(z, wide = false) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * 0.2,
        y: 0.72,
        z,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 3,
        vz: (z === 0 ? -1 : 1) * (1 + Math.random() * 2),
        life: 1.4,
        wide,
      });
    }
  }

  ballDead() {
    const cur = this.cur;
    // A pad hit that might be LBW: appeal first, then the umpire, then perhaps DRS.
    if (!cur.lbwChecked && this.match.lbwAppeal(cur.play)) {
      cur.lbwChecked = true;
      if (this.human === "bowl") {
        if (cur.appealed) this.decideLbw();
        else this.setPhase("appeal");
      } else {
        // The computer's fielders always go up.
        cur.appealed = true;
        sfx.appeal();
        this.banner("HOWZAT?", COLORS.cream, 0.9, 3, 60);
        this.decideLbw();
      }
      return;
    }
    this.completeBall();
  }

  /** The player shouts. Appealing when there's nothing in it irritates the umpire. */
  appeal() {
    const cur = this.cur;
    if (!cur?.play || !cur.contactDone || cur.appealed) return;
    cur.appealed = true;
    sfx.appeal();
    this.banner("HOWZAT?", COLORS.cream, 0.9, 3, 60);
    const res = cur.play.res;
    if (!res.padHit || res.touchedBat) {
      this.inn.irritation += 0.6;
      this.flash("THE UMPIRE IS UNMOVED");
    }
  }

  decideLbw() {
    const cur = this.cur;
    if (!cur.appealed) {
      this.completeBall();
      return;
    }
    const res = cur.play.res;
    const out = this.match.umpireLbw(cur.play);
    if (this.human === "bowl" && !res.lbw && res.lbwNote !== "umpire's call, not out") this.inn.irritation += 1;
    cur.onField = out;
    this.banner(out ? "THE FINGER GOES UP" : "NOT OUT", out ? COLORS.red : COLORS.cream, 1.6, 3, 60);
    if (out) sfx.cheer(0.8);
    else sfx.groan();
    this.setPhase("decision");
  }

  /** The side that lost the decision may review it: the player by pressing R, the computer if it smells a mistake. */
  updateDecision() {
    const cur = this.cur;
    const inn = this.inn;
    const loser = cur.onField ? "bat" : "bowl";
    const playerSide = this.human === "bowl" ? "bowl" : "bat";
    if (loser === playerSide) {
      if (inn.reviews[loser] > 0 && keys.pressed("KeyR")) this.startReview(loser);
      else if (this.phaseT > 2.8 || keys.pressed("Space")) this.endDecision();
    } else if (this.phaseT > 1) {
      const t = this.match.tracking(cur.play);
      const wrong = cur.onField ? t.verdict === "notOut" : t.verdict === "out";
      if (inn.reviews[loser] > 0 && this.match.rng.chance(wrong ? 0.65 : 0.1)) this.startReview(loser);
      else this.endDecision();
    }
  }

  startReview(side) {
    const cur = this.cur;
    cur.reviewBy = side;
    cur.tracking = this.match.tracking(cur.play);
    this.big("REVIEW", COLORS.gold, side === "bat" ? "THE BATTER REVIEWS" : "THE FIELDING SIDE REVIEWS", 1.2);
    this.setPhase("review");
  }

  endReview() {
    const cur = this.cur;
    const t = cur.tracking;
    let out = cur.onField;
    if (t.verdict === "out") out = true;
    else if (t.verdict === "notOut") out = false;
    const won = cur.reviewBy === "bat" ? !out : out;
    // Umpire's call: the on-field decision stands and the review is kept.
    if (!won && t.verdict !== "umpiresCall") this.inn.reviews[cur.reviewBy]--;
    const sub = out !== cur.onField ? "DECISION OVERTURNED" : t.verdict === "umpiresCall" ? "UMPIRE'S CALL" : "REVIEW LOST";
    cur.onField = out;
    this.big(out ? "OUT" : "NOT OUT", out ? COLORS.red : COLORS.cream, sub, 1.6);
    this.endDecision();
  }

  endDecision() {
    if (this.cur.onField) this.match.giveLbw(this.cur.play);
    this.completeBall();
  }

  completeBall() {
    const cur = this.cur;
    const done = this.match.finish(cur.play);
    cur.done = done;
    this.commentary = done.rec.commentary ?? "";
    this.commT = 0;
    this.booth = scheduleCalls(this.callFromBooth(done), this.now + 0.2);
    const wicket = done.rec.wicket;
    if (wicket) {
      const how = {
        bowled: "BOWLED",
        lbw: "LBW",
        caught: wicket.caughtBehind ? "CAUGHT BEHIND" : "CAUGHT",
        runout: "RUN OUT",
        stumped: "STUMPED",
      }[wicket.how];
      const batter = this.inn.bat[wicket.batter].p;
      this.big("OUT!", COLORS.red, `${how}  -  ${batter.short.toUpperCase()} ${this.inn.bat[wicket.batter].runs}`, 2.6);

      const live = cur.play.live;
      for (const f of live.fielders) {
        if (Math.hypot(f.pos.x - live.ball.pos.x, f.pos.z - live.ball.pos.z) < 25 || f.role !== "field") {
          f.state = "celebrate";
          f.stateAt = live.t;
        }
      }
      const runner = live.runners.find((r) => r.bat === wicket.batter);
      const from = live.runnerPos(runner);
      this.walkOff = { x: from.x, z: from.z, t0: this.now + 0.8 };

      // A few fielders near the departing batter get a word in.
      const nearby = live.fielders
        .filter((f) => f.role === "field")
        .sort((a, b) => Math.hypot(a.pos.x - from.x, a.pos.z - from.z) - Math.hypot(b.pos.x - from.x, b.pos.z - from.z));
      const talkers = [
        live.fielders.find((f) => f.role === "keeper"),
        live.fielders.find((f) => f.role === "bowler"),
        nearby[0],
        nearby[1],
      ]
        .filter((f) => !!f)
        .sort(() => Math.random() - 0.5)
        .slice(0, MAX_SLEDGES);
      const lines = pickSledges(this.inn.bowlTeam.abbr, batter.short, talkers.length);
      this.sledges = talkers.map((f, i) => ({ fielder: f.idx, text: lines[i], t0: this.now + 1.1 + i * SLEDGE_GAP }));

      if (!done.applied.inningsOver && this.inn.wkts < 10) {
        const inn = this.inn;
        const fresh = inn.bat[inn.striker].balls === 0 && inn.bat[inn.striker].batted ? inn.striker : inn.nonStriker;
        this.banner(`NEW BATTER: ${inn.bat[fresh].p.name.toUpperCase()}`, COLORS.cream, 2.2, 1, 160, this.now + WICKET_PAUSE - 2);
      }
    }
    for (const m of done.applied.milestones) this.banner(m, COLORS.gold, 2.2, 2, 150, this.now + 0.4);
    // Beat the bat and the close fielders let him know about it, which gets under his skin.
    if (done.rec.beatBat && Math.random() < 0.35) {
      this.chirp = { text: pickChirp(this.inn.bowlTeam.abbr), t0: this.now + 0.3 };
      this.inn.pressure = clamp(this.inn.pressure + 0.06);
    }
    this.setPhase("after");
  }

  /** Who in the commentary box calls this ball, and what they say (one or two voices). */
  callFromBooth(done) {
    const { rec } = done;
    const inn = this.inn;
    const names = {
      batter: inn.bat[rec.wicket ? rec.wicket.batter : rec.striker].p.short,
      bowler: inn.bowl[rec.bowler].p.short,
      fielder: rec.dropped || rec.wicket?.fielder,
    };
    // Presentation only, so it draws on Math.random and leaves the match's dice alone.
    const rng = { pick: (list) => list[Math.floor(Math.random() * list.length)], chance: (p) => Math.random() < p };
    return boothCall(rec, rec.commentary ?? "", names, rng);
  }

  afterDuration() {
    const rec = this.cur?.done?.rec;
    if (!rec) return 1;
    return rec.wicket ? WICKET_PAUSE : rec.boundary ? 2 : 1;
  }

  /** Fielders walk back to their marks, then on to the next ball (or over/innings end). */
  updateReturn(dt) {
    const live = this.cur.play.live;
    live.t += dt;
    let moving = false;
    for (const f of live.fielders) {
      if (f.state === "celebrate" && this.phaseT < 0.6) continue;
      f.state = "idle";
      const home = f.role === "bowler" ? { x: 1.2, z: 24 } : f.home;
      const dx = home.x - f.pos.x;
      const dz = home.z - f.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.2) {
        moving = true;
        const step = Math.min(dist, 11 * dt);
        f.pos.x += (dx / dist) * step;
        f.pos.z += (dz / dist) * step;
      }
    }
    if ((!moving && this.phaseT > 0.5) || this.phaseT > (this.view === "wide" ? 1.8 : 0.6) || keys.pressed("Space")) {
      const applied = this.cur.done.applied;
      if (applied.inningsOver) {
        this.endInnings();
        return;
      }
      if (applied.overEnded) {
        this.big("END OF OVER", COLORS.cream, this.match.comm.overSummary(this.inn), 2.3);
        this.setPhase("overEnd");
        return;
      }
      this.nextBall();
    }
  }

  /** Simulate `overs` overs on the AI and list the highlights. */
  simulate(overs) {
    const inn = this.inn;
    const until = Math.min(inn.oversLimit, inn.overNo + overs);
    this.booth = null;
    this.simLines = [];
    for (let i = 0; !inn.isOver && inn.overNo < until && i++ < 2000; ) {
      const { rec, applied } = this.match.simBall();
      if (rec.wicket || rec.boundary || applied.milestones.length || applied.overEnded) {
        const result = rec.wicket ? "OUT! " + rec.wicket.text : rec.boundary ? rec.boundary + "!" : rec.total;
        let line = `${rec.over}.${rec.ball} ${inn.bowl[rec.bowler].p.short} to ${inn.bat[rec.striker].p.short}: ${result}`;
        if (applied.milestones.length) line += "  " + applied.milestones.join(", ");
        if (applied.overEnded) line += `  | END OF OVER ${inn.overNo}: ${inn.runs}/${inn.wkts}`;
        this.simLines.push(line);
      }
    }
    this.commentary = this.simLines.length ? "Simulated. " + this.match.comm.overSummary(inn) : "";
    this.setPhase("simSummary");
  }
}
