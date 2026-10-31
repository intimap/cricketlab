import { selectedWicketSide, activeWicketSide } from "./bowling-side.js";
import { bowlingGeometry } from "../sim/bowling-side.js";
import { bowlerPose } from "../render/bowler-motion.js";
import { drawSetupPanel } from "../render/bowling-setup.js";
import { drawBatterMeters, meterAnchors } from "../render/batter-meters.js";
import { drawMatchBroadcast } from "../render/match-broadcast.js";
import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawLine, drawPanel, drawBar } from "../engine/screen.js";
import { drawText, textWidth, wrapText } from "../engine/text.js";
import { clamp, easeOut } from "../math.js";
import { CREASE, PITCH_LENGTH, MID_PITCH } from "../sim/geometry.js";
import { isSpinner } from "../sim/teams.js";
import {
  DELIVERY_NAMES,
  SPIN_EFFORT_NAMES,
  sampleAtTime,
  movementParts,
} from "../sim/delivery.js";
import { PRESET_LABELS, keeperSpot } from "../sim/field.js";
import { walkInSpot } from "../sim/fielder-motion.js";
import {
  CLOSE_Y_OFFSET,
  closeGroundY,
  projectClose,
  closePixelsPerMetre,
  closeDepth,
  setCloseEnd,
  closeFromBowlerEnd,
  projectWide,
} from "../render/camera.js";
import {
  BATTER_POSES,
  solveBatterRig,
  lerpPose,
  drawBatter,
  drawFigure,
  drawTinyFigure,
  fielderPose,
  drawBall,
  drawShadow,
  setShadowStretch,
  playerKit,
} from "../render/sprites.js";
import { drawBooth, boothShowing } from "../render/booth.js";
import { drawBallTrail, drawPitchReticle } from "../render/ball-trail.js";
import { drawTimingMeter, drawFloat } from "../render/feedback.js";
import { shakeOffset, floatAge, timingFade } from "./match-feedback.js";
import { STRIKER_X, STRIKER_SCREEN_X, readyPose, strikerStroke, footworkOf, footworkPixels } from "./batter-pose.js";
import { METER_FROM, meterPos, noBallPos } from "../sim/runup.js";
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

const WALK_OFF_TIME = 8;
const SLEDGE_TIME = 2.4;
const PANEL_TEXT = { align: "center", outline: "rgba(0,0,0,0.7)" };
/** Near the close camera, figures are capped at the striker's size (about 1.8 m in 94 px). */
const NEAR_PIXELS_PER_METRE = 52;
/** The striker's height in pixels when drawn at scale 1, for a player of STANDARD_HEIGHT metres. */
const BATTER_HEIGHT_PX = 92;
const STANDARD_HEIGHT = 1.82;
/** Run progress (0..1) at which the striker has left his crease and is drawn as a runner. */
const LEFT_CREASE = 0.02;
/** How far down the pitch the non-striker backs up once the ball is bowled. */
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
  // A sweet strike or broken stumps shakes the picture (not the scoreboard) by a pixel.
  const shake = shakeOffset(scene.juice, scene.now);
  if (shake) {
    ctx.save();
    ctx.translate(shake.x, shake.y);
  }
  if (showingWide(scene)) drawWide(scene);
  else drawClose(scene);
  if (shake) ctx.restore();
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
  if (booth) drawBooth(scene.booth, scene.now, scene.commentary);
  drawBanners(scene.banners, scene.now);
  drawPanels(scene);
  drawFeedback(scene);
  drawMatchBroadcast(scene);
}

// --- Close view: the broadcast angle down the pitch. ---

function drawClose(scene) {
  setCloseEnd(scene.closeEnd === "bowl");
  const fromBowler = closeFromBowlerEnd();
  ctx.drawImage(scene.groundArt.close, 0, CLOSE_Y_OFFSET, WIDTH, HEIGHT);
  const cur = scene.cur;
  const inn = scene.inn;
  const nonStrikerX = bowlingGeometry(scene.spinner, activeWicketSide(scene)).nonStrikerX;
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
      figure(bowlingGeometry(scene.spinner, activeWicketSide(scene)).umpireX, 22.6, 1.78, {
        kit: { ...scene.kitBowl, cap: "#f4f4f0" }, pose: umpirePose, phase: 0, umpire: true,
      }),
  });
  const bowlerKit = playerKit(scene.kitBowl, inn.bowler?.p);
  const runners = live && cur.contactDone ? live.runners : null;
  if (runners && (runners[1].target !== null || runners[1].progress < 1)) {
    // Running: both batters along the pitch (the striker only once he's left his crease; until then he's
    // drawn batting). Depths run from the crease to where the non-striker backed up, so nobody jumps.
    for (const [i, r] of runners.entries()) {
      if (i === 0 && r.progress <= LEFT_CREASE) continue;
      const z = CREASE + r.progress * (BACKED_UP_Z - CREASE);
      const x = i === 0 ? STRIKER_X + (nonStrikerX - STRIKER_X) * clamp(r.progress / 0.15) : nonStrikerX;
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
        figure(nonStrikerX, nonStrikerZ, nonStrikerKit.height, {
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
          const trail = ballTrail(scene);
          if (trail.length) drawBallTrail(trail, scene.spinner);
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

  // The pitch map's landing marker, on the ground under everyone.
  const landing = landingMarker(scene);
  if (landing) drawPitchReticle(landing.p, landing.k, landing.flash, landing.scale);

  // Far to near.
  sprites.sort((a, b) => closeDepth(b.z) - closeDepth(a.z));
  if (scene.phase === "setup") drawTarget(scene);
  for (const s of sprites) s.draw();

  if (miniMapShown(scene)) {
    const fielders = live
      ? live.fielders.filter((f) => f.role === "field").map((f) => f.pos)
      : inn.placements.map((p) => walkInSpot(p.pos, walkInShare(scene)));
    const keeper = live ? live.fielders[0].pos : keeperSpot(scene.spinner);
    const runners = live
      ? live.runners.map((r) => r.bat === live.setup.nonStrikerIdx && r.target === null && r.progress === 1
        ? { x: nonStrikerX, z: nonStrikerDepth(scene) } : live.runnerPos(r))
      : [
          { x: -0.3, z: 1.2 },
          { x: nonStrikerX, z: 19 },
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
  return bowlerPose(scene, activeWicketSide(scene));
}

/** Seconds between trail dots, and how many: the ball's last few positions in flight. */
const TRAIL_STEP = 1 / 60;
const TRAIL_DOTS = 5;

/** The trail behind the delivery (screen points, newest first), until it reaches the bat or pads. */
function ballTrail(scene) {
  const cur = scene.cur;
  if (!cur?.delivery || cur.contactDone || scene.phase !== "flight") return [];
  const samples = cur.delivery.samples;
  const points = [];
  for (let i = 1; i <= TRAIL_DOTS; i++) {
    const t = cur.t - i * TRAIL_STEP;
    if (t <= 0) break;
    const s = sampleAtTime(samples, Math.min(t, samples[samples.length - 1].t));
    if (s.z < 0) continue;
    const p = projectClose(s.x, s.y, s.z);
    points.push({ x: p.x, y: p.y, r: Math.max(1.5, 0.036 * 880 * p.s * 1.25) });
  }
  return points;
}

/** How long (s) the landing marker flashes on the bounce. */
const LANDING_FLASH = 0.2;

/** Where the delivery will pitch, while it's in the air and just after it lands. */
function landingMarker(scene) {
  const cur = scene.cur;
  const d = cur?.delivery;
  if (!d?.pitchedAt || d.bounceIndex < 0 || scene.phase !== "flight") return null;
  const bounceT = d.samples[d.bounceIndex].t;
  const since = cur.t - bounceT;
  if (since > LANDING_FLASH) return null;
  const p = projectClose(d.pitchedAt.x, 0, d.pitchedAt.z);
  return {
    p,
    k: clamp(cur.t / bounceT),
    flash: since >= 0 ? 1 - since / LANDING_FLASH : 0,
    scale: p.s / projectClose(0, 0, PITCH_LENGTH / 2).s,
  };
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

/**
 * Bringing the blade onto the ball at contact: the hands move at most HAND_REACH (pose units) and the bat
 * turns at most BAT_TURN (degrees) to take it the rest of the way, easing in over ALIGN_IN, holding for
 * ALIGN_HOLD and letting go over ALIGN_OUT (s).
 */
const HAND_REACH = 14;
const BAT_TURN = 70;
const ALIGN_IN = 0.1;
const ALIGN_HOLD = 0.05;
const ALIGN_OUT = 0.15;
const smoothstep = (k) => {
  const c = clamp(k);
  return c * c * (3 - 2 * c);
};

/**
 * How to move the hands ({ x, y } in pose units) and turn the bat ({ a } degrees) so the blade meets the
 * ball where it actually is on screen at contact. Worked out once per ball and view.
 */
function contactOffset(scene, cur, place) {
  const res = cur.play.res;
  const key = place.front ? "bowl" : "bat";
  cur.batOffset ??= {};
  if (cur.batOffset[key]) return cur.batOffset[key];
  const { pose } = strikerStroke(scene, cur, res.start.t, place.front);
  const ball = projectClose(res.start.pos.x, res.start.pos.y, res.start.pos.z);
  const at = (q) => ({ x: place.x + (place.front ? -q.x : q.x) * place.scale, y: place.y + q.y * place.scale });
  // Screen distance from the ball to the blade (shoulder to toe) for a pose.
  const gap = (p) => {
    const rig = solveBatterRig(p, place.front);
    const a = at({ x: rig.topHand.x + rig.dir.x * 9, y: rig.topHand.y + rig.dir.y * 9 });
    const b = at({ x: rig.topHand.x + rig.dir.x * 36, y: rig.topHand.y + rig.dir.y * 36 });
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const k = clamp(((ball.x - a.x) * vx + (ball.y - a.y) * vy) / (vx * vx + vy * vy || 1));
    return { dx: ball.x - (a.x + vx * k), dy: ball.y - (a.y + vy * k) };
  };
  // The hands first, as far as they'll go towards the ball...
  const g = gap(pose);
  let dx = (g.dx / place.scale) * (place.front ? -1 : 1);
  let dy = g.dy / place.scale;
  const len = Math.hypot(dx, dy);
  if (len > HAND_REACH) {
    dx *= HAND_REACH / len;
    dy *= HAND_REACH / len;
  }
  // ...then whichever turn of the bat brings the blade closest (the smaller turn if it's a tie).
  let best = { a: 0, d: Infinity };
  for (let a = -BAT_TURN; a <= BAT_TURN; a += 5) {
    const r = gap({ ...pose, px: pose.px + dx, py: pose.py + dy, angle: pose.angle + a });
    const d = Math.hypot(r.dx, r.dy) + Math.abs(a) * 0.01;
    if (d < best.d) best = { a, d };
  }
  return (cur.batOffset[key] = { x: dx, y: dy, a: best.a });
}

/**
 * When the bat really does meet the ball (middle or edge), bring the blade onto it around contact.
 * Misses are left alone: a miss stays a miss.
 */
function alignToBall(scene, cur, pose, t, place) {
  const res = cur.play?.res;
  if (!res?.touchedBat) return pose;
  const tc = res.start.t;
  const w =
    t < tc
      ? smoothstep((t - (tc - ALIGN_IN)) / ALIGN_IN)
      : t < tc + ALIGN_HOLD
        ? 1
        : 1 - smoothstep((t - tc - ALIGN_HOLD) / ALIGN_OUT);
  if (w <= 0) return pose;
  const off = contactOffset(scene, cur, place);
  return { ...pose, px: pose.px + off.x * w, py: pose.py + off.y * w, angle: pose.angle + off.a * w };
}

/** Where and how big the striker is drawn: from the batter's end, or down the far end facing us. */
function strikerPlace(scene, kit, fromBowler, moved = 0) {
  if (fromBowler) {
    const p = projectClose(STRIKER_X + moved, 0, CREASE);
    return { x: p.x, y: p.y + 1, scale: (closePixelsPerMetre(CREASE) * kit.height) / BATTER_HEIGHT_PX, front: true };
  }
  return {
    x: STRIKER_SCREEN_X + footworkPixels(moved),
    y: closeGroundY(CREASE) + 2,
    scale: kit.height / STANDARD_HEIGHT,
    front: false,
  };
}

function drawStriker(scene) {
  const cur = scene.cur;
  const inn = scene.inn;
  const fromBowler = closeFromBowlerEnd();
  const t = cur ? scene.clock() : 0;
  // His own look; taller players are drawn bigger.
  const kit = playerKit(scene.kitBat, inn.bat[inn.striker].p);
  const place = strikerPlace(scene, kit, fromBowler, footworkOf(scene, cur, t));
  let pose = readyPose(scene, cur, t);
  if (cur) {
    const stroke = strikerStroke(scene, cur, t, fromBowler);
    pose = alignToBall(scene, cur, stroke.pose, t, place);

    const play = cur.play;
    const res = play?.res;
    // Reactions once the ball has gone past: flinch if hit on the pad, recoil if beaten (old poses only;
    // a rig stroke plays on through its follow-through).
    if (res && cur.contactDone && !res.touchedBat && !stroke.rig) {
      if (res.padHit) pose = lerpPose(pose, BATTER_POSES.padFlinch, easeOut((t - res.start.t) / 0.12));
      else if (stroke.shotDoneAt !== null && t > stroke.shotDoneAt)
        pose = lerpPose(pose, BATTER_POSES.beaten, easeOut((t - stroke.shotDoneAt) / 0.2));
    }
    // Hidden once out (and walking off), or once he's left his crease (drawn as a runner then).
    if (
      (cur.done && play && cur.done.rec.wicket?.batter === play.striker && scene.phase !== "flight" && !scene.nets) ||
      (play && cur.contactDone && play.live.runners[0].progress > LEFT_CREASE)
    ) {
      return;
    }
  }
  drawBatter(place.x, place.y, place.scale, pose, kit, place.front ? 0 : kit.number || inn.striker + 1, place.front);
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

/** How far through their walk-in the ring is (0..1): during the run-up, and at the ball once bowled. */
function walkInShare(scene) {
  const cur = scene.cur;
  if (scene.phase === "runup" && cur) return clamp(cur.tRun / cur.runupDur);
  return scene.phase === "flight" ? 1 : 0;
}

function drawWide(scene) {
  ctx.drawImage(scene.groundArt.wide, 0, 0, WIDTH, HEIGHT);
  const inn = scene.inn;
  if (scene.ground.wide.scoreboard) drawGroundScoreboard(scene.ground.wide.scoreboard, inn);
  const cur = scene.cur;
  const live = cur?.play?.live;
  const cap = scene.kitBowl.cap;
  const nonStrikerX = bowlingGeometry(scene.spinner, activeWicketSide(scene)).nonStrikerX;
  const sprites = [];
  const add = (x, y, z, draw) => {
    const p = projectWide(x, y, z);
    sprites.push({ y: p.y, draw: () => draw(p.x, p.y, p.s) });
  };

  // Umpires.
  add(activeWicketSide(scene) === "around" ? 1.2 : -1.2, 0, PITCH_LENGTH + 2.4,
    (x, y, s) => drawTinyFigure(x, y, s, "idle", "#f4f4f0"));
  add(-26, 0, 1, (x, y, s) => drawTinyFigure(x, y, s, "idle", "#f4f4f0"));

  if (live && (scene.phase === "flight" || scene.phase === "after" || scene.phase === "return")) {
    for (const f of live.fielders) {
      const pose = fielderPose(f, live.t, scene.phase);
      add(f.pos.x, 0, f.pos.z, (x, y, s) => drawTinyFigure(x, y, s, pose, cap, scene.now * 3 + f.idx));
    }
    for (const r of live.runners) {
      const out = cur?.done?.rec.wicket?.batter === r.bat;
      let pos = live.runnerPos(r);
      if (r.bat === live.setup.nonStrikerIdx && r.target === null && r.progress === 1)
        pos = { x: nonStrikerX, z: nonStrikerDepth(scene) };
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
    const bowler = bowlerState(scene);
    add(bowler.x, 0, bowler.z, (x, y, s) => drawTinyFigure(x, y, s, bowler.pose, cap, bowler.phase));
    const walk = walkInShare(scene);
    inn.placements.forEach((place, i) => {
      const at = walkInSpot(place.pos, walk);
      add(at.x, 0, at.z, (x, y, s) => {
        drawTinyFigure(x, y, s, walk <= 0 ? "idle" : walk < 1 ? "run" : "keeper", cap, scene.now * 1.5 + i);
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
    add(nonStrikerX, 0, nonStrikerDepth(scene), (x, y, s) => drawTinyFigure(x, y, s, "batter", scene.kitBat.cap, 0, { bat: true }));
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
  if (scene.phase === "setup") drawSetupPanel(scene, selectedWicketSide(scene));

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
  if (METER_PHASES.has(scene.phase)) drawBatterPanel(scene);
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

const METER_PHASES = new Set(["ready", "runup", "flight", "after", "return", "appeal", "decision", "review"]);

/** The shared meter panel returns once the run-up has begun. */
function drawBatterPanel(scene) {
  const eye = scene.inn.bat[scene.inn.striker].eye;
  drawBatterMeters({
    eye,
    pressure: scene.inn.pressure,
    eyeShown: scene.juice.shown.eye ?? eye,
    pressureShown: scene.juice.shown.pressure ?? scene.inn.pressure,
    now: scene.now,
    top: 4,
  });
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
const RELEASE_GOLD = "#ffe066";
const TIMING_METER = { x: 440, y: 268 };

/**
 * The arcade feedback (scenes/match-feedback.js): words floating off the striker and the HUD's eye and
 * pressure bars, and the player's timing meter beside the striker.
 */
function drawFeedback(scene) {
  const fb = scene.juice;
  const anchors = METER_PHASES.has(scene.phase) ? meterAnchors() : {};
  if (fb.floats.some((f) => f.anchor === "striker")) {
    if (showingWide(scene)) {
      const p = projectWide(STRIKER_X, 2, CREASE);
      anchors.striker = { x: p.x, y: p.y - 6 };
    } else {
      const kit = playerKit(scene.kitBat, scene.inn.bat[scene.inn.striker].p);
      const place = strikerPlace(scene, kit, closeFromBowlerEnd(), footworkOf(scene, scene.cur, scene.cur ? scene.clock() : 0));
      anchors.striker = { x: place.x, y: place.y - 112 * place.scale };
    }
  }
  for (const f of fb.floats) {
    const at = anchors[f.anchor];
    if (at) drawFloat(f.text, at.x, at.y, f.color, floatAge(f, scene.now));
  }
  // On the open grass to the off side of the striker, clear of the stumps and the panels.
  if (fb.timing) drawTimingMeter(TIMING_METER.x, TIMING_METER.y, fb.timing.timing, timingFade(fb, scene.now));
}

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
  // The gold zone, bright with a crisp dark edge either side so it reads against the bar.
  const half = r.zone / r.dur;
  const zoneL = Math.round(toX(1 - half));
  const zoneW = Math.max(3, Math.round(toX(1 + half)) - zoneL);
  fillRect(zoneL - 1, y - 1, zoneW + 2, 8, COLORS.black);
  fillRect(zoneL, y, zoneW, 6, RELEASE_GOLD);
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
