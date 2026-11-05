import { clamp, toRad } from "../math.js";
import { BAT_BLADE } from "./bat-impact.js";

/**
 * The ball off the bat as a collision (TODO.md, Batting). The bat is a rigid body swung from the hands: the
 * ball meets its face somewhere along the blade, where only part of the bat's weight counts (most at the
 * sweet spot, less at the toe and splice, less still off an edge that twists it in the hands), moving at
 * the bat's speed there. The impulse along the face's normal sends the ball off; friction across the face
 * takes a little of its slide and turns it into spin. Everything is in the striker's frame: x his off side,
 * y up, z towards the bowler.
 *
 * The batter aims the face so a well-played shot goes where it naturally goes (sim/shot-direction.js);
 * timing turns the face finer or squarer and an early one lifts it. Where it goes in the air comes from the
 * face's tilt and the ball's own climb as it arrives: a short one rising into a drive comes off higher.
 */

export const BALL_MASS = 0.156;
/** The real ball's radius (m), for its spin (geometry.js BALL_RADIUS is padded for contact). */
const BALL_R = 0.036;
/** The bat until each batter has his own (stream 5): weight (kg), how much its weight sits in the blade. */
export const DEFAULT_BAT = Object.freeze({ mass: 1.25, inertia: 0.05, balance: 0.28 });
/** How much of the slide across the face friction takes (and turns into spin). */
const FRICTION = 0.25;
/** How much an upright bat's edge turns the ball up as well as aside (its curve and the ball's climb). */
const EDGE_LIFT = 0.22;
/** Face turn (degrees) per second of timing error: about 3 degrees per 10 ms. */
export const FACE_TURN = 300;
/** An early shot's face rising through the arc: degrees per timing window early, past the first 0.7 of one. */
const EARLY_LIFT = 12;
const EARLY_FROM = 0.7;

/** The ball's bounce off the middle of the bat: about 0.5 new and hard, 0.42 old and soft. */
export const restitution = (hardness) => 0.42 + 0.08 * hardness;

/**
 * The bat's weight felt at `along` (m from the toe): a rigid bat struck away from its centre of mass turns
 * as well as moving, so less of it counts (M / (1 + M r^2 / I)).
 */
export function effectiveMass(bat, along) {
  const r = along - bat.balance;
  return bat.mass / (1 + (bat.mass * r * r) / bat.inertia);
}

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const plus = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a) => scale(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));

/** The face's normal for a face pointing at `bearing` (degrees, 0 back down the pitch, + off side), tilted up `tilt`. */
export function faceNormal(bearing, tilt) {
  const b = toRad(bearing);
  const t = toRad(tilt);
  return { x: Math.sin(b) * Math.cos(t), y: Math.sin(t), z: Math.cos(b) * Math.cos(t) };
}

/**
 * Ball (velocity `ball`, m/s) meets a face with normal `n` moving at `bat` (m/s), `mass` kg of bat counting
 * there and a bounce of `e`. Returns the ball's velocity after, and its spin (rad/s, + topspin as it goes).
 */
export function collide(ball, bat, n, mass, e) {
  const rel = plus(ball, scale(bat, -1));
  const vn = dot(rel, n);
  // Already moving apart (a feather of a touch): it carries on.
  if (vn >= 0) return { vel: { ...ball }, spin: 0 };
  const impulse = (-(1 + e) * vn) / (1 / BALL_MASS + 1 / mass);
  let vel = plus(ball, scale(n, impulse / BALL_MASS));
  // Friction across the face: some of the slide goes, and turns the ball about n x slide (a face rolling up
  // over the ball, so the ball slides down it, is topspin; one going under it is backspin).
  const slide = plus(rel, scale(n, -vn));
  vel = plus(vel, scale(slide, -FRICTION));
  const turn = scale(cross(n, slide), (FRICTION * 2.5) / BALL_R);
  // Topspin about the axis across the ball's flight (up x its heading).
  const flat = Math.hypot(vel.x, vel.z);
  const spin = flat < 0.5 ? 0 : clamp((turn.x * vel.z - turn.z * vel.x) / flat, -120, 120);
  return { vel, spin };
}

/** The horizontal bearing (degrees) a velocity heads at. */
const bearingOf = (v) => (Math.atan2(v.x, v.z) * 180) / Math.PI;

/**
 * Strike the ball. in: { ball (velocity at the bat), bearing (where the shot should go, degrees), tilt
 * (the face's tilt for the shot, degrees), turn (the face turned by timing and error, degrees), speed (the
 * bat's speed at the sweet spot, m/s), bat, hardness (the ball's), soft (0..1: soft hands, for a block),
 * impact (bat-impact.js: where on the blade), offset ({ x, y }: the ball from the bat's centre, m), aimed
 * ("tilt" for a ramp: faced to the ball and laid back, rather than turned to where it should go) }.
 * Returns { vel, spin, face (the face's bearing) }.
 */
export function strike({
  ball,
  bearing,
  tilt,
  turn = 0,
  speed,
  bat = DEFAULT_BAT,
  hardness = 1,
  soft = 0,
  impact,
  offset,
  aimed = "face",
}) {
  const along = clamp(impact.along, 0, BAT_BLADE.handle);
  // An edge twists the bat in the hands: less of it counts, and it gives more.
  const edge = impact.edge ? 1 - impact.thickness : 0;
  const mass = effectiveMass(bat, along) * (1 - 0.6 * edge) * (1 - 0.7 * soft);
  // Soft hands give with it: less bounce off the bat.
  const e = restitution(hardness) * impact.energy * (1 - 0.15 * edge) * (1 - 0.5 * soft);
  const result = (faceBearing, edged) => {
    const face = faceNormal(faceBearing, tilt);
    let n = face;
    if (edged && edge > 0 && offset) {
      // Round the edge, the surface turns towards the ball's side, up to most of the way across, and (an
      // upright bat's outside edge) a little upward, so an edge off a rising ball carries to the slips.
      const o = { x: offset.x, y: offset.y, z: 0 };
      const across = unit(plus(o, scale(face, -dot(o, face))));
      const a = toRad(80 * Math.pow(edge, 0.7));
      n = unit(plus(scale(face, Math.cos(a)), scale(across, Math.sin(a))));
      if (!impact.horizontal && offset.x > 0) n = unit(plus(n, { x: 0, y: EDGE_LIFT * edge, z: 0 }));
    }
    // The bat moves the way its face points (a block barely moves at all).
    return collide(ball, scale(face, speed), n, mass, e);
  };
  // Aim the face so the ball goes where the shot sends it (the incoming ball pushes it round): a few
  // halvings between facing the ball and facing where it should go, always facing the ball. A ramp is
  // aimed by its tilt instead: the face to the bowler, laid back.
  const toBall = bearingOf(scale(ball, -1));
  const wrap = (a) => ((a + 540) % 360) - 180;
  const span = wrap(bearing - toBall);
  let lo = toBall + Math.min(0, span) - 10;
  let hi = toBall + Math.max(0, span) + 10;
  lo = Math.max(lo, toBall - 85);
  hi = Math.min(hi, toBall + 85);
  // Aimed as for the middle: an edge then goes where the edge sends it.
  const heading = (face) => {
    const v = result(face, false).vel;
    return Math.hypot(v.x, v.z) < 0.5 ? face : bearingOf(v);
  };
  const off = (face) => wrap(heading(face) - bearing);
  if (aimed === "tilt") lo = hi = toBall;
  else if (Math.sign(off(lo)) !== Math.sign(off(hi))) {
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (Math.sign(off(mid)) === Math.sign(off(lo))) lo = mid;
      else hi = mid;
    }
  } else {
    // Out of reach of the face (too far round): the nearer end of the range.
    const best = Math.abs(off(lo)) < Math.abs(off(hi)) ? lo : hi;
    lo = hi = best;
  }
  const face = (lo + hi) / 2 + turn;
  return { ...result(face, true), face };
}

/**
 * The face's tilt for a shot (degrees up), from how it's played: over the ball for drives and pulls (kept
 * down), under it for lofts and ramps, and a block angled down; a high ball meets a drive's rising arc.
 * `early` is how early the shot is (timing windows); `charge` its power; `variant` sim/strokes.js's.
 */
export function faceTilt(type, back, height, charge, early, variant = null) {
  let tilt;
  // A sweep or reverse sweep slogged, the face opens under it.
  if (variant === "slog" && (type === "sweep" || type === "reverseSweep"))
    return 14 + 8 * charge + EARLY_LIFT * Math.max(0, early - EARLY_FROM);
  if (type === "defend") tilt = height > 1.25 ? 10 : -5;
  else if (type === "loft") tilt = 14 + 14 * charge;
  else if (type === "ramp") tilt = 60 + 6 * charge;
  else if (type === "sweep" || type === "reverseSweep") tilt = -3 + (height > 0.7 ? 9 : 0);
  else if (type === "cutpull")
    tilt =
      back === "upperCut"
        ? 18 + 6 * charge
        : back === "cut"
          ? -2 + (height > 1 ? 6 : 0)
          : back === "punch" || back === "glance"
            ? -3 + (height > 0.8 ? 5 : 0)
            : -6 + Math.max(0, height - 1.2) * 22;
  else tilt = -1 + Math.max(0, height - 0.8) * 20;
  // Early, the face is coming up through its arc: it lifts (beyond the first 30 ms).
  if (type !== "defend") tilt += EARLY_LIFT * Math.max(0, early - EARLY_FROM);
  // A back-foot shot hit in the air: the face opened to it.
  if (variant === "aerial") tilt += 12;
  return tilt;
}
