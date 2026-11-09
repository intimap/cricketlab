import { updateStrikePresentation } from "./strike-presentation.js";
import { canDive } from "../sim/running.js";
import { act } from "./player-actions.js";
import { playContact, playBroadcast } from "./match-audio.js";
import { COLORS } from "../engine/screen.js";
import * as beats from "./booth-beats.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { PITCH_LENGTH } from "../sim/geometry.js";
import { timeFactor, onContact, hitStop } from "./match-feedback.js";

/**
 * The ball in flight in the match scene: ball time, the bat or pad meeting it, the ball in play
 * after that (fielders, running, events into sounds and banners) and the player's run calls. Each
 * takes the scene (scenes/match.js), whose methods of the same names call these.
 */

/** Ball time runs slower while the player is waiting to play a shot. */
const PLAYER_SLOWMO = 0.8;
/** Nets: seconds the ball stays in play after reaching the bat. */
const NETS_PLAY_TIME = 1.6;

export function updateFlight(scene, dt) {
  const cur = scene.cur;
  if (!cur.delivery) return;
  updateStrikePresentation(scene);
  const slowmo = scene.human === "bat" && !cur.contactDone ? PLAYER_SLOWMO : 1;
  // The release cue: the ball holds in the hand a moment (scenes/match-ball.js).
  if (scene.now >= (cur.holdUntil ?? 0)) cur.t += dt * scene.timeScale * slowmo * timeFactor(scene.juice, scene.now);
  scene.updateBatInput();
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
    beats.onContact(scene);
    onContact(scene.juice, scene.now, res, play.shot, scene.human === "bat", cur.delivery.pitchedAt?.z ?? 5);
    const kind = res.contact.kind;
    if (res.touchedBat) {
      playContact(res.contact);
      if (kind === "middle" && play.shot.type !== "defend" && res.contact.quality > 0.25) {
        cur.strikeAt = scene.now;
        scene.banner("STRIKE!", COLORS.gold, 0.9, 4, 70);
      } else if (play.shot.type === "defend" || kind !== "middle") {
        const exit = res.contact.exit;
        if (Math.hypot(exit.x, exit.z) > 9) cur.strikeAt = scene.now;
      }
    } else if (res.padHit) {
      sfx.pad();
      if (res.lbw || res.lbwNote) {
        sfx.appeal();
        scene.banner("HOWZAT?", COLORS.cream, 0.9, 3, 60);
      }
    }
    if (res.bowled) scene.knockStumps(0);
    if (res.wide) scene.banner("WIDE", COLORS.gold, 1.2, 3, 50);
  }

  if (cur.contactDone) {
    const live = play.live;
    for (let i = 0; live.t < cur.t && i++ < 50; ) live.step(Math.min(1 / 120, cur.t - live.t + 1e-6));
    scene.handleEvents(live.events);
    if (scene.cam === "auto" && scene.view === "close" && !res.touchedBat && cur.t > res.start.t + 0.9 && !live.dead)
      scene.view = "wide";
    if (
      scene.cam === "auto" &&
      scene.view === "close" &&
      res.touchedBat &&
      cur.strikeAt === null &&
      cur.t > res.start.t + 1 &&
      !live.dead
    ) {
      scene.view = "wide";
    }
    if (scene.human === "bat" && scene.phase === "flight") {
      if (keys.pressed("ArrowUp")) act(scene, { type: "run", end: 1 });
      if (keys.pressed("ArrowDown")) act(scene, { type: "run", end: 0 });
      // Close to his crease: dive for it (sim/running.js).
      if (keys.pressed("Space") && live.runners.some((r) => canDive(live, r))) act(scene, { type: "dive" });
    }
    // Fielding: a press timed to a catch, and calling the throw (both optional; sim/fielding-calls.js).
    if (scene.human === "bowl" && scene.phase === "flight" && !live.dead) {
      if (live.plan?.kind === "catch" && !live.safe && !cur.catchPrompted) {
        cur.catchPrompted = true;
        scene.flash("CATCH IT! SPACE AS IT ARRIVES", COLORS.gold);
      }
      if (keys.pressed("Space")) act(scene, { type: "catchPress" });
      if (keys.pressed("KeyZ")) act(scene, { type: "throwCall", end: 0 });
      if (keys.pressed("KeyX")) act(scene, { type: "throwCall", end: 1 });
    }
    // Nets: no fielders to wait for, so the ball is done soon after it reaches the bat.
    if (scene.nets && !live.dead && cur.contactDone && live.t - cur.play.res.start.t > NETS_PLAY_TIME) {
      live.dead = true;
      live.deadAt = live.t;
    }
    if (scene.phase === "flight" && live.dead && live.t >= live.deadAt && !cur.done) scene.ballDead();
  }
}

/** Which run key the player should press next (1 = up, 0 = down), or null. */
export function runDirection(scene, live) {
  if (live.dead) return null;
  const r = live.runners[0];
  if (r.target !== null) return r.target === 1 ? 0 : 1;
  return r.from === 0 ? 1 : 0;
}

/** Up = run towards the bowler's end, down = towards the striker's end. */
export function runCommand(scene, live, end) {
  const r = live.runners[0];
  if (r.target === null) {
    if (r.from !== end && live.requestRun()) scene.flash("YES! RUN!", COLORS.gold);
  } else if (r.target === end) {
    // Already going that way: keep running, another straight after this one.
    if (live.queueRun()) scene.flash(live.queuedRuns > 1 ? `AND ${live.queuedRuns} MORE!` : "AND ANOTHER!", COLORS.gold);
  } else if (live.recall()) {
    scene.flash("NO! GET BACK!", COLORS.gold);
  }
}

/** Turn new live-ball events into sounds and banners. */
export function handleEvents(scene, events) {
  const cur = scene.cur;
  for (; cur.lastEv < events.length; cur.lastEv++) {
    const ev = events[cur.lastEv];
    switch (ev.type) {
      case "four":
        // The scored-ball overlay includes the batter once the score is applied.
        playBroadcast("four");
        sfx.cheer(0.7);
        break;
      case "six":
        // One crowd cue per live event; drawing never schedules audio.
        playBroadcast("six");
        sfx.cheer(1);
        break;
      case "catch":
        sfx.gloves();
        sfx.cheer(0.9);
        break;
      case "drop":
        scene.banner("DROPPED!", COLORS.red, 1.2, 3, 60);
        sfx.groan();
        break;
      case "runout":
      case "stumped": {
        sfx.stumps();
        sfx.cheer(0.9);
        if (ev.text === "direct hit") scene.banner("DIRECT HIT!", COLORS.gold, 1.2, 3, 60);
        const end = ev.type === "stumped" ? 0 : (ev.end ?? 0);
        scene.knockStumps(end === 0 ? 0 : PITCH_LENGTH, true);
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
        if (ev.text) scene.banner(ev.text.toUpperCase() + "!", COLORS.cream, 1.1, 2, 60);
        break;
      case "runDone":
        sfx.click();
        break;
    }
  }
}

/** Send bails and splinters flying from the stumps at depth z. */
export function knockStumps(scene, z, wide = false) {
  hitStop(scene.juice, scene.now);
  for (let i = 0; i < 6; i++) {
    scene.particles.push({
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
