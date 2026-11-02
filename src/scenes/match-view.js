import { activeWicketSide } from "./bowling-side.js";
import { bowlingGeometry } from "../sim/bowling-side.js";
import { bowlerPose } from "../render/bowler-motion.js";
import { drawMatchBroadcast } from "../render/match-broadcast.js";
import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawLine } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";
import { clamp } from "../math.js";
import { CREASE, PITCH_LENGTH, MID_PITCH } from "../sim/geometry.js";
import { DELIVERY_NAMES, SPIN_EFFORT_NAMES, sampleAtTime } from "../sim/delivery.js";
import { keeperSpot } from "../sim/field.js";
import { walkInSpot } from "../sim/fielder-motion.js";
import {
  CLOSE_Y_OFFSET,
  projectClose,
  closePixelsPerMetre,
  closeDepth,
  setCloseEnd,
  closeFromBowlerEnd,
  projectWide,
} from "../render/camera.js";
import { drawFigure, drawTinyFigure, fielderPose, drawBall, drawShadow, setShadowStretch, playerKit } from "../render/sprites.js";
import { drawBooth, boothShowing } from "../render/booth.js";
import { drawBallTrail, drawPitchReticle } from "../render/ball-trail.js";
import { shakeOffset } from "./match-feedback.js";
import { STRIKER_X } from "./batter-pose.js";
import { HUD_Y, drawScoreBar, drawScoreBox, drawMiniMap, drawBanners, drawSpeechBubble } from "../render/hud.js";
import { LEFT_CREASE, drawStriker } from "./match-striker.js";
import { showingWide, SPEED_GUN_MAX_H, drawPanels, drawFeedback } from "./match-panels.js";

const WALK_OFF_TIME = 8;
const SLEDGE_TIME = 2.4;
/** Near the close camera, figures are capped at the striker's size (about 1.8 m in 94 px). */
const NEAR_PIXELS_PER_METRE = 52;
/** How far down the pitch the non-striker backs up once the ball is bowled. */
const BACKED_UP_Z = 17.9;

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
        kit: { ...scene.kitBowl, cap: "#f4f4f0" },
        pose: umpirePose,
        phase: 0,
        umpire: true,
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
      ? live.runners.map((r) =>
          r.bat === live.setup.nonStrikerIdx && r.target === null && r.progress === 1
            ? { x: nonStrikerX, z: nonStrikerDepth(scene) }
            : live.runnerPos(r),
        )
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
  add(activeWicketSide(scene) === "around" ? 1.2 : -1.2, 0, PITCH_LENGTH + 2.4, (x, y, s) =>
    drawTinyFigure(x, y, s, "idle", "#f4f4f0"),
  );
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
    add(nonStrikerX, 0, nonStrikerDepth(scene), (x, y, s) =>
      drawTinyFigure(x, y, s, "batter", scene.kitBat.cap, 0, { bat: true }),
    );
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
