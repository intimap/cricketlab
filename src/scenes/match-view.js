import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawLine, drawPanel, drawBar } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { clamp, easeIn, easeOut } from "../math.js";
import { CREASE, PITCH_LENGTH } from "../sim/geometry.js";
import { isSpinner } from "../sim/teams.js";
import {
  DELIVERY_NAMES,
  SPIN_EFFORT_NAMES,
  sampleAtTime,
  crossingAtZ,
  hitsStumps,
  lengthName,
  lineName,
  releaseSweetSpot,
} from "../sim/delivery.js";
import { SWING_TIME, NORMAL_CHARGE, CONTACT_Z_BACK } from "../sim/batting.js";
import { PRESET_LABELS, keeperSpot } from "../sim/field.js";
import { CLOSE_Y_OFFSET, closeGroundY, projectClose, closePixelsPerMetre, projectWide } from "../render/camera.js";
import { BATTER_POSES, lerpPose, drawBatter, drawFigure, drawTinyFigure, drawBall, drawShadow } from "../render/sprites.js";
import { HUD_Y, staminaColor, drawScoreBar, drawMiniMap, drawBanners, drawScorecard, drawSpeechBubble } from "../render/hud.js";

const FOLLOW_THROUGH_TIME = 0.15;
const WALK_OFF_TIME = 8;
const SLEDGE_TIME = 2.4;
const PANEL_TEXT = { align: "center", outline: "rgba(0,0,0,0.7)" };

export function drawMatch(scene) {
  const tracking = scene.phase === "review" || scene.phase === "appeal" || scene.phase === "decision";
  if ((scene.view === "wide" || scene.phase === "fieldEdit") && !tracking) drawWide(scene);
  else drawClose(scene);
  const effort = scene.cur?.intent.effort ?? scene.effort;
  const label = scene.inn.bowler
    ? `${DELIVERY_NAMES[scene.cur?.intent.type ?? scene.deliveryType]} ${scene.spinner ? SPIN_EFFORT_NAMES[effort] : effort.toUpperCase()}`
    : "";
  // Commentary types itself out.
  drawScoreBar(scene.inn, scene.commentary.slice(0, Math.floor(scene.commT * 70)), label);
  drawBanners(scene.banners, scene.now);
  drawPanels(scene);
}

// --- Close view: the broadcast angle down the pitch. ---

function drawClose(scene) {
  ctx.drawImage(scene.game.images.close, 0, CLOSE_Y_OFFSET, WIDTH, HEIGHT);
  const cur = scene.cur;
  const inn = scene.inn;
  const live = cur?.play?.live;
  drawRough(inn.pitch);
  const sprites = [];
  const figure = (x, z, height, opts) => {
    const p = projectClose(x, 0, z);
    drawFigure(p.x, p.y, height * closePixelsPerMetre(z), opts);
  };

  const rec = cur?.done?.rec;
  const umpirePose =
    (rec?.wicket && scene.phase === "after" && scene.phaseT > 0.5 && (rec.wicket.how === "lbw" || rec.wicket.how === "caught")) ||
    (scene.phase === "decision" && cur?.onField)
      ? "outFinger"
      : "stand";
  sprites.push({
    z: 22.6,
    draw: () =>
      figure(-0.62, 22.6, 1.78, { kit: { ...scene.kitBowl, cap: "#f4f4f0" }, pose: umpirePose, phase: 0, umpire: true }),
  });
  const nonStrikerZ = nonStrikerDepth(scene);
  sprites.push({
    z: nonStrikerZ,
    draw: () =>
      figure(-1.05, nonStrikerZ, 1.8, {
        kit: scene.kitBat,
        pose: scene.phase === "runup" ? "backup" : "stand",
        phase: scene.now * 1.4,
        bat: true,
      }),
  });
  const bowler = bowlerState(scene);
  sprites.push({
    z: bowler.z,
    draw: () => figure(bowler.x, bowler.z, 1.86, { kit: scene.kitBowl, pose: bowler.pose, phase: bowler.phase }),
  });
  sprites.push({ z: 1.25, draw: () => drawStriker(scene) });
  sprites.push({
    z: 0.02,
    draw: () => {
      if (!stumpsBroken(scene)) ctx.drawImage(scene.game.images.stumps, 296, 270 + CLOSE_Y_OFFSET);
      else drawBrokenStumps();
    },
  });

  const ball = ballPosition(scene);
  if (ball && ball.z > -7.5) {
    sprites.push({
      z: ball.z,
      draw: () => {
        const ground = projectClose(ball.x, 0, ball.z);
        const p = projectClose(ball.x, ball.y, ball.z);
        const radius = Math.max(1.5, 0.036 * 880 * p.s * 1.25);
        if (p.y < HUD_Y + 6) {
          drawShadow(ground.x, ground.y, radius);
          drawBall(p.x, p.y, radius, inn.ball.shine);
        }
      },
    });
  }
  for (const bit of scene.particles) {
    if (bit.wide) continue;
    sprites.push({
      z: bit.z,
      draw: () => {
        const p = projectClose(bit.x, bit.y, bit.z);
        fillRect(p.x - 2, p.y - 1, 4, 2, "#f4e1b0");
      },
    });
  }

  // Far to near.
  sprites.sort((a, b) => b.z - a.z);
  if (scene.phase === "setup") drawTarget(scene);
  for (const s of sprites) s.draw();

  if (scene.phase !== "setup" && scene.phase !== "chooseBowler") {
    const fielders = live ? live.fielders.filter((f) => f.role === "field").map((f) => f.pos) : inn.placements.map((p) => p.pos);
    const keeper = live ? live.fielders[0].pos : keeperSpot(scene.spinner);
    const runners = live
      ? live.runners.map((r) => live.runnerPos(r))
      : [
          { x: -0.3, z: 1.2 },
          { x: -1, z: 19 },
        ];
    drawMiniMap(552, 6, fielders, runners, live && cur?.contactDone ? { x: live.ball.pos.x, z: live.ball.pos.z } : null, keeper);
  }
  const chirp = scene.chirp;
  if (chirp && scene.now >= chirp.t0 && scene.now - chirp.t0 < 2.2) drawSpeechBubble(chirp.text, 430, 150);
}

/** Footmarks: speckled, worn patches that grow as the pitch breaks up. */
function drawRough(pitch) {
  for (const r of pitch.roughPatches) {
    for (let z = r.z0; z < r.z1; z += 0.12) {
      for (let x = r.x0; x < r.x1; x += 0.04) {
        // Deterministic speckle, denser as the rough deepens.
        const h = Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
        if (h > r.strength * 0.55) continue;
        const p = projectClose(x, 0, z);
        fillRect(p.x, p.y, 1, 1, h < r.strength * 0.25 ? "#7d5f36" : "#a8865a");
      }
    }
  }
}

/** The non-striker backs up during the run-up. */
function nonStrikerDepth(scene) {
  const cur = scene.cur;
  if (!cur) return 19.1;
  if (scene.phase === "runup") return 19.1 - clamp(cur.tRun / cur.runupDur) * 1.2;
  return cur.delivery ? 17.9 : 19.1;
}

/** Bowler position and pose through run-up, delivery and follow-through. */
function bowlerState(scene) {
  const cur = scene.cur;
  const startZ = cur?.runupStartZ ?? (scene.spinner ? 25.5 : 33);
  if (!cur || scene.phase === "setup" || scene.phase === "ready" || scene.phase === "chooseBowler") {
    return { x: 1.5, z: startZ, pose: "stand", phase: 0 };
  }
  if (scene.phase === "runup") {
    const k = clamp(cur.tRun / cur.runupDur);
    const accel = 0.6 * k + 0.4 * k * k;
    const z = startZ + (19.4 - startZ) * clamp(accel);
    const x = 1.5 + (0.55 - 1.5) * k;
    const left = cur.runupDur - cur.tRun;
    const pose = left < 0.08 ? "release" : left < 0.38 ? "bound" : "run";
    return { x, z, pose, phase: cur.tRun * (1.6 + 2.2 * k) };
  }
  const t = cur.t;
  if (cur.done?.rec.wicket && scene.phase !== "flight") return { x: 0.9, z: 16.5, pose: "celebrate", phase: 0 };
  if (t < 0.12) return { x: 0.55, z: 19, pose: "release", phase: 0 };
  const k = clamp((t - 0.12) / 0.8);
  const res = cur.play?.res;
  if (res?.padHit && (res.lbw || res.lbwNote) && t > res.start.t && t < res.start.t + 1.6) {
    return { x: 0.9, z: 17.4, pose: "appeal", phase: 0 };
  }
  return { x: 0.55 + 0.4 * k, z: 19 - 2.2 * k, pose: k < 1 ? "follow" : "walk", phase: t };
}

function ballPosition(scene) {
  const cur = scene.cur;
  if (!cur || !cur.delivery) return null;
  if (cur.play && cur.contactDone) return { ...cur.play.live.ball.pos };
  const samples = cur.delivery.samples;
  const p = sampleAtTime(samples, Math.min(cur.t, samples[samples.length - 1].t));
  return { x: p.x, y: p.y, z: p.z };
}

/** Are the striker's-end stumps broken right now? */
function stumpsBroken(scene) {
  const cur = scene.cur;
  const rec = cur?.done?.rec;
  if (cur?.play?.res?.bowled && cur.contactDone && !cur.delivery.noBall) return true;
  return !!(
    rec?.wicket &&
    (rec.wicket.how === "bowled" ||
      rec.wicket.how === "stumped" ||
      (rec.wicket.how === "runout" && cur.play.live.events.some((e) => e.type === "runout" && e.end === 0)))
  );
}

function drawBrokenStumps() {
  const base = projectClose(0, 0, 0);
  const h = 58;
  drawLine(base.x - 16, base.y, base.x - 16, base.y - h, 6, "#8a4a1a");
  drawLine(base.x - 15, base.y, base.x - 15, base.y - h, 2, "#e9d2a8");
  drawLine(base.x + 15, base.y, base.x + 15, base.y - h, 6, "#8a4a1a");
  drawLine(base.x + 16, base.y, base.x + 16, base.y - h, 2, "#e9d2a8");
  drawLine(base.x, base.y, base.x + 9, base.y - h + 6, 6, "#7a4015");
}

/** Stance before the ball: an occasional bat tap, then a trigger movement as the bowler delivers. */
function readyPose(scene, cur, t) {
  if (cur && t > -0.35) return lerpPose(BATTER_POSES.stance, BATTER_POSES.trigger, easeOut((t + 0.35) / 0.2));
  const tap = Math.max(0, Math.sin(scene.now * 2.6)) ** 8;
  return { ...BATTER_POSES.stance, angle: BATTER_POSES.stance.angle + 12 * tap };
}

/** Follow-through for the shot being played, chosen by where the ball went (or was meant to go). */
function finishPose(cur, type) {
  const contact = cur.play?.res.contact;
  if (type === "ramp") return BATTER_POSES.rampEnd;
  if (type === "sweep") return BATTER_POSES.sweepEnd;
  if (type === "reverseSweep") return BATTER_POSES.reverseSweepEnd;
  if (type === "cutpull") {
    if (cur.lineAtBat > 0.2) return contact?.shotName === "late cut" ? BATTER_POSES.lateCutEnd : BATTER_POSES.cutEnd;
    const height = crossingAtZ(cur.delivery.samples, CONTACT_Z_BACK)?.y ?? 0;
    return height > 1.35 ? BATTER_POSES.hookEnd : BATTER_POSES.pullEnd;
  }
  const bearing =
    contact?.kind === "middle"
      ? (Math.atan2(contact.exit.x, contact.exit.z) * 180) / Math.PI
      : (cur.shot?.aim ?? clamp(cur.lineAtBat * 75, -50, 70));
  if (type === "loft") return bearing < -35 ? BATTER_POSES.slogEnd : BATTER_POSES.loftEnd;
  if (bearing < -60) return BATTER_POSES.clipEnd;
  if (bearing < -15) return BATTER_POSES.onDriveEnd;
  if (bearing > 25) return BATTER_POSES.coverDriveEnd;
  return BATTER_POSES.straightDriveEnd;
}

/** The striker, animated through stance, backlift, swing, defence or leave, and reactions after. */
function drawStriker(scene) {
  const cur = scene.cur;
  const inn = scene.inn;
  const x = 300;
  const y = closeGroundY(CREASE) + 2;
  const t = cur ? scene.clock() : 0;
  const ready = readyPose(scene, cur, t);
  let pose = ready;
  if (cur) {
    const arrive = cur.delivery ? scene.arrival(cur.swingType ?? cur.shot?.type ?? "drive") : 0.6;
    // Reach towards the line of the ball.
    const reach = clamp((projectClose(cur.lineAtBat, 0, 1.9).x - (x + 12)) * 0.8, -8, 26);
    let shotDoneAt = null;
    if (cur.swingAt !== null && t >= cur.swingAt && cur.swingType) {
      const type = cur.swingType;
      const top = lerpPose(BATTER_POSES.lift0, BATTER_POSES.lift1, cur.shot?.charge ?? 0.5);
      const contact =
        {
          cutpull: BATTER_POSES.contactBack,
          ramp: BATTER_POSES.rampContact,
          sweep: BATTER_POSES.sweepContact,
          reverseSweep: BATTER_POSES.reverseSweepContact,
        }[type] ?? BATTER_POSES.contactFront;
      const k = (t - cur.swingAt) / SWING_TIME[type];
      if (k < 1) pose = lerpPose(top, contact, easeIn(k));
      else pose = lerpPose(contact, finishPose(cur, type), easeOut((t - cur.swingAt - SWING_TIME[type]) / FOLLOW_THROUGH_TIME));
      if (k > 0.3 && k < 1.6) pose = { ...pose, px: pose.px + reach * Math.min(1, k) * (1.6 - k) };
      shotDoneAt = cur.swingAt + SWING_TIME[type] + FOLLOW_THROUGH_TIME;
    } else if (cur.swingType && cur.swingAt !== null && t >= cur.backliftAt) {
      const charge = cur.shot?.charge ?? NORMAL_CHARGE;
      pose = lerpPose(
        ready,
        lerpPose(BATTER_POSES.lift0, BATTER_POSES.lift1, charge),
        easeOut((t - cur.backliftAt) / Math.max(0.01, cur.swingAt - cur.backliftAt)),
      );
    } else if (cur.defendAt !== null && t >= cur.defendAt) {
      const block = (cur.delivery?.pitchedAt?.z ?? 5) > 6.8 ? BATTER_POSES.defendBack : BATTER_POSES.defendFront;
      pose = lerpPose(ready, block, easeOut((t - cur.defendAt) / 0.09));
      pose = { ...pose, px: pose.px + reach * clamp((t - cur.defendAt) / 0.15) };
      shotDoneAt = cur.defendAt + 0.3;
    } else if (cur.leaveAt !== null && t >= cur.leaveAt) {
      pose = lerpPose(ready, BATTER_POSES.leave, (t - cur.leaveAt) / 0.18);
    } else if (scene.human === "bat" && cur.delivery && !cur.shot && t > arrive - 0.22) {
      // No shot chosen yet: start lifting the bat out of the way.
      pose = lerpPose(ready, BATTER_POSES.leave, (t - (arrive - 0.22)) / 0.18);
    }

    const play = cur.play;
    const res = play?.res;
    // Reactions once the ball has gone past: flinch if hit on the pad, recoil if beaten.
    if (res && cur.contactDone && !res.touchedBat) {
      if (res.padHit) pose = lerpPose(pose, BATTER_POSES.padFlinch, easeOut((t - res.start.t) / 0.12));
      else if (shotDoneAt !== null && t > shotDoneAt) pose = lerpPose(pose, BATTER_POSES.beaten, easeOut((t - shotDoneAt) / 0.2));
    }
    // Hidden once out (and walking off) or once running.
    if (
      (cur.done && play && cur.done.rec.wicket?.batter === play.striker && scene.phase !== "flight") ||
      (play && cur.contactDone && (play.live.runners[0].target !== null || play.live.runners[0].from === 1))
    ) {
      return;
    }
  }
  drawBatter(x, y, 1, pose, scene.kitBat, inn.striker + 1);
}

/** Blinking crosshair where the player is aiming to pitch the ball. */
function drawTarget(scene) {
  const p = projectClose(scene.target.line, 0, scene.target.length);
  const color = Math.floor(scene.now * 4) % 2 ? COLORS.gold : COLORS.cream;
  const size = Math.max(4, 7 * (p.s * 10));
  drawLine(p.x - size - 3, p.y, p.x - 2, p.y, 1, color);
  drawLine(p.x + 2, p.y, p.x + size + 3, p.y, 1, color);
  drawLine(p.x, p.y - size * 0.5 - 2, p.x, p.y - 1, 1, color);
  drawLine(p.x, p.y + 1, p.x, p.y + size * 0.5 + 2, 1, color);
  fillRect(p.x - 1, p.y - 1, 2, 2, COLORS.red);
}

// --- Wide view: the whole ground. ---

function drawWide(scene) {
  ctx.drawImage(scene.game.images.wide, 0, 0, WIDTH, HEIGHT);
  const inn = scene.inn;
  const cur = scene.cur;
  const live = cur?.play?.live;
  const cap = scene.kitBowl.cap;
  const sprites = [];
  const add = (x, y, z, draw) => {
    const p = projectWide(x, y, z);
    sprites.push({ y: p.y, draw: () => draw(p.x, p.y, p.s) });
  };

  // Umpires.
  add(-1.2, 0, PITCH_LENGTH + 2.4, (x, y, s) => drawTinyFigure(x, y, s, "idle", "#f4f4f0"));
  add(-26, 0, 1, (x, y, s) => drawTinyFigure(x, y, s, "idle", "#f4f4f0"));

  if (live && (scene.phase === "flight" || scene.phase === "after" || scene.phase === "return")) {
    for (const f of live.fielders) {
      const pose =
        f.state === "dive"
          ? "dive"
          : f.state === "down"
            ? "down"
            : f.state === "celebrate"
              ? "celebrate"
              : f.state === "throw" && live.t - f.stateAt < 0.4
                ? "throw"
                : f.curSpeed > 0.5 || (f.state === "idle" && scene.phase === "return")
                  ? "run"
                  : f.role === "keeper"
                    ? "keeper"
                    : "idle";
      add(f.pos.x, 0, f.pos.z, (x, y, s) => drawTinyFigure(x, y, s, pose, cap, scene.now * 3 + f.idx));
    }
    for (const r of live.runners) {
      const out = cur?.done?.rec.wicket?.batter === r.bat;
      let pos = live.runnerPos(r);
      if (out && scene.walkOff) {
        // Off towards the pavilion.
        const k = clamp((scene.now - scene.walkOff.t0) / WALK_OFF_TIME);
        pos = { x: scene.walkOff.x + (-30 - scene.walkOff.x) * k, z: scene.walkOff.z + (75 - scene.walkOff.z) * k };
      }
      const moving = r.target !== null || (out && scene.walkOff !== null);
      const phase = out && scene.walkOff ? scene.now * 1.4 : scene.now * 3.5;
      add(pos.x, 0, pos.z, (x, y, s) =>
        drawTinyFigure(x, y, s, moving ? "run" : "batter", scene.kitBat.cap, phase + r.bat, { bat: true }),
      );
    }
    const ball = live.ball;
    if (!(ball.held >= 0 && !ball.throwing)) {
      add(ball.pos.x, 0, ball.pos.z, (x, y) => drawShadow(x, y, 1.2));
      const p = projectWide(ball.pos.x, ball.pos.y, ball.pos.z);
      sprites.push({ y: p.y + ball.pos.y * 3 + 0.5, draw: () => drawBall(p.x, p.y - 1, 1.5, 1) });
    }
  } else {
    const keeper = keeperSpot(scene.spinner);
    add(keeper.x, 0, keeper.z, (x, y, s) => drawTinyFigure(x, y, s, "keeper", cap));
    add(1, 0, scene.spinner ? 23 : 30, (x, y, s) => drawTinyFigure(x, y, s, "idle", cap));
    inn.placements.forEach((place, i) => {
      add(place.pos.x, 0, place.pos.z, (x, y, s) => {
        drawTinyFigure(x, y, s, "idle", cap);
        if (scene.phase === "fieldEdit") {
          drawText(place.name.toUpperCase(), x, y + 3, {
            align: "center",
            color: i === scene.dragIdx ? COLORS.gold : COLORS.cream,
            shadow: "rgba(0,0,0,0.8)",
          });
        }
      });
    });
    add(-0.6, 0, CREASE, (x, y, s) => drawTinyFigure(x, y, s, "batter", scene.kitBat.cap, 0, { bat: true }));
    add(-1.1, 0, PITCH_LENGTH - CREASE, (x, y, s) => drawTinyFigure(x, y, s, "batter", scene.kitBat.cap, 0, { bat: true }));
  }

  for (const bit of scene.particles) {
    if (bit.wide) add(bit.x, bit.y, bit.z, (x, y) => fillRect(x, y - bit.y * 3, 2, 1, "#f4e1b0"));
  }
  // Back to front.
  sprites.sort((a, b) => a.y - b.y);
  for (const s of sprites) s.draw();
  if (live) drawSledges(scene, live);
}

function drawSledges(scene, live) {
  for (const sl of scene.sledges) {
    const age = scene.now - sl.t0;
    if (age < 0 || age > SLEDGE_TIME) continue;
    const f = live.fielders[sl.fielder];
    if (!f) continue;
    const p = projectWide(f.pos.x, 0, f.pos.z);
    drawSpeechBubble(sl.text, p.x, p.y - 16 * p.s - 4);
  }
}

// --- Prompts and panels over either view. ---

function drawPanels(scene) {
  const inn = scene.inn;
  if (scene.phase === "setup") drawSetupPanel(scene);

  if (scene.phase === "ready" && scene.human === "bat") {
    drawText("S DRIVE  Q CUT/PULL  W LOFT  A DEFEND  SHIFT+SHOT = POWER  ARROWS AIM  UP/DOWN RUN", WIDTH / 2, 6, {
      ...PANEL_TEXT,
      color: COLORS.cream,
    });
    drawText("DOWN+W RAMP   DOWN+LEFT+Q SWEEP   DOWN+RIGHT+Q REVERSE SWEEP", WIDTH / 2, 15, { ...PANEL_TEXT, color: COLORS.dim });
    if (Math.floor(scene.now * 2) % 2 === 0) {
      drawText("PRESS SPACE TO FACE UP", WIDTH / 2, 24, { ...PANEL_TEXT, color: COLORS.gold, scale: 2 });
    }
  }

  if (scene.phase === "flight" && scene.human === "bat" && scene.cur?.contactDone && scene.cur.play) {
    const live = scene.cur.play.live;
    const dir = scene.runDirection(live);
    if (dir !== null && !live.wicket && !live.boundary) {
      const running = live.runners[0].target !== null;
      const text = running ? (dir === 1 ? "UP: GET BACK" : "DOWN: GET BACK") : dir === 1 ? "UP: RUN" : "DOWN: RUN";
      drawText(text, WIDTH / 2, 6, { ...PANEL_TEXT, color: running ? COLORS.cream : COLORS.gold, scale: 2 });
    }
  }

  if (scene.phase === "runup" && scene.human === "bowl" && scene.cur && scene.cur.tRun < 0.6) {
    drawText("SPACE TO RELEASE - AT THE DELIVERY STRIDE", WIDTH / 2, 6, { ...PANEL_TEXT, color: COLORS.gold });
  }
  // Release meter: the marker runs towards the delivery stride; hit the gold zone.
  if (scene.human === "bowl" && scene.cur && (scene.phase === "runup" || (scene.phase === "flight" && scene.phaseT < 0.9))) {
    drawReleaseMeter(scene);
  }

  // Appeals and reviews.
  const cur = scene.cur;
  const res = cur?.play?.res;
  const blink = Math.floor(scene.now * 3) % 2 === 0;
  if (scene.human === "bowl" && scene.phase === "flight" && cur?.contactDone && res?.padHit && !cur.appealed && blink) {
    drawText("H: APPEAL!", WIDTH / 2, 6, { ...PANEL_TEXT, color: COLORS.gold, scale: 2 });
  }
  if (scene.phase === "appeal" && blink) drawText("H: APPEAL!", WIDTH / 2, 6, { ...PANEL_TEXT, color: COLORS.gold, scale: 2 });
  if (scene.phase === "decision") {
    const loser = cur.onField ? "bat" : "bowl";
    const playerSide = scene.human === "bowl" ? "bowl" : "bat";
    if (loser === playerSide && inn.reviews[loser] > 0) {
      drawText(`R: REVIEW (${inn.reviews[loser]} LEFT)   SPACE: ACCEPT`, WIDTH / 2, 6, {
        ...PANEL_TEXT,
        color: COLORS.gold,
        scale: 2,
      });
    }
  }
  if (scene.phase === "review") drawReview(scene);

  if (scene.phase === "chooseBowler") {
    drawPanel(150, 60, 340, 40 + inn.bowl.length * 22);
    drawText(`OVER ${inn.overNo + 1}: CHOOSE YOUR BOWLER`, WIDTH / 2, 68, { align: "center", color: COLORS.gold });
    inn.bowl.forEach((b, i) => {
      const y = 84 + i * 22;
      const available = inn.canBowl(i);
      if (i === scene.selBowler) fillRect(156, y - 3, 328, 20, "#24563a");
      drawText(`${i + 1}. ${b.p.name.toUpperCase()}`, 162, y, { color: available ? COLORS.cream : COLORS.grey });
      drawText(`${b.p.bowl.style.toUpperCase()}  ${inn.bowlerOvers(b)}-${b.maidens}-${b.runs}-${b.wkts}`, 162, y + 9, {
        color: COLORS.dim,
      });
      drawBar(400, y + 2, 60, 5, b.stamina, staminaColor(b.stamina));
      if (!available) drawText("BOWLED LAST OVER", 400, y + 10, { color: COLORS.grey });
      else if (b.spell >= 5) drawText(`SPELL ${b.spell} OV`, 400, y + 10, { color: COLORS.dim });
    });
    drawText(`ARROWS/1-${inn.bowl.length} + ENTER.  STAMINA RECOVERS WHEN RESTED.`, WIDTH / 2, 92 + inn.bowl.length * 22, {
      align: "center",
      color: COLORS.dim,
    });
  }

  if (scene.phase === "simSummary") {
    drawPanel(70, 40, 500, 250);
    drawText("SIMULATION", WIDTH / 2, 48, { align: "center", color: COLORS.gold, scale: 2 });
    const lines = scene.simLines.slice(-18);
    if (!lines.length) drawText("QUIET PASSAGE OF PLAY. NOTHING TO REPORT.", 82, 74, { color: COLORS.cream });
    lines.forEach((line, i) =>
      drawText(line.length > 80 ? line.slice(0, 80) : line, 82, 70 + i * 11, {
        color: line.includes("OUT") ? COLORS.red : line.includes("!") ? COLORS.gold : COLORS.cream,
      }),
    );
    drawText(`${inn.batTeam.abbr} ${inn.runs}/${inn.wkts} (${inn.oversText} OV)  BALL: ${inn.ball.label}`, WIDTH / 2, 272, {
      align: "center",
      color: COLORS.white,
    });
    drawText("SPACE TO CONTINUE", WIDTH / 2, 282, { align: "center", color: COLORS.dim });
  }

  if (scene.phase === "fieldEdit") {
    drawPanel(4, 4, 250, 34, "#0d2318");
    drawText(scene.human === "bowl" ? "DRAG FIELDERS WITH THE MOUSE.  F = PRESET" : "THE OPPOSITION FIELD", 10, 10, {
      color: COLORS.gold,
    });
    drawText(`FIELD: ${inn.customField ? "CUSTOM" : PRESET_LABELS[inn.preset]}   V/ENTER = DONE`, 10, 22, {
      color: COLORS.cream,
    });
  }

  if (scene.phase === "pause") {
    drawScorecard(inn, 20, 18, 600, 290, "PAUSED");
    drawText("ESC = RESUME     Q = QUIT TO MENU     M = SOUND", WIDTH / 2, 296, { align: "center", color: COLORS.gold });
  }

  if (scene.phase === "inningsEnd") {
    drawScorecard(inn, 20, 18, 600, 290, inn.wkts >= 10 ? "ALL OUT" : "END OF SPELL");
    drawText("ENTER = MENU", WIDTH / 2, 296, { align: "center", color: COLORS.gold });
  }
}

/** Bar showing the run-up against the release window, and where the last release landed. */
function drawReleaseMeter(scene) {
  const cur = scene.cur;
  const from = cur.runupDur * 0.4;
  const to = cur.runupDur + 0.3;
  const x0 = 200;
  const w = 240;
  const y = 22;
  const toX = (t) => x0 + ((t - from) / (to - from)) * w;
  fillRect(x0 - 1, y - 1, w + 2, 8, COLORS.black);
  fillRect(x0, y, w, 6, "#203a2a");
  // Too late: no-ball territory.
  fillRect(toX(cur.runupDur + 0.11), y, toX(to) - toX(cur.runupDur + 0.11), 6, COLORS.red);
  const sweet = releaseSweetSpot(scene.inn.bowler.stamina);
  fillRect(toX(cur.runupDur - sweet), y, Math.max(2, toX(cur.runupDur + sweet) - toX(cur.runupDur - sweet)), 6, COLORS.gold);
  const at = cur.delivery ? cur.runupDur + (cur.releaseMark ?? 0) : cur.tRun;
  fillRect(clamp(toX(at), x0, x0 + w) - 1, y - 3, 3, 12, COLORS.white);
}

/** DRS ball-tracking: replay the ball's path to the stumps, then the three verdicts. */
function drawReview(scene) {
  const cur = scene.cur;
  const res = cur.play.res;
  const d = cur.delivery;
  const k = clamp(scene.phaseT / 1.6);
  const end = d.samples.findIndex((s) => s.z < 0);
  const last = Math.floor((end < 0 ? d.samples.length : end) * k);
  const impact = res.start.pos;
  for (let i = 0; i < last; i += 3) {
    const s = d.samples[i];
    const p = projectClose(s.x, s.y, s.z);
    // Real path up to the pad, projected path after it.
    fillRect(p.x - 1, p.y - 1, 3, 3, s.z > impact.z ? "#7ec8ff" : "#ff8a7a");
  }
  if (d.pitchedAt && k > 0.5) {
    const p = projectClose(d.pitchedAt.x, 0, d.pitchedAt.z);
    fillRect(p.x - 4, p.y - 1, 9, 3, COLORS.white);
  }
  const lines = [
    ["PITCHING", res.lbwNote === "pitched outside leg" ? "OUTSIDE LEG" : "IN LINE"],
    ["IMPACT", res.lbwNote === "outside the line" ? "OUTSIDE OFF" : "IN LINE"],
    [
      "WICKETS",
      cur.tracking.reason.startsWith("WICKETS: ") ? cur.tracking.reason.slice(9) : hitsStumps(d.samples) ? "HITTING" : "MISSING",
    ],
  ];
  drawPanel(400, 60, 220, 60, "rgba(13,35,24,0.92)");
  drawText("BALL TRACKING", 510, 66, { align: "center", color: COLORS.gold });
  lines.forEach(([label, value], i) => {
    if (scene.phaseT < 1 + i * 0.6) return;
    const bad = value.startsWith("OUTSIDE") || value === "MISSING" || value === "GOING OVER";
    drawText(label, 410, 80 + i * 11, { color: COLORS.dim });
    drawText(value, 610, 80 + i * 11, {
      align: "right",
      color: bad ? COLORS.cream : value === "UMPIRE'S CALL" ? COLORS.gold : COLORS.red,
    });
  });
}

const MOVE_LABEL = { away: "AWAY", in: "IN", straight: "STRAIGHT" };
const seenLabel = (b) => `${MOVE_LABEL[b.move]} ${b.length.toUpperCase()}`;

/** Bowling controls: bowler, delivery type, effort, target and field. */
function drawSetupPanel(scene) {
  const inn = scene.inn;
  const bowler = inn.bowler;
  const skills = bowler.p.bowl;
  const spinner = isSpinner(skills);
  drawPanel(4, 4, 240, 140, "rgba(13,35,24,0.92)");
  drawText(`${bowler.p.name.toUpperCase()}`, 10, 10, { color: COLORS.gold });
  drawText(`${skills.style.toUpperCase()}  ${inn.bowlerOvers(bowler)} OV  ${inn.bowlerFigures(bowler)}`, 10, 20, {
    color: COLORS.dim,
  });
  drawText("STAMINA", 10, 31, { color: COLORS.dim });
  drawBar(58, 32, 70, 5, bowler.stamina, staminaColor(bowler.stamina));
  // Deliveries, three to a line.
  skills.repertoire.forEach((type, i) => {
    const x = 10 + (i % 3) * 78;
    const y = 43 + Math.floor(i / 3) * 10;
    drawText(`${i + 1}.${DELIVERY_NAMES[type]}`, x, y, { color: type === scene.deliveryType ? COLORS.gold : COLORS.grey });
  });
  const effort = spinner ? `FLIGHT (E): ${SPIN_EFFORT_NAMES[scene.effort]}` : `EFFORT (E): ${scene.effort.toUpperCase()}`;
  drawText(effort, 10, 65, { color: COLORS.cream });
  drawText(`${lengthName(scene.target.length, spinner).toUpperCase()}, ${lineName(scene.target.line).toUpperCase()}`, 10, 76, {
    color: COLORS.cream,
  });
  drawText(`FIELD (F): ${inn.customField ? "CUSTOM" : PRESET_LABELS[inn.preset]}   V = EDIT`, 10, 87, { color: COLORS.cream });
  // What the batter has just seen: set him up, then change it.
  const seen = inn.bat[inn.striker].seen.slice(-3);
  if (seen.length) drawText(`HE'S SEEN: ${seen.map(seenLabel).join(", ")}`, 10, 98, { color: COLORS.dim });
  let notes = [];
  if (!spinner) notes.push(`BOUNCERS ${inn.overBouncers}/2`);
  if (inn.freeHit) notes.push("FREE HIT");
  drawText(notes.join("   "), 10, 109, { color: inn.freeHit ? COLORS.gold : COLORS.dim });
  drawText("ARROWS AIM  SHIFT = FINE", 10, 120, { color: COLORS.dim });
  drawText("SPACE = RUN IN   H = APPEAL", 10, 131, { color: COLORS.gold });
  if (inn.newBallAvailable) drawText("N = TAKE THE NEW BALL", 252, 10, { color: COLORS.red, outline: COLORS.black });
}
