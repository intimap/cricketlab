import { activeWicketSide } from "./bowling-side.js";
import { bowlingGeometry, armOf } from "../sim/bowling-side.js";
import { COLORS, fillRect } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { clamp } from "../math.js";
import { CREASE, PITCH_LENGTH, MID_PITCH } from "../sim/geometry.js";
import { keeperSpot } from "../sim/field.js";
import { walkInSpot } from "../sim/fielder-motion.js";
import { projectWide, projectWideThrow, viewFacing } from "../render/camera.js";
import { drawTinyFigure, fielderPose, drawBall, drawShadow, drawFigure, playerKit } from "../render/sprites.js";
import { wideViewNow } from "../render/camera.js";
import { drawSpeechBubble } from "../render/hud.js";
import { nonStrikerDepth, bowlerState, walkInShare } from "./match-positions.js";
import { setShadowCast } from "../render/sprites.js";
import { shadowSlope } from "../render/lighting.js";
import { drawWideArt, drawWideBoard, drawGroundScoreboard } from "./venue-view.js";

/** The wide view: the whole ground from the stands, with everyone on it as small figures. */

const WALK_OFF_TIME = 8;

/** The close view's poses for the small figures' (dives and falls stay small figures). */
const CLOSE_POSE = { idle: "stand", run: "run", keeper: "stand", batter: "stand", celebrate: "celebrate", throw: "release" };
/** How tall (px) a player has to be on screen, zoomed in, to be drawn as the close view's jointed figure. */
const JOINTED_FROM = 14;

/**
 * A player in the wide view: the small block figure, or once the camera's in close enough to see him
 * properly (render/camera.js, scenes/wide-director.js), the jointed one in his own kit.
 */
function wideFigure(x, y, s, pose, cap, phase, opts = {}, kit = null) {
  const height = s * 11.6;
  if (!kit || height < JOINTED_FROM || !CLOSE_POSE[pose]) return drawTinyFigure(x, y, s, pose, cap, phase, opts);
  drawFigure(x, y, height, { kit, pose: CLOSE_POSE[pose], phase, bat: opts.bat, umpire: opts.umpire });
}
const SLEDGE_TIME = 2.4;

export function drawWide(scene) {
  drawWideArt(scene);
  // Under one sun the small figures' shadows lean its way (a streak each is cheap, so at any effects level);
  // under floodlights all round they stay round.
  const casts = scene.light.casts?.length ? scene.light.casts : (scene.baseLight?.hd?.casts ?? []);
  // The non-striker, umpire and bowler (and the sun) are where they are in the world, whoever is batting.
  const w = viewFacing();
  setShadowCast(casts.length === 1 ? shadowSlope(projectWide, 0, MID_PITCH, 1.8, 13, { ...casts[0], x: casts[0].x * w }) : null);
  const inn = scene.inn;
  if (scene.ground.wide.scoreboard) drawGroundScoreboard(scene.ground.wide.scoreboard, inn);
  drawWideBoard(scene);
  const cur = scene.cur;
  const live = cur?.play?.live;
  const cap = scene.kitBowl.cap;
  // Each side in its own kit (whites, or coloured for limited overs: render/skins.js).
  const field = { shirt: scene.kitBowl.shirt, pants: scene.kitBowl.pants };
  const batting = { bat: true, shirt: scene.kitBat.shirt, pants: scene.kitBat.pants };
  const nonStrikerX = bowlingGeometry(scene.spinner, activeWicketSide(scene), armOf(scene.inn.bowler?.p.bowl)).nonStrikerX * w;
  const sprites = [];
  const add = (x, y, z, draw) => {
    const p = projectWide(x, y, z);
    sprites.push({ y: p.y, draw: () => draw(p.x, p.y, p.s) });
  };

  // Umpires.
  const umpire = { ...scene.kitBowl, cap: "#f4f4f0" };
  add((activeWicketSide(scene) === "around" ? 1.2 : -1.2) * w, 0, PITCH_LENGTH + 2.4, (x, y, s) =>
    wideFigure(x, y, s, "idle", "#f4f4f0", 0, { umpire: true }, umpire),
  );
  add(-26, 0, 1, (x, y, s) => wideFigure(x, y, s, "idle", "#f4f4f0", 0, { umpire: true }, umpire));

  if (live && (scene.phase === "flight" || scene.phase === "after" || scene.phase === "return")) {
    for (const f of live.fielders) {
      const pose = fielderPose(f, live.t, scene.phase);
      const kit = playerKit(scene.kitBowl, f.player);
      add(f.pos.x, 0, f.pos.z, (x, y, s) => wideFigure(x, y, s, pose, cap, scene.now * 3 + f.idx, field, kit));
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
      const kit = playerKit(scene.kitBat, inn.bat[r.bat]?.p);
      add(pos.x, 0, pos.z, (x, y, s) =>
        wideFigure(x, y, s, moving ? "run" : "batter", scene.kitBat.cap, phase + r.bat, batting, kit),
      );
    }
    const ball = live.ball;
    // Zoomed in, the ball and its shadow grow a little (so it can still be followed).
    const ballR = 1.5 * Math.max(1, wideViewNow().zoom * 0.6);
    if (ball.throwing) {
      const th = ball.throwing;
      const { ground, ball: p } = projectWideThrow(th.from, th.to, clamp((live.t - th.t0) / (th.t1 - th.t0)), ball.pos.y);
      sprites.push({ y: ground.y, draw: () => drawShadow(ground.x, ground.y, ballR * 0.8) });
      sprites.push({ y: ground.y + 0.5, draw: () => drawBall(p.x, p.y - 1, ballR, 1, scene.ballKind) });
    } else if (!(ball.held >= 0)) {
      add(ball.pos.x, 0, ball.pos.z, (x, y) => drawShadow(x, y, ballR * 0.8));
      const p = projectWide(ball.pos.x, ball.pos.y, ball.pos.z);
      sprites.push({ y: p.y + ball.pos.y * 3 + 0.5, draw: () => drawBall(p.x, p.y - 1, ballR, 1, scene.ballKind) });
    }
  } else {
    const keeper = keeperSpot(scene.spinner);
    add(keeper.x, 0, keeper.z, (x, y, s) => wideFigure(x, y, s, "keeper", cap, 0, field, scene.kitBowl));
    const bowler = bowlerState(scene);
    const bowlerKit = playerKit(scene.kitBowl, inn.bowler?.p);
    add(bowler.x * w, 0, bowler.z, (x, y, s) => wideFigure(x, y, s, bowler.pose, cap, bowler.phase, field, bowlerKit));
    const walk = walkInShare(scene);
    inn.placements.forEach((place, i) => {
      const at = walkInSpot(place.pos, walk);
      add(at.x, 0, at.z, (x, y, s) => {
        wideFigure(x, y, s, walk <= 0 ? "idle" : walk < 1 ? "run" : "keeper", cap, scene.now * 1.5 + i, field, scene.kitBowl);
        if (scene.phase === "fieldEdit") {
          drawText(place.name.toUpperCase(), x, y + 3, {
            align: "center",
            color: i === scene.dragIdx ? COLORS.gold : COLORS.cream,
            shadow: "rgba(0,0,0,0.8)",
          });
        }
      });
    });
    const striker = playerKit(scene.kitBat, inn.bat[inn.striker]?.p);
    const nonStriker = playerKit(scene.kitBat, inn.bat[inn.nonStriker]?.p);
    add(-0.6, 0, CREASE, (x, y, s) => wideFigure(x, y, s, "batter", scene.kitBat.cap, 0, batting, striker));
    add(nonStrikerX, 0, nonStrikerDepth(scene), (x, y, s) =>
      wideFigure(x, y, s, "batter", scene.kitBat.cap, 0, batting, nonStriker),
    );
  }

  for (const bit of scene.particles) {
    if (bit.wide) add(bit.x, bit.y, bit.z, (x, y) => fillRect(x, y - bit.y * 3, 2, 1, "#f4e1b0"));
  }
  // Back to front.
  sprites.sort((a, b) => a.y - b.y);
  for (const s of sprites) s.draw();
  if (live) drawSledges(scene, live);
  if (live) drawInvolved(live);
  setShadowCast(null);
}

/** The fielder in the thick of it (going for it, holding it, throwing it) gets his name over his head. */
function drawInvolved(live) {
  const ball = live.ball;
  const idx = ball.throwing ? ball.throwing.fielder : ball.held >= 0 ? ball.held : live.plan?.fielder;
  const f = idx === undefined ? null : live.fielders[idx];
  if (!f || f.role === "bowler" || f.role === "keeper") return;
  const p = projectWide(f.pos.x, 0, f.pos.z);
  const name = f.player.name.split(" ").at(-1).toUpperCase();
  drawText(name, p.x, p.y - 16 * p.s - 10, { align: "center", color: COLORS.cream, shadow: "rgba(0,0,0,0.85)" });
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
