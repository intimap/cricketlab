import { clamp, easeOut } from "../math.js";
import { CREASE } from "../sim/geometry.js";
import { closeGroundY, projectClose, closePixelsPerMetre, closeFromBowlerEnd } from "../render/camera.js";
import { BATTER_POSES, solveBatterRig, lerpPose, drawBatter, playerKit } from "../render/sprites.js";
import { STRIKER_X, STRIKER_SCREEN_X, readyPose, strikerStroke, footworkOf, footworkPixels } from "./batter-pose.js";

/**
 * The striker in the close view: where and how big he's drawn (from either end), and bringing the
 * blade onto the ball at a real contact (a miss stays a miss), then drawing him in his stroke.
 */

/** The striker's height in pixels when drawn at scale 1, for a player of STANDARD_HEIGHT metres. */
const BATTER_HEIGHT_PX = 92;
const STANDARD_HEIGHT = 1.82;
/** Run progress (0..1) at which the striker has left his crease and is drawn as a runner. */
export const LEFT_CREASE = 0.02;
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
export function strikerPlace(scene, kit, fromBowler, moved = 0) {
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

/** The striker's feet on screen, and his height there and in life, for his shadow (scenes/match-shadows.js). */
export function strikerFeet(scene) {
  const cur = scene.cur;
  const kit = playerKit(scene.kitBat, scene.inn.bat[scene.inn.striker].p);
  const moved = footworkOf(scene, cur, cur ? scene.clock() : 0);
  const place = strikerPlace(scene, kit, closeFromBowlerEnd(), moved);
  return { x: place.x, y: place.y, heightPx: BATTER_HEIGHT_PX * place.scale, heightM: kit.height, worldX: STRIKER_X + moved };
}

export function drawStriker(scene) {
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
