import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawLine, drawPanel, drawBar } from "../engine/screen.js";
import { drawText, textWidth, wrapText } from "../engine/text.js";
import { clamp, easeIn, easeOut } from "../math.js";
import { CREASE, PITCH_LENGTH, MID_PITCH } from "../sim/geometry.js";
import { isSpinner } from "../sim/teams.js";
import {
  DELIVERY_NAMES,
  SPIN_EFFORT_NAMES,
  sampleAtTime,
  crossingAtZ,
  hitsStumps,
  lengthName,
  lineName,
  movementParts,
} from "../sim/delivery.js";
import { SWING_TIME, NORMAL_CHARGE, CONTACT_Z_BACK, playsBack, backFootShot, driveBearing } from "../sim/batting.js";
import { PRESET_LABELS, keeperSpot } from "../sim/field.js";
import {
  CLOSE_Y_OFFSET,
  closeGroundY,
  projectClose,
  projectFromStriker,
  closePixelsPerMetre,
  closeDepth,
  setCloseEnd,
  closeFromBowlerEnd,
  projectWide,
} from "../render/camera.js";
import {
  BATTER_POSES,
  lerpPose,
  drawBatter,
  drawFigure,
  drawTinyFigure,
  drawBall,
  drawShadow,
  setShadowStretch,
  playerKit,
} from "../render/sprites.js";
import { drawBooth, boothShowing } from "../render/booth.js";
import { METER_FROM, meterPos, noBallPos } from "../sim/runup.js";
import { eyeMultiplier } from "../sim/eye.js";
import {
  HUD_Y,
  staminaColor,
  drawScoreBar,
  drawScoreBox,
  drawMiniMap,
  drawBanners,
  drawScorecard,
  drawSpeechBubble,
} from "../render/hud.js";

const FOLLOW_THROUGH_TIME = 0.15;
/** With no shot chosen, the striker starts lifting the bat out of the way this long before the ball arrives. */
export const LEAVE_LIFT = 0.22;
const WALK_OFF_TIME = 8;
const SLEDGE_TIME = 2.4;
const PANEL_TEXT = { align: "center", outline: "rgba(0,0,0,0.7)" };
/** Near the close camera, figures are capped at the striker's size (about 1.8 m in 94 px). */
const NEAR_PIXELS_PER_METRE = 52;
/** The striker's height in pixels when drawn at scale 1, for a player of STANDARD_HEIGHT metres. */
const BATTER_HEIGHT_PX = 92;
const STANDARD_HEIGHT = 1.82;
/** Where the striker stands across the crease (just leg side of middle). */
const STRIKER_X = -0.14;
/** Run progress (0..1) at which the striker has left his crease and is drawn as a runner. */
const LEFT_CREASE = 0.02;
/** The non-striker's spot across the pitch, and how far down he backs up once the ball is bowled. */
const NON_STRIKER_X = -1.05;
const BACKED_UP_Z = 17.9;

/** Is the wide view on screen (rather than the close one)? DRS and appeals always use the close view. */
function showingWide(scene) {
  const tracking = scene.phase === "review" || scene.phase === "appeal" || scene.phase === "decision";
  return (scene.view === "wide" || scene.phase === "fieldEdit") && !tracking;
}

/** The speed gun's tallest (speed plus two lines of movement), in the bottom right corner above the score bar. */
const SPEED_GUN_MAX_H = 42;
/** The close view's mini-map, on the right just above where the speed gun pops up. */
const MINI_MAP = { left: 552, top: HUD_Y - 3 - SPEED_GUN_MAX_H - 66 };
const miniMapShown = (scene) => !showingWide(scene) && scene.phase !== "setup" && scene.phase !== "chooseBowler";

export function drawMatch(scene) {
  setShadowStretch(scene.light.shadow.stretch);
  if (showingWide(scene)) drawWide(scene);
  else drawClose(scene);
  // The time of day's colour, over everything on the field (not the scoreboard and panels drawn after).
  if (scene.light.tint) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = scene.light.tint;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }
  const effort = scene.cur?.intent.effort ?? scene.effort;
  const label = scene.inn.bowler
    ? `${DELIVERY_NAMES[scene.cur?.intent.type ?? scene.deliveryType]} ${scene.spinner ? SPIN_EFFORT_NAMES[effort] : effort.toUpperCase()}`
    : "";
  // The call types itself out, and stays up while the box talks.
  const booth = boothShowing(scene.booth, scene.now);
  drawScoreBar(scene.inn, scene.commentary.slice(0, Math.floor(scene.commT * 70)), label);
  // The score in the corner, except over the full scorecard and the pause menu.
  if (scene.phase !== "pause" && scene.phase !== "inningsEnd") drawScoreBox(scene.inn);
  if (booth) drawBooth(scene.booth, scene.now);
  drawBanners(scene.banners, scene.now);
  drawPanels(scene);
}

// --- Close view: the broadcast angle down the pitch. ---

function drawClose(scene) {
  setCloseEnd(scene.closeEnd === "bowl");
  const fromBowler = closeFromBowlerEnd();
  ctx.drawImage(scene.groundArt.close, 0, CLOSE_Y_OFFSET, WIDTH, HEIGHT);
  const cur = scene.cur;
  const inn = scene.inn;
  const live = cur?.play?.live;
  drawRough(inn.pitch);
  const sprites = [];
  // Figures right by the camera are held to the striker's size; anyone behind it isn't drawn.
  const figure = (x, z, height, opts) => {
    if (closeDepth(z) < -1) return;
    const p = projectClose(x, 0, z);
    const ppm = Math.min(closePixelsPerMetre(z), NEAR_PIXELS_PER_METRE);
    drawFigure(p.x, p.y, height * ppm, { ...opts, back: fromBowler && z > MID_PITCH });
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
  const bowlerKit = playerKit(scene.kitBowl, inn.bowler?.p);
  const runners = live && cur.contactDone ? live.runners : null;
  if (runners && (runners[1].target !== null || runners[1].progress < 1)) {
    // Running: both batters along the pitch (the striker only once he's left his crease; until then he's
    // drawn batting). Depths run from the crease to where the non-striker backed up, so nobody jumps.
    for (const [i, r] of runners.entries()) {
      if (i === 0 && r.progress <= LEFT_CREASE) continue;
      const z = CREASE + r.progress * (BACKED_UP_Z - CREASE);
      const x = i === 0 ? STRIKER_X + (NON_STRIKER_X - STRIKER_X) * clamp(r.progress / 0.15) : NON_STRIKER_X;
      const kit = playerKit(scene.kitBat, inn.bat[r.bat].p);
      const moving = r.target !== null && live.t >= r.startAt;
      sprites.push({
        z,
        draw: () => figure(x, z, kit.height, { kit, pose: moving ? "run" : "stand", phase: scene.now * 3.5 + i, bat: true }),
      });
    }
  } else {
    const nonStrikerZ = nonStrikerDepth(scene);
    const nonStrikerKit = playerKit(scene.kitBat, inn.bat[inn.nonStriker].p);
    sprites.push({
      z: nonStrikerZ,
      draw: () =>
        figure(NON_STRIKER_X, nonStrikerZ, nonStrikerKit.height, {
          kit: nonStrikerKit,
          pose: scene.phase === "runup" ? "backup" : "stand",
          phase: scene.now * 1.4,
          bat: true,
        }),
    });
  }
  const bowler = bowlerState(scene);
  sprites.push({
    z: bowler.z,
    draw: () => figure(bowler.x, bowler.z, bowlerKit.height, { kit: bowlerKit, pose: bowler.pose, phase: bowler.phase }),
  });
  sprites.push({ z: 1.25, draw: () => drawStriker(scene) });
  // The near stumps: the striker's, or the bowler's end when the camera is there.
  const nearEnd = fromBowler ? 1 : 0;
  const nearZ = fromBowler ? PITCH_LENGTH - 0.02 : 0.02;
  sprites.push({
    z: nearZ,
    draw: () => {
      if (!stumpsBroken(scene, nearEnd)) ctx.drawImage(scene.game.images.stumps, 296, 270 + CLOSE_Y_OFFSET);
      else drawBrokenStumps(fromBowler ? PITCH_LENGTH : 0);
    },
  });

  const ball = ballPosition(scene);
  // Once past the striker's stumps the ball is out of this shot (near the camera it would freeze
  // in the corner of the picture); the wide view picks it up.
  if (ball && ball.z >= 0 && closeDepth(ball.z) > -7.5) {
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
  sprites.sort((a, b) => closeDepth(b.z) - closeDepth(a.z));
  if (scene.phase === "setup") drawTarget(scene);
  for (const s of sprites) s.draw();

  if (miniMapShown(scene)) {
    const fielders = live ? live.fielders.filter((f) => f.role === "field").map((f) => f.pos) : inn.placements.map((p) => p.pos);
    const keeper = live ? live.fielders[0].pos : keeperSpot(scene.spinner);
    const runners = live
      ? live.runners.map((r) => live.runnerPos(r))
      : [
          { x: -0.3, z: 1.2 },
          { x: -1, z: 19 },
        ];
    drawMiniMap(
      MINI_MAP.left,
      MINI_MAP.top,
      fielders,
      runners,
      live && cur?.contactDone ? { x: live.ball.pos.x, z: live.ball.pos.z } : null,
      keeper,
    );
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
  return cur.delivery ? BACKED_UP_Z : 19.1;
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

/** Are the stumps at `end` (0 = striker's, 1 = bowler's) broken right now? */
function stumpsBroken(scene, end) {
  const cur = scene.cur;
  const rec = cur?.done?.rec;
  const runOutHere = rec?.wicket?.how === "runout" && cur.play.live.events.some((e) => e.type === "runout" && e.end === end);
  if (end === 1) return !!runOutHere;
  if (cur?.play?.res?.bowled && cur.contactDone && !cur.delivery.noBall) return true;
  return !!(rec?.wicket && (rec.wicket.how === "bowled" || rec.wicket.how === "stumped" || runOutHere));
}

function drawBrokenStumps(z) {
  const base = projectClose(0, 0, z);
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
  const bearing =
    contact?.kind === "middle" ? (Math.atan2(contact.exit.x, contact.exit.z) * 180) / Math.PI : driveBearing(cur.lineAtBat);
  if (type === "cutpull") {
    const at = crossingAtZ(cur.delivery.samples, CONTACT_Z_BACK);
    const back = backFootShot(at?.x ?? cur.lineAtBat, at?.y ?? 0);
    if (back === "cut") return contact?.shotName === "late cut" ? BATTER_POSES.lateCutEnd : BATTER_POSES.cutEnd;
    if (back === "punch") return bearing > 25 ? BATTER_POSES.coverDriveEnd : BATTER_POSES.straightDriveEnd;
    if (back === "glance") return BATTER_POSES.clipEnd;
    return (at?.y ?? 0) > 1.35 ? BATTER_POSES.hookEnd : BATTER_POSES.pullEnd;
  }
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
  const fromBowler = closeFromBowlerEnd();
  const t = cur ? scene.clock() : 0;
  const ready = readyPose(scene, cur, t);
  let pose = ready;
  if (cur) {
    const arrive = cur.delivery ? scene.arrival(cur.swingType ?? cur.shot?.type ?? "drive", cur.shot?.foot) : 0.6;
    // Reach towards the line of the ball.
    const reach = clamp((projectFromStriker(cur.lineAtBat, 0, 1.9).x - (x + 12)) * 0.8, -8, 26);
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
      const back = playsBack("defend", cur.shot?.foot, cur.delivery?.pitchedAt?.z ?? 5);
      const block = back ? BATTER_POSES.defendBack : BATTER_POSES.defendFront;
      pose = lerpPose(ready, block, easeOut((t - cur.defendAt) / 0.09));
      pose = { ...pose, px: pose.px + reach * clamp((t - cur.defendAt) / 0.15) };
      shotDoneAt = cur.defendAt + 0.3;
    } else if (cur.leaveAt !== null && t >= cur.leaveAt) {
      pose = lerpPose(ready, BATTER_POSES.leave, (t - cur.leaveAt) / 0.18);
    } else if (scene.human === "bat" && cur.delivery && !cur.shot && t > arrive - LEAVE_LIFT) {
      // No shot chosen yet: start lifting the bat out of the way.
      pose = lerpPose(ready, BATTER_POSES.leave, (t - (arrive - LEAVE_LIFT)) / 0.18);
    }

    const play = cur.play;
    const res = play?.res;
    // Reactions once the ball has gone past: flinch if hit on the pad, recoil if beaten.
    if (res && cur.contactDone && !res.touchedBat) {
      if (res.padHit) pose = lerpPose(pose, BATTER_POSES.padFlinch, easeOut((t - res.start.t) / 0.12));
      else if (shotDoneAt !== null && t > shotDoneAt) pose = lerpPose(pose, BATTER_POSES.beaten, easeOut((t - shotDoneAt) / 0.2));
    }
    // Hidden once out (and walking off), or once he's left his crease (drawn as a runner then).
    if (
      (cur.done && play && cur.done.rec.wicket?.batter === play.striker && scene.phase !== "flight" && !scene.nets) ||
      (play && cur.contactDone && play.live.runners[0].progress > LEFT_CREASE)
    ) {
      return;
    }
  }
  // His own look; taller players are drawn bigger.
  const kit = playerKit(scene.kitBat, inn.bat[inn.striker].p);
  const tall = kit.height / STANDARD_HEIGHT;
  if (fromBowler) {
    // Down the far end, facing us.
    const p = projectClose(STRIKER_X, 0, CREASE);
    drawBatter(p.x, p.y + 1, (closePixelsPerMetre(CREASE) * kit.height) / BATTER_HEIGHT_PX, pose, kit, 0, true);
  } else {
    drawBatter(x, y, tall, pose, kit, kit.number || inn.striker + 1);
  }
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

/**
 * The ground's scoreboard, showing the real score: the batting side, then the side they're chasing
 * (or the overs, in the first innings).
 */
function drawGroundScoreboard(board, inn) {
  fillRect(board.x, board.y, board.w, board.h, board.colour);
  const mid = board.x + board.w / 2;
  // A narrow gap after the team, so even "AUS 487/10" fits the face.
  const line = (name, figures, y, color) => {
    const left = Math.round(mid - (textWidth(name) + 3 + textWidth(figures)) / 2);
    drawText(name, left, y, { color, shadow: null });
    drawText(figures, left + textWidth(name) + 3, y, { color, shadow: null });
  };
  line(inn.batTeam.abbr, `${inn.runs}/${inn.wkts}`, board.y + 1, board.top);
  if (inn.target !== null) line(inn.bowlTeam.abbr, String(inn.target - 1), board.y + 11, board.bottom);
  else line("OV", inn.oversText, board.y + 11, board.bottom);
}

function drawWide(scene) {
  ctx.drawImage(scene.groundArt.wide, 0, 0, WIDTH, HEIGHT);
  const inn = scene.inn;
  if (scene.ground.wide.scoreboard) drawGroundScoreboard(scene.ground.wide.scoreboard, inn);
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
    if (Math.floor(scene.now * 2) % 2 === 0) {
      drawText("PRESS SPACE TO FACE UP", WIDTH / 2, 6, { ...PANEL_TEXT, color: COLORS.gold, scale: 2 });
    }
    drawText("ESC = MENU & INSTRUCTIONS", WIDTH / 2, 24, { ...PANEL_TEXT, color: COLORS.dim });
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
    drawText("SPACE TO RELEASE AT THE DELIVERY STRIDE  -  HOLD LEFT/RIGHT FOR AFTERTOUCH", WIDTH / 2, 6, {
      ...PANEL_TEXT,
      color: COLORS.gold,
    });
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
    if (loser === playerSide && inn.reviews[loser] > 0) drawReviewChoice(scene, inn.reviews[loser]);
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

  if (scene.feedback && (scene.phase === "after" || scene.phase === "return")) drawCoachCard(scene);
  if (!scene.nets && SPEED_GUN_PHASES.has(scene.phase)) drawSpeedGun(scene);
  if (scene.human === "bat" && EYE_PHASES.has(scene.phase)) drawEyeMeter(scene);
  if (scene.phase === "pause") scene.pauseMenu.draw(inn, scene.closeEnd);

  if (scene.phase === "inningsEnd") {
    const ending = scene.ending;
    drawScorecard(inn, 20, 18, 600, 290, ending.title);
    drawText(ending.sub, WIDTH / 2, 284, { align: "center", color: COLORS.cream });
    drawText(
      ending.next ? "ENTER = START THE CHASE" : scene.hasScoreboard ? "ENTER = HIGH SCORES" : "ENTER = MENU",
      WIDTH / 2,
      296,
      { align: "center", color: COLORS.gold },
    );
  }
}

const SPEED_GUN_PHASES = new Set(["flight", "after", "return", "appeal", "decision"]);

/** Broadcast-style speed gun: pace as it's bowled, then the movement once it has passed the bat. */
function drawSpeedGun(scene) {
  const d = scene.cur?.delivery;
  if (!d) return;
  const parts = scene.cur.contactDone || scene.cur.t > 1.2 ? movementParts(d) : [];
  const shown = scene.cur.contactDone || scene.cur.t > 1.2 ? (parts.length ? parts : ["STRAIGHT ON"]) : [];
  const w = 108;
  const h = 24 + shown.length * 9;
  const x = WIDTH - w - 4;
  const y = HUD_Y - h - 3;
  drawPanel(x, y, w, h, "rgba(10,28,18,0.88)", COLORS.gold2);
  drawText(`${Math.round(d.speed * 3.6)} KM/H`, x + w / 2, y + 5, { align: "center", color: COLORS.gold, scale: 2 });
  shown.forEach((line, i) => drawText(line, x + w / 2, y + 21 + i * 9, { align: "center", color: COLORS.cream }));
}

const EYE_PHASES = new Set(["ready", "runup", "flight", "after", "return", "appeal", "decision", "review"]);

/** The striker's eye: a bar that fills with well-timed shots, and the multiplier it gives the next one. */
function drawEyeMeter(scene) {
  const eye = scene.inn.bat[scene.inn.striker].eye;
  const full = eye >= 1;
  const w = 108;
  const h = 24;
  const x = 4;
  const y = 4;
  drawPanel(x, y, w, h, "rgba(10,28,18,0.88)", full ? COLORS.gold : COLORS.gold2);
  drawText("EYE", x + 6, y + 5, { color: COLORS.gold });
  drawText(`x${eyeMultiplier(eye).toFixed(2)}`, x + w - 6, y + 5, { color: eye > 0 ? COLORS.gold : COLORS.dim, align: "right" });
  const glow = full && Math.floor(scene.now * 4) % 2 === 0;
  drawBar(x + 6, y + 15, w - 12, 5, eye, glow ? COLORS.white : eye > 0.6 ? COLORS.gold : "#7ec8ff");
}

/** Nets: the coach's verdict on the last ball. */
function drawCoachCard(scene) {
  const fb = scene.feedback;
  const lines = fb.lines.flatMap((l) => wrapText(l, 62));
  const h = 34 + lines.length * 10;
  const x = 110;
  const y = 34;
  const accent = fb.grade === "good" ? "#7cd67c" : fb.grade === "poor" ? COLORS.red : COLORS.gold;
  drawPanel(x, y, 420, h, "rgba(10,28,18,0.92)", accent);
  const tally = scene.netsTally;
  drawText(`COACH  -  ${fb.title}`, x + 8, y + 6, { color: accent });
  drawText(`BALL ${tally.balls}   GOOD ${tally.good}`, x + 412, y + 6, { color: COLORS.dim, align: "right" });
  lines.forEach((line, i) =>
    drawText(line, x + 8, y + 19 + i * 10, { color: line.startsWith("COACH:") ? COLORS.gold : COLORS.cream }),
  );
  if (scene.phase === "after" && scene.phaseT > 0.6) {
    drawText("SPACE = NEXT BALL", x + 210, y + h - 9, { align: "center", color: COLORS.dim });
  }
}

/** Bar showing the run-up against the release window, and where the last release landed. */
function drawReleaseMeter(scene) {
  const cur = scene.cur;
  const r = cur.runup;
  const from = METER_FROM;
  const to = 1 + 0.3 / r.dur;
  const x0 = 200;
  const w = 240;
  const y = 22;
  const toX = (pos) => x0 + ((pos - from) / (to - from)) * w;
  fillRect(x0 - 1, y - 1, w + 2, 8, COLORS.black);
  fillRect(x0, y, w, 6, "#203a2a");
  // Too late: no-ball territory.
  fillRect(toX(noBallPos(r)), y, toX(to) - toX(noBallPos(r)), 6, COLORS.red);
  const half = r.zone / r.dur;
  fillRect(toX(1 - half), y, Math.max(2, toX(1 + half) - toX(1 - half)), 6, COLORS.gold);
  const at = cur.delivery ? cur.releaseMark : meterPos(r, cur.tRun);
  fillRect(clamp(toX(at), x0, x0 + w) - 1, y - 3, 3, 12, COLORS.white);
  // Aftertouch, shown the way it was pushed on screen.
  const touch = (cur.aftertouch ?? 0) * scene.screenTurn;
  if (touch) {
    const mid = x0 + w / 2;
    fillRect(touch > 0 ? mid : mid + touch * 60, y + 10, Math.abs(touch) * 60, 3, COLORS.gold);
    drawText(scene.spinner ? "EXTRA SPIN" : "EXTRA SWING", mid, y + 15, { ...PANEL_TEXT, color: COLORS.gold });
  }
}

/** The decision went against the player: review it or accept it, against the clock. */
function drawReviewChoice(scene, left) {
  const w = 300;
  const x = WIDTH / 2 - w / 2;
  const y = 4;
  const secs = scene.reviewTimeLeft;
  drawPanel(x, y, w, 44, "rgba(10,28,18,0.92)", COLORS.gold);
  drawText(scene.cur.onField ? "GIVEN OUT LBW" : "NOT OUT", WIDTH / 2, y + 6, { align: "center", color: COLORS.cream });
  drawText(`R: REVIEW (${left} LEFT)    SPACE: ACCEPT`, WIDTH / 2, y + 18, { align: "center", color: COLORS.gold });
  drawText(String(Math.ceil(secs)), x + w - 8, y + 6, { align: "right", color: secs < 3 ? COLORS.red : COLORS.dim });
  drawBar(x + 8, y + 32, w - 16, 4, secs / 10, secs < 3 ? COLORS.red : COLORS.gold);
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
