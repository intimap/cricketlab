import { activeWicketSide } from "./bowling-side.js";
import { bowlingGeometry, armOf } from "../sim/bowling-side.js";
import { WIDTH, HEIGHT, COLORS, ctx, fillRect } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";
import { clamp } from "../math.js";
import { CREASE, PITCH_LENGTH, MID_PITCH } from "../sim/geometry.js";
import { keeperSpot } from "../sim/field.js";
import { walkInSpot } from "../sim/fielder-motion.js";
import { projectWide, projectWideThrow, viewFacing } from "../render/camera.js";
import { drawTinyFigure, fielderPose, drawBall, drawShadow } from "../render/sprites.js";
import { drawSpeechBubble } from "../render/hud.js";
import { nonStrikerDepth, bowlerState, walkInShare } from "./match-positions.js";
import { setShadowCast } from "../render/sprites.js";
import { shadowSlope } from "../render/lighting.js";

/** The wide view: the whole ground from the stands, with everyone on it as small figures. */

const WALK_OFF_TIME = 8;
const SLEDGE_TIME = 2.4;

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

export function drawWide(scene) {
  ctx.drawImage(scene.groundArt.wide, 0, 0, WIDTH, HEIGHT);
  // Under one sun the small figures' shadows lean its way (a streak each is cheap, so at any effects level);
  // under floodlights all round they stay round.
  const casts = scene.light.casts?.length ? scene.light.casts : (scene.baseLight?.hd?.casts ?? []);
  // The non-striker, umpire and bowler (and the sun) are where they are in the world, whoever is batting.
  const w = viewFacing();
  setShadowCast(casts.length === 1 ? shadowSlope(projectWide, 0, MID_PITCH, 1.8, 13, { ...casts[0], x: casts[0].x * w }) : null);
  const inn = scene.inn;
  if (scene.ground.wide.scoreboard) drawGroundScoreboard(scene.ground.wide.scoreboard, inn);
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
  add((activeWicketSide(scene) === "around" ? 1.2 : -1.2) * w, 0, PITCH_LENGTH + 2.4, (x, y, s) =>
    drawTinyFigure(x, y, s, "idle", "#f4f4f0"),
  );
  add(-26, 0, 1, (x, y, s) => drawTinyFigure(x, y, s, "idle", "#f4f4f0"));

  if (live && (scene.phase === "flight" || scene.phase === "after" || scene.phase === "return")) {
    for (const f of live.fielders) {
      const pose = fielderPose(f, live.t, scene.phase);
      add(f.pos.x, 0, f.pos.z, (x, y, s) => drawTinyFigure(x, y, s, pose, cap, scene.now * 3 + f.idx, field));
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
        drawTinyFigure(x, y, s, moving ? "run" : "batter", scene.kitBat.cap, phase + r.bat, batting),
      );
    }
    const ball = live.ball;
    if (ball.throwing) {
      const th = ball.throwing;
      const { ground, ball: p } = projectWideThrow(th.from, th.to, clamp((live.t - th.t0) / (th.t1 - th.t0)), ball.pos.y);
      sprites.push({ y: ground.y, draw: () => drawShadow(ground.x, ground.y, 1.2) });
      sprites.push({ y: ground.y + 0.5, draw: () => drawBall(p.x, p.y - 1, 1.5, 1, scene.ballKind) });
    } else if (!(ball.held >= 0)) {
      add(ball.pos.x, 0, ball.pos.z, (x, y) => drawShadow(x, y, 1.2));
      const p = projectWide(ball.pos.x, ball.pos.y, ball.pos.z);
      sprites.push({ y: p.y + ball.pos.y * 3 + 0.5, draw: () => drawBall(p.x, p.y - 1, 1.5, 1, scene.ballKind) });
    }
  } else {
    const keeper = keeperSpot(scene.spinner);
    add(keeper.x, 0, keeper.z, (x, y, s) => drawTinyFigure(x, y, s, "keeper", cap, 0, field));
    const bowler = bowlerState(scene);
    add(bowler.x * w, 0, bowler.z, (x, y, s) => drawTinyFigure(x, y, s, bowler.pose, cap, bowler.phase, field));
    const walk = walkInShare(scene);
    inn.placements.forEach((place, i) => {
      const at = walkInSpot(place.pos, walk);
      add(at.x, 0, at.z, (x, y, s) => {
        drawTinyFigure(x, y, s, walk <= 0 ? "idle" : walk < 1 ? "run" : "keeper", cap, scene.now * 1.5 + i, field);
        if (scene.phase === "fieldEdit") {
          drawText(place.name.toUpperCase(), x, y + 3, {
            align: "center",
            color: i === scene.dragIdx ? COLORS.gold : COLORS.cream,
            shadow: "rgba(0,0,0,0.8)",
          });
        }
      });
    });
    add(-0.6, 0, CREASE, (x, y, s) => drawTinyFigure(x, y, s, "batter", scene.kitBat.cap, 0, batting));
    add(nonStrikerX, 0, nonStrikerDepth(scene), (x, y, s) => drawTinyFigure(x, y, s, "batter", scene.kitBat.cap, 0, batting));
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
