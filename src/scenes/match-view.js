import { activeWicketSide } from "./bowling-side.js";
import { drawLengthZone } from "../render/length-zone.js";
import { bowlingGeometry, armOf } from "../sim/bowling-side.js";
import { drawMatchBroadcast } from "../render/match-broadcast.js";
import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawLine } from "../engine/screen.js";
import { clamp } from "../math.js";
import { BALL_RADIUS, CREASE, PITCH_LENGTH, MID_PITCH } from "../sim/geometry.js";
import { deliveryName, SPIN_EFFORT_NAMES, sampleAtTime } from "../sim/delivery.js";
import { keeperSpot } from "../sim/field.js";
import { walkInSpot } from "../sim/fielder-motion.js";
import {
  CLOSE_Y_OFFSET,
  projectClose,
  closePixelsPerMetre,
  closeDepth,
  setCloseEnd,
  closeFromBowlerEnd,
  setFacing,
  viewFacing,
} from "../render/camera.js";
import { drawFigure, drawBall, drawShadow, setShadowStretch, setShadowCast, playerKit } from "../render/sprites.js";
import { drawBooth, boothShowing } from "../render/booth.js";
import { drawBallTrail, drawPitchReticle } from "../render/ball-trail.js";
import { shakeOffset } from "./match-feedback.js";
import { STRIKER_X } from "./batter-pose.js";
import { HUD_Y, drawScoreBar, drawScoreBox, drawMiniMap, drawBanners } from "../render/hud.js";
import { drawCallLine } from "../render/call-line.js";
import { drawPracticeBar } from "../render/practice-bar.js";
import { practiceBarOf } from "./practice-session.js";
import { LEFT_CREASE, drawStriker } from "./match-striker.js";
import {
  NON_STRIKER_Z,
  NEAR_PIXELS_PER_METRE,
  nonStrikerDepth,
  bowlerState,
  walkInShare,
  runnerSpot,
} from "./match-positions.js";
import { drawWide } from "./match-wide.js";
import { gradeFrame } from "../render/lighting.js";
import { castShadows, closeStreak } from "./match-shadows.js";
import { showingWide, SPEED_GUN_MAX_H, drawPanels, drawFeedback } from "./match-panels.js";
import { drawWeatherTile, ICON } from "../render/weather-icon.js";
import { statusLine } from "./match-test.js";
import { raining } from "./match-light.js";
import { drawRain, drawCovers } from "../render/rain.js";
import { drawBallRing } from "../render/ball-ring.js";
import { assistOf } from "./assists.js";
import { bowlerSkeleton } from "../render/bowler/bowler-skeleton.js";
import { drawBowlerRig } from "../render/bowler/bowler-draw.js";
import { closeArt, drawCloseBoard } from "./venue-view.js";
import { runBarOf } from "./run-bar.js";
import { drawRunBar } from "../render/run-bar.js";

/** The score box's left edge (render/hud.js drawScoreBox: 132 wide, 4 from the right). */
const SCORE_BOX_LEFT = WIDTH - 4 - 132;
/** The close view's mini-map, on the right just above where the speed gun pops up. */
const MINI_MAP = { left: 552, top: HUD_Y - 3 - SPEED_GUN_MAX_H - 66 };
const miniMapShown = (scene) =>
  !showingWide(scene) && scene.phase !== "setup" && scene.phase !== "chooseBowler" && scene.phase !== "rain";

export function drawMatch(scene) {
  setShadowStretch(scene.light.shadow.stretch);
  // The sim's positions are in the striker's frame; the camera mirrors them back for a left-hander.
  setFacing(scene.facing);
  // A sweet strike or broken stumps shakes the picture (not the scoreboard) by a pixel.
  const shake = shakeOffset(scene.juice, scene.now);
  if (shake) {
    ctx.save();
    ctx.translate(shake.x, shake.y);
  }
  if (showingWide(scene)) drawWide(scene);
  else {
    // Without cast silhouettes (SIMPLE effects) the close figures' shadows streak away from the sun too.
    setShadowCast(closeStreak(scene));
    drawClose(scene);
    setShadowCast(null);
  }
  if (shake) ctx.restore();
  // The time of day's grade, over everything on the field (not the scoreboard and panels drawn after).
  gradeFrame(ctx, scene.light);
  if (raining(scene)) drawRain(scene.now);
  const effort = scene.cur?.intent.effort ?? scene.effort;
  // Batting, what's coming isn't given away: the delivery shows once he's played it (with the speed gun).
  const played = !!scene.cur && (scene.cur.contactDone || scene.cur.t > 1.2);
  const label =
    scene.inn.bowler && (scene.human === "bowl" || played)
      ? `${deliveryName(scene.cur?.intent.type ?? scene.deliveryType, scene.inn.bowler.p.bowl)} ${scene.spinner ? SPIN_EFFORT_NAMES[effort] : effort.toUpperCase()}`
      : "";
  // The caller's call for the ball on the bottom line (or, between times, the plain text), typing itself out.
  const booth = boothShowing(scene.booth, scene.now);
  const typed = scene.callLine ? "" : scene.commentary.slice(0, Math.floor(scene.commT * 70));
  // Practice has no score: its own strip (render/practice-bar.js).
  if (scene.nets) drawPracticeBar(practiceBarOf(scene, label, typed));
  else drawScoreBar(scene.inn, typed, label, statusLine(scene));
  if (scene.callLine) drawCallLine(scene.callLine, scene.now, HUD_Y + 31);
  // The score in the corner (and the weather beside it), except over the full scorecard and the pause menu.
  if (!scene.nets && scene.phase !== "pause" && scene.phase !== "inningsEnd") {
    drawScoreBox(scene.inn);
    if (scene.match.weather) drawWeatherTile(scene.match.weather.id, SCORE_BOX_LEFT - ICON.w - 8, 4);
  }
  // At the end of an innings (and over the weather report) the commentators sit on top, so they can be seen.
  const over = scene.phase === "inningsEnd" || scene.phase === "forecast" || scene.phase === "rain";
  if (booth && !over) drawBooth(scene.booth, scene.now, scene.commentary);
  drawBanners(scene.banners, scene.now);
  drawPanels(scene);
  // Where the batters are along the pitch while the ball's in play.
  const runBar = runBarOf(scene);
  if (runBar) drawRunBar(runBar, scene.now);
  if (booth && over) drawBooth(scene.booth, scene.now, scene.commentary);
  drawFeedback(scene);
  drawMatchBroadcast(scene);
}

// --- Close view: the broadcast angle down the pitch. ---

function drawClose(scene) {
  setCloseEnd(scene.closeEnd === "bowl");
  const fromBowler = closeFromBowlerEnd();
  ctx.drawImage(closeArt(scene), 0, CLOSE_Y_OFFSET, WIDTH, HEIGHT);
  drawCloseBoard(scene);
  const cur = scene.cur;
  const inn = scene.inn;
  // The non-striker, umpire, bowler and footmarks are where they are in the world, whoever is batting.
  const w = viewFacing();
  const arm = armOf(inn.bowler?.p.bowl);
  const nonStrikerX = bowlingGeometry(scene.spinner, activeWicketSide(scene), arm).nonStrikerX * w;
  const live = cur?.play?.live;
  drawRough(inn.pitch, w);
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
  const umpireX = bowlingGeometry(scene.spinner, activeWicketSide(scene), arm).umpireX * w;
  sprites.push({
    z: 22.6,
    cast: { x: umpireX, z: 22.6, height: 1.78 },
    draw: () =>
      figure(umpireX, 22.6, 1.78, {
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
      const z = CREASE + r.progress * (NON_STRIKER_Z - CREASE);
      const x = i === 0 ? STRIKER_X + (nonStrikerX - STRIKER_X) * clamp(r.progress / 0.15) : nonStrikerX;
      const kit = playerKit(scene.kitBat, inn.bat[r.bat].p);
      const moving = r.target !== null && live.t >= r.startAt;
      // Diving for his crease, and down on the turf for a moment after it.
      const down = r.diving || live.t < (r.downUntil ?? 0);
      const pose = down ? "dive" : moving ? "run" : "stand";
      sprites.push({
        z,
        cast: { x, z, height: kit.height },
        draw: () => figure(x, z, kit.height, { kit, pose, phase: scene.now * 3.5 + i, bat: true }),
      });
    }
  } else {
    const nonStrikerZ = nonStrikerDepth(scene);
    const nonStrikerKit = playerKit(scene.kitBat, inn.bat[inn.nonStriker].p);
    sprites.push({
      z: nonStrikerZ,
      cast: { x: nonStrikerX, z: nonStrikerZ, height: nonStrikerKit.height },
      draw: () =>
        figure(nonStrikerX, nonStrikerZ, nonStrikerKit.height, {
          kit: nonStrikerKit,
          pose: "stand",
          bat: true,
        }),
    });
  }
  const bowler = bowlerState(scene);
  const bowlerX = bowler.x * w;
  sprites.push({
    z: bowler.z,
    cast: { x: bowlerX, z: bowler.z, height: bowlerKit.height },
    draw: () =>
      bowler.rig
        ? drawBowler(scene, bowler, bowlerKit, w)
        : figure(bowlerX, bowler.z, bowlerKit.height, { kit: bowlerKit, pose: bowler.pose, phase: bowler.phase }),
  });
  sprites.push({ z: 1.25, cast: { striker: true }, draw: () => drawStriker(scene) });
  // The near stumps: the striker's, or the bowler's end when the camera is there.
  const nearEnd = fromBowler ? 1 : 0;
  const nearZ = fromBowler ? PITCH_LENGTH - 0.02 : 0.02;
  const stumpsArt = scene.game.images.stumps;
  sprites.push({
    z: nearZ,
    cast: {
      x: 0,
      z: nearZ,
      height: 0.71,
      screen: { x: 296 + stumpsArt.width / 2, y: 270 + CLOSE_Y_OFFSET + stumpsArt.height, heightPx: stumpsArt.height },
    },
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
        // True to scale (a 36 mm radius), never under 1.5 px so it can always be seen.
        const radius = Math.max(1.5, BALL_RADIUS * 880 * p.s);
        if (p.y < HUD_Y + 6) {
          drawShadow(ground.x, ground.y, radius);
          const trail = ballTrail(scene);
          if (trail.length) drawBallTrail(trail, scene.spinner);
          drawBall(p.x, p.y, radius, inn.ball.shine, scene.ballKind);
          // The ring: length and movement, as read or as it is (scenes/ball-ring.js).
          const ring = cur?.ring;
          if (ring && cur.t >= ring.showAt && cur.t < ring.hideAt + 0.15) {
            drawBallRing(p.x, p.y, radius, ring, cur.t > ring.hideAt ? 1 - (cur.t - ring.hideAt) / 0.15 : 1);
          }
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

  // The length cue: the zone the ball's about to pitch in, flashing in its ring colour (scenes/match-ball.js).
  const cue = cur?.lengthCue;
  if (cue && scene.now < cue.until)
    drawLengthZone(projectClose, cue.colour, scene.spinner, Math.floor((scene.now - cue.from) * 8) % 2 ? 0.3 : 0.55);
  // The pitch map's landing marker, on the ground under everyone.
  const landing = landingMarker(scene);
  if (landing) drawPitchReticle(landing.p, landing.k, landing.flash, landing.scale);

  // Rain has stopped play: the covers are on and everyone is off.
  if (scene.phase === "rain") return drawCovers(projectClose);
  // Far to near.
  sprites.sort((a, b) => closeDepth(b.z) - closeDepth(a.z));
  // The aim: while setting up, and on into the run-up unless the assist is HARD; on EASY the landing spot too.
  const aim = scene.human === "bowl" ? assistOf(scene).aim : "none";
  if (scene.phase === "setup" || (scene.phase === "runup" && aim !== "none")) drawTarget(scene);
  if (scene.phase === "runup" && aim === "marker") {
    const p = projectClose(scene.target.line, 0, scene.target.length);
    drawPitchReticle(p, 1, 0.5 + 0.5 * Math.sin(scene.now * 8), p.s / projectClose(0, 0, PITCH_LENGTH / 2).s);
  }
  castShadows(scene, sprites);
  for (const s of sprites) s.draw();

  if (miniMapShown(scene)) {
    const fielders = live
      ? live.fielders.filter((f) => f.role === "field").map((f) => f.pos)
      : inn.placements.map((p) => walkInSpot(p.pos, walkInShare(scene)));
    const keeper = live ? live.fielders[0].pos : keeperSpot(scene.spinner);
    const runners = live
      ? live.runners.map((r) => runnerSpot(scene, live, r, nonStrikerX))
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
}

/** The bowler from his rig (render/bowler/): projected at his pelvis, held to the striker's size near the camera. */
function drawBowler(scene, bowler, kit, w) {
  const z = bowler.z;
  if (closeDepth(z) < -1) return;
  const root = projectClose(bowler.x * w, 0, z);
  const ppm = Math.min(closePixelsPerMetre(z), NEAR_PIXELS_PER_METRE);
  const sx = projectClose((bowler.x + 0.1) * w, 0, z).x > root.x ? 1 : -1;
  const skeleton = bowlerSkeleton(bowler.rig.action, kit.height);
  // The ball is in his hand until it's bowled.
  const ball = scene.cur?.delivery ? null : BALL_IN_HAND[scene.ballKind];
  const view = { root, ppm, line: bowler.rig.line, sx, away: closeFromBowlerEnd() ? -1 : 1, mirror: bowler.rig.arm };
  drawBowlerRig(skeleton, kit, view, { ball });
}

const BALL_IN_HAND = { red: "#b3262b", pink: "#e86aa0", white: "#f4f2ea" };

/** Footmarks: speckled, worn patches that grow as the pitch breaks up. */
function drawRough(pitch, w) {
  for (const r of pitch.roughPatches) {
    for (let z = r.z0; z < r.z1; z += 0.12) {
      for (let x = r.x0; x < r.x1; x += 0.04) {
        // Deterministic speckle, denser as the rough deepens.
        const h = Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
        if (h > r.strength * 0.55) continue;
        const p = projectClose(x * w, 0, z);
        fillRect(p.x, p.y, 1, 1, h < r.strength * 0.25 ? "#7d5f36" : "#a8865a");
      }
    }
  }
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
  // Batting, the mark is EASY's help: otherwise it only shows where the ball pitched, as it pitches.
  if (scene.human === "bat" && since < 0 && !assistOf(scene).landing) return null;
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
