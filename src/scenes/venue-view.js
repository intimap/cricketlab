import { WIDTH, HEIGHT, ctx, fillRect } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";
import { wideViewNow } from "../render/camera.js";
import { bowlingEndOf } from "../render/venue/venue-map.js";
import { HI_REGION, venueGround } from "../render/venue/venue-build.js";
import { directWide } from "./wide-director.js";

/**
 * The match scene's side of a ground built from a map (render/venue/): which end the bowling is from (the
 * views turn with it each over), the close and wide backgrounds for the moment, and the live score on the
 * ground's scoreboard. Grounds made from paintings fall straight through to their single pictures.
 */

/** Milliseconds a frame spent drawing a venue's views ahead of need (render/venue/venue-build.js). */
const WORK_MS = 6;

/** A ground built from a map's art for the scene, relit from its own light (the same at every effects level). */
export function venueArt(scene, pitch) {
  const ground = scene.ground;
  return ground.venue ? venueGround(ground, scene.game.images, pitch, scene.lightBase, { ballKind: scene.ballKind }) : null;
}

/**
 * Each frame, before the match moves on: draw a slice of the views it'll need next, and move the TV
 * camera before anything reads the wide view's projection (field placing, the drawing).
 */
export function updateVenue(scene, dt) {
  scene.groundArt?.work?.(WORK_MS, venueWants(scene));
  directWide(scene, dt);
}

/** The end the bowler bowls from: 0 or 1, changing each over (end 0 all through the nets). */
export function bowlingEnd(scene) {
  return scene.nets || !scene.inn ? 0 : bowlingEndOf(scene.inn.overNo);
}

/** The end of the ground the close camera looks at: the bowler's, or the striker's from behind the bowler. */
export function closeFar(scene) {
  return bowlingEnd(scene) ^ (scene.closeEnd === "bowl" ? 1 : 0);
}

/** The views to draw ahead, most wanted first: what's on screen, then the other end's, then the 3x middle. */
export function venueWants(scene) {
  const end = bowlingEnd(scene);
  const far = closeFar(scene);
  const close = [
    ["close", far],
    ["wide", end],
  ];
  if (scene.view === "wide") close.reverse();
  return [...close, ["close", far ^ 1], ["wide", end ^ 1], ["near", end], ["near", end ^ 1]];
}

/** The close view's background canvas (drawn 24 px up). */
export function closeArt(scene) {
  const art = scene.groundArt;
  return art.closeFor ? art.closeFor(closeFar(scene)) : art.close;
}

/** The wide view's background: a painting, or the venue's picture through the camera's window. */
export function drawWideArt(scene) {
  const art = scene.groundArt;
  if (!art.wideFor) {
    ctx.drawImage(art.wide, 0, 0, WIDTH, HEIGHT);
    return;
  }
  const end = bowlingEnd(scene);
  const v = wideViewNow();
  const w = WIDTH / v.zoom;
  const h = HEIGHT / v.zoom;
  const x0 = v.cx - w / 2;
  const y0 = v.cy - h / 2;
  const R = HI_REGION;
  const near = v.zoom > 2.05 && x0 >= R.x && y0 >= R.y && x0 + w <= R.x + R.w && y0 + h <= R.y + R.h;
  ctx.save();
  if (near) {
    ctx.imageSmoothingEnabled = Math.abs(v.zoom - 3) > 0.01;
    ctx.drawImage(art.nearFor(end), (x0 - R.x) * 3, (y0 - R.y) * 3, w * 3, h * 3, 0, 0, WIDTH, HEIGHT);
  } else {
    // 1:1 at 2x zoom; any other zoom is smoothed rather than left to shimmer.
    ctx.imageSmoothingEnabled = Math.abs(v.zoom - 2) > 0.01;
    ctx.drawImage(art.wideFor(end), x0 * 2, y0 * 2, w * 2, h * 2, 0, 0, WIDTH, HEIGHT);
  }
  ctx.restore();
}

const BOARD = { colour: "#1d3a2c", top: "#ffd23a", bottom: "#f4f4ee" };

/**
 * A ground's scoreboard showing the real score: the batting side, then the side they're chasing (or the
 * overs, in the first innings); just the score on a small face.
 */
export function drawGroundScoreboard(board, inn) {
  fillRect(board.x, board.y, board.w, board.h, board.colour);
  const mid = board.x + board.w / 2;
  // A narrow gap after the team, so even "AUS 487/10" fits the face.
  const line = (name, figures, y, color) => {
    const left = Math.round(mid - (textWidth(name) + 3 + textWidth(figures)) / 2);
    drawText(name, left, y, { color, shadow: null });
    drawText(figures, left + textWidth(name) + 3, y, { color, shadow: null });
  };
  if (board.h < 18) {
    line(inn.batTeam.abbr, `${inn.runs}/${inn.wkts}`, Math.round(board.y + board.h / 2 - 4), board.top);
    return;
  }
  // A bigger face (a venue's, close up) spaces its two lines out; the painted ones keep theirs.
  const gap = board.h > 22 ? Math.round((board.h - 18) / 3) : 0;
  line(inn.batTeam.abbr, `${inn.runs}/${inn.wkts}`, board.y + 1 + gap, board.top);
  if (inn.target !== null) line(inn.bowlTeam.abbr, String(inn.target - 1), board.y + 11 + gap * 2, board.bottom);
  else line("OV", inn.oversText, board.y + 11 + gap * 2, board.bottom);
}

/** The venue's scoreboard in the close view (screen px), when the camera is looking at it. */
export function drawCloseBoard(scene) {
  const rect = scene.groundArt.board?.("close", closeFar(scene));
  if (rect && rect.w > 24) drawGroundScoreboard({ ...rect, ...BOARD }, scene.inn);
}

/** The venue's scoreboard in the wide view, through the camera's window. */
export function drawWideBoard(scene) {
  const rect = scene.groundArt.board?.("wide", bowlingEnd(scene));
  if (!rect) return;
  const v = wideViewNow();
  const x = (rect.x - v.cx) * v.zoom + 320;
  const y = (rect.y - v.cy) * v.zoom + 180;
  if (rect.w * v.zoom > 24)
    drawGroundScoreboard(
      { x: Math.round(x), y: Math.round(y), w: Math.round(rect.w * v.zoom), h: Math.round(rect.h * v.zoom), ...BOARD },
      scene.inn,
    );
}
