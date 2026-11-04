import { mouse } from "../engine/input.js";
import { MID_PITCH } from "../sim/geometry.js";
import { setWideView, viewFacing } from "../render/camera.js";

/**
 * The wide view's TV camera, directing itself (TODO.md, Grounds): it turns and zooms from one spot, a
 * window on the whole-ground picture (render/camera.js setWideView).
 *   - Cutting to it after a shot, it opens on the ball and the batters, then follows the ball, easing out
 *     as it goes so the ball, the fielder going for it and the batters stay in shot.
 *   - Once the ball's dead it holds a moment, then pulls back to the whole ground (as it is between overs).
 *   - Placing the field, it eases in on the square while you move a fielder inside the circle, keeping the
 *     spot under the pointer still, and back out when you put him down.
 *   - With the camera locked to WIDE, the delivery is watched close in on the square.
 * Only grounds whose wide camera is the TV camera (render/venue/venue-cameras.js) have one to direct.
 */

/** The closest it zooms (the square at 3x, the ground's 3x picture: render/venue/venue-build.js). */
export const MAX_ZOOM = 3;
const WHOLE = { zoom: 1, cx: 320, cy: 180 };
/** How quickly it eases to where it's going (s), and how long it holds once the ball's dead. */
const EASE = 0.38;
const HOLD = 1.4;
/** Room round what's framed (px of the whole-ground frame), and the circle where a fielder is close in (m). */
const PAD = { x: 46, y: 30 };
const CLOSE_IN = 30;

const DELIVERY = new Set(["ready", "setup", "runup", "flight"]);

/** The window framing these whole-frame points with room round them, the square's middle if none. */
function frameAround(points, most = MAX_ZOOM) {
  const x0 = Math.min(...points.map((p) => p.x)) - PAD.x;
  const x1 = Math.max(...points.map((p) => p.x)) + PAD.x;
  const y0 = Math.min(...points.map((p) => p.y)) - PAD.y * 1.6;
  const y1 = Math.max(...points.map((p) => p.y)) + PAD.y;
  const zoom = Math.max(1, Math.min(most, 640 / (x1 - x0), 360 / (y1 - y0)));
  return { zoom, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Keep the window inside the whole-ground frame. */
function inside(v) {
  const hw = 320 / v.zoom;
  const hh = 180 / v.zoom;
  return { zoom: v.zoom, cx: Math.min(640 - hw, Math.max(hw, v.cx)), cy: Math.min(360 - hh, Math.max(hh, v.cy)) };
}

/** Where the camera wants to be this frame (before easing). */
function target(scene, cam, state) {
  // The sim's positions are in the striker's frame; the camera's are the world's.
  const at = (p, y = 0) => cam.project(p.x * viewFacing(), y, p.z);
  const square = (zoom) => {
    const middle = at({ x: 0, z: MID_PITCH });
    return { zoom, cx: middle.x, cy: middle.y };
  };
  if (scene.phase === "fieldEdit") {
    const drag = scene.dragIdx >= 0 ? scene.inn.placements[scene.dragIdx] : null;
    return drag && Math.hypot(drag.pos.x, drag.pos.z - MID_PITCH) < CLOSE_IN ? square(2.3) : WHOLE;
  }
  const cur = scene.cur;
  const live = cur?.play?.live;
  if (live && cur.contactDone) {
    if (live.dead) state.deadAt ??= scene.now;
    if (state.deadAt !== undefined && scene.now - state.deadAt > HOLD) return WHOLE;
    if (state.deadAt !== undefined && state.held) return state.held;
    const points = [at(live.ball.pos, live.ball.pos.y), ...live.runners.map((r) => at(live.runnerPos(r)))];
    const chasing = live.plan?.fielder;
    if (chasing !== undefined && live.fielders[chasing]) points.push(at(live.fielders[chasing].pos));
    state.held = frameAround(points);
    return state.held;
  }
  state.deadAt = undefined;
  state.held = null;
  if (scene.cam === "wide" && DELIVERY.has(scene.phase)) return square(MAX_ZOOM);
  return WHOLE;
}

/** Move the wide camera for this frame (`dt` s): call before anything reads the wide view's projection. */
export function directWide(scene, dt) {
  const cam = scene.ground.wide?.camera;
  if (!cam?.tv) return;
  const state = (scene.wideCam ??= { ...WHOLE, shown: false });
  // Showing when the wide view is up (or the field's being placed), but not for the ball-tracking replays.
  const tracking = scene.phase === "review" || scene.phase === "appeal" || scene.phase === "decision";
  if ((scene.view !== "wide" && scene.phase !== "fieldEdit") || tracking) {
    state.shown = false;
    return;
  }
  const want = inside(target(scene, cam, state));
  // Holding a fielder: zoom about the pointer, so the spot under it stays put.
  const anchor = scene.phase === "fieldEdit" && scene.dragIdx >= 0 ? { x: mouse.x, y: mouse.y } : null;
  const under = anchor && { x: (anchor.x - 320) / state.zoom + state.cx, y: (anchor.y - 180) / state.zoom + state.cy };
  if (!state.shown) {
    // A cut: straight to the framing.
    Object.assign(state, want, { shown: true });
  } else {
    const k = 1 - Math.exp(-dt / EASE);
    state.zoom = Math.exp(Math.log(state.zoom) + (Math.log(want.zoom) - Math.log(state.zoom)) * k);
    state.cx += (want.cx - state.cx) * k;
    state.cy += (want.cy - state.cy) * k;
    if (under) {
      state.cx = under.x - (anchor.x - 320) / state.zoom;
      state.cy = under.y - (anchor.y - 180) / state.zoom;
    }
  }
  Object.assign(state, inside(state));
  setWideView({ zoom: state.zoom, cx: state.cx, cy: state.cy });
}
