import { keys } from "../engine/input.js";
import { REVIEW_END } from "../render/match-broadcast.js";
import { updateReviewAudio } from "./match-audio.js";
import { skipCelebration } from "./celebrations.js";
import { stepFeedback } from "./match-feedback.js";

/** One frame of the match scene: pause and camera keys, then whatever the current phase does. */
export function updateMatch(scene, dt) {
  scene.now += dt;
  const striker = scene.inn.bat[scene.inn.striker];
  stepFeedback(scene.juice, scene.now, dt, scene.human === "bat" && striker ? striker.eye : null, scene.inn.pressure);
  scene.phaseT += dt;
  scene.commT += dt;

  if (scene.phase === "pause") {
    const action = scene.pauseMenu.update();
    if (action === "view") scene.toggleCloseEnd();
    if (action === "resume") scene.setPhase(scene.pausedFrom);
    else if (action === "quit") scene.game.toMenu();
    return;
  }
  if (keys.pressed("Escape") && scene.phase !== "inningsEnd" && scene.phase !== "fieldEdit") {
    scene.pausedFrom = scene.phase;
    scene.pauseMenu.open();
    scene.setPhase("pause");
    return;
  }
  if (keys.pressed("KeyC")) {
    scene.cam = scene.cam === "auto" ? "close" : scene.cam === "close" ? "wide" : "auto";
    scene.flash(`CAMERA: ${scene.cam.toUpperCase()}`);
    if (scene.cam !== "auto") scene.view = scene.cam;
  }
  if (keys.pressed("KeyB")) scene.toggleCloseEnd();

  switch (scene.phase) {
    case "ready":
      scene.updateFootwork(dt);
      scene.updateReady();
      break;
    case "setup":
      scene.updateSetup();
      break;
    case "runup":
      scene.updateFootwork(dt);
      scene.updateRunup(dt);
      scene.updateBatInput();
      break;
    case "flight":
      scene.updateFootwork(dt);
      scene.updateFlight(dt);
      if (scene.human === "bowl" && keys.pressed("KeyH")) scene.appeal();
      break;
    case "appeal":
      // A moment to shout after the ball is dead.
      if (keys.pressed("KeyH")) scene.appeal();
      if (scene.cur.appealed || scene.phaseT > 1.1) scene.decideLbw();
      break;
    case "decision":
      scene.updateDecision();
      break;
    case "review":
      updateReviewAudio(this);
      if (scene.phaseT > REVIEW_END) scene.endReview();
      break;
    case "after": {
      scene.updateFlight(dt);
      if (skipCelebration(this)) break;
      const wicket = !!scene.cur?.done?.rec.wicket;
      if (scene.nets) {
        // Take your time over the coach's verdict.
        if (scene.phaseT > 0.6 && (keys.pressed("Space") || keys.pressed("Enter"))) scene.setPhase("return");
        break;
      }
      if (wicket && scene.cam === "auto" && scene.phaseT > 1) scene.view = "wide";
      if (scene.phaseT > scene.afterDuration()) scene.setPhase("return");
      break;
    }
    case "return":
      scene.updateReturn(dt);
      break;
    case "overEnd":
      // Finish the recap before changing ends, unless the player moves on.
      if ((scene.phaseT > 2.4 && scene.now >= scene.boothEndsAt()) || keys.pressed("Space") || keys.pressed("Enter"))
        scene.nextBall();
      break;
    case "chooseBowler":
      scene.updateChooseBowler();
      break;
    case "simSummary":
      if (scene.phaseT > 0.4 && (keys.pressed("Space") || keys.pressed("Enter"))) scene.nextBall();
      break;
    case "fieldEdit":
      scene.updateFieldEdit();
      break;
    case "inningsEnd":
      if (scene.phaseT > 0.8 && (keys.pressed("Enter") || keys.pressed("Space"))) scene.leaveInnings();
      break;
  }

  stepEffects(scene, dt);
}

/** Banners time out; dust and bails fall, bounce and fade. */
function stepEffects(scene, dt) {
  scene.banners = scene.banners.filter((b) => scene.now - b.t0 < b.dur);
  for (const p of scene.particles) {
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
  scene.particles = scene.particles.filter((p) => p.life > 0);
}
