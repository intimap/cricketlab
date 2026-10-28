// The striker in 3D: hips and shoulders that turn separately, arms and legs joined to points each
// frame, and the bat in the hands. Shots are paths of key poses timed to the moment the bat
// arrives (from the sim), and the body reaches across so the bat goes where the batter aimed.
// three.js coordinates (see world.js): the bowler is down -z, the off side is +x.

import { mats, colour, cyl, sph, box } from "./world.js";

const THREE = globalThis.THREE;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (t) => t * t * (3 - 2 * t);

/** Where he takes guard: just to the leg side of his stumps, back foot inside the popping crease. */
export const STAND = { x: -0.15, z: -1.35 };
/** How far the body can shift to get the bat to the ball (m): across, up/down, forward/back. */
const REACH = { x: 0.6, y: 0.35, z: 0.35 };
/** Back-foot poses step back towards the stumps this far per unit of `back`. */
const BACK_STEP = 1.6;

/**
 * Poses. hip and chest turn (radians, 0 = side-on, + opening up towards the bowler), lean
 * forward at the waist, hands [in front, up, towards the bowler] in the chest's frame, front
 * foot forward (step), weight back (back). bat [cross, sweep, swing] radians, applied as Euler
 * "YXZ": swing turns a straight bat in line with the pitch (- lifts the toe towards the keeper,
 * + carries it through towards the bowler), cross lays it flat, sweep turns it round.
 */
export const POSES = {
  stance: { hip: 0, chest: 0, lean: 0.12, hands: [0.26, 0.12, 0.02], bat: [0, 0, -0.25], step: 0, back: 0 },
  lift: { hip: -0.05, chest: -0.3, lean: 0.1, hands: [0.18, 0.38, -0.12], bat: [0, 0, -2.4], step: 0.12, back: 0.05 },
  liftBack: { hip: -0.05, chest: -0.3, lean: 0.08, hands: [0.18, 0.4, -0.12], bat: [0, 0, -2.4], step: 0, back: 0.25 },
  driveHit: { hip: 0.25, chest: 0.05, lean: 0.38, hands: [0.39, 0.13, 0.3], bat: [0, 0, 0.12], step: 0.75, back: 0 },
  driveEnd: { hip: 0.6, chest: 0.45, lean: 0.28, hands: [0.18, 0.62, 0.15], bat: [0, 0, 2.6], step: 0.75, back: 0 },
  loftHit: { hip: 0.3, chest: 0.1, lean: 0.3, hands: [0.45, 0.13, 0.22], bat: [0, 0, 0.3], step: 0.7, back: 0 },
  loftEnd: { hip: 0.75, chest: 0.7, lean: 0.12, hands: [0.1, 0.8, 0.1], bat: [0, 0, 3.0], step: 0.7, back: 0 },
  punchHit: { hip: 0.2, chest: 0.05, lean: 0.2, hands: [0.29, 0.13, -0.04], bat: [0, 0, 0.1], step: 0, back: 0.3 },
  punchEnd: { hip: 0.4, chest: 0.3, lean: 0.18, hands: [0.26, 0.42, 0.14], bat: [0, 0, 1.6], step: 0, back: 0.3 },
  glanceHit: { hip: 0.35, chest: 0.2, lean: 0.15, hands: [0.03, 0.08, 0], bat: [0, 0.6, 0.05], step: 0, back: 0.3 },
  glanceEnd: { hip: 0.45, chest: 0.3, lean: 0.12, hands: [0.28, 0.2, -0.04], bat: [0, 1.2, 0.3], step: 0, back: 0.3 },
  pullHit: { hip: 1.0, chest: 0.6, lean: 0.05, hands: [0.1, 0.15, 0.24], bat: [-1.57, -1.74, 0], step: 0, back: 0.25 },
  pullMid: { hip: 1.3, chest: 1.05, lean: 0.0, hands: [0.32, 0.36, 0.15], bat: [-1.57, 1.2, 0], step: 0, back: 0.25 },
  pullEnd: { hip: 1.4, chest: 1.3, lean: -0.05, hands: [0.12, 0.6, 0.12], bat: [-2.3, 2.6, 0], step: 0, back: 0.25 },
  cutHit: { hip: 0.35, chest: 0.1, lean: 0.2, hands: [0.18, -0.07, 0.16], bat: [-1.5, -0.42, 0], step: 0, back: 0.3 },
  cutEnd: { hip: 0.4, chest: 0.2, lean: 0.25, hands: [0.4, 0.3, -0.3], bat: [-1.7, -1.8, 0], step: 0, back: 0.3 },
  block: { hip: 0.1, chest: 0.0, lean: 0.35, hands: [0.4, 0.12, 0.28], bat: [0, 0, 0.05], step: 0.55, back: 0 },
  blockBack: { hip: 0.15, chest: 0.05, lean: 0.15, hands: [0.26, 0.17, -0.01], bat: [0, 0, 0.03], step: 0, back: 0.3 },
  leave: { hip: 0.05, chest: -0.1, lean: 0.05, hands: [0.08, 0.62, -0.05], bat: [0, 0, -3.0], step: 0.1, back: 0.05 },
};
const P = POSES;
for (const p of Object.values(P)) p.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.bat, "YXZ"));

const mix = (a, b, t) => ({
  hip: lerp(a.hip, b.hip, t),
  chest: lerp(a.chest, b.chest, t),
  lean: lerp(a.lean, b.lean, t),
  hands: a.hands.map((v, i) => lerp(v, b.hands[i], t)),
  q: a.q.clone().slerp(b.q, t),
  step: lerp(a.step, b.step, t),
  back: lerp(a.back, b.back, t),
});

/** The pose at time t along a path of [time, pose] keys. */
function along(path, t) {
  if (t <= path[0][0]) return path[0][1];
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i][0]) {
      const [t0, a] = path[i - 1];
      const [t1, b] = path[i];
      return mix(a, b, ease((t - t0) / (t1 - t0)));
    }
  }
  return path[path.length - 1][1];
}

/**
 * The key poses for a shot, with times relative to the bat arriving (0). `from` is when he
 * starts moving (backlift, or the defensive press), `swing` when the downswing starts.
 * kind: drive, loft, cut, pull, punch, glance, defend, defendBack, leave.
 */
function shotPath(kind, from, swing) {
  const lift = kind === "drive" || kind === "loft" ? P.lift : P.liftBack;
  const swingAt = Math.max(from + 0.02, swing);
  switch (kind) {
    case "drive":
      return [[from, P.stance], [swingAt, lift], [0, P.driveHit], [0.42, P.driveEnd]];
    case "loft":
      return [[from, P.stance], [swingAt, lift], [0, P.loftHit], [0.45, P.loftEnd]];
    case "cut":
      return [[from, P.stance], [swingAt, lift], [0, P.cutHit], [0.4, P.cutEnd]];
    case "pull":
      return [[from, P.stance], [swingAt, lift], [0, P.pullHit], [0.18, P.pullMid], [0.42, P.pullEnd]];
    case "punch":
      return [[from, P.stance], [swingAt, lift], [0, P.punchHit], [0.38, P.punchEnd]];
    case "glance":
      return [[from, P.stance], [swingAt, P.blockBack], [0, P.glanceHit], [0.35, P.glanceEnd]];
    case "defend":
      return [[from, P.stance], [0, P.block], [0.6, P.block]];
    case "defendBack":
      return [[from, P.stance], [0, P.blockBack], [0.6, P.blockBack]];
    default:
      return [[from, P.stance], [from + 0.2, P.leave], [1, P.leave]];
  }
}

/** The pose a shot meets the ball in. */
const HIT = {
  drive: "driveHit",
  loft: "loftHit",
  cut: "cutHit",
  pull: "pullHit",
  punch: "punchHit",
  glance: "glanceHit",
  defend: "block",
  defendBack: "blockBack",
};

export function makeBatter(scene, look, helmetColour) {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  const chest = new THREE.Group();
  const hands = new THREE.Group();
  const batPivot = new THREE.Group();
  // Everything he's made of, so he can be taken off when another batter comes in.
  const all = new THREE.Group();
  scene.add(all);
  all.add(root);
  root.add(hips);
  hips.add(chest);
  chest.position.y = 0.12;
  // Taller batters are drawn bigger (the poses are for a 1.82 m man).
  root.scale.setScalar((look?.height ?? 1.82) / 1.82);
  const skin = colour(look?.skin ?? "#c98f68");
  const helmetMat = colour(helmetColour);

  hips.add(box(0.34, 0.2, 0.24, mats.whitesShade));
  const torso = box(0.38, 0.52, 0.24, mats.whites);
  torso.position.y = 0.32;
  chest.add(torso);
  // The chest's own axes: x towards the bowler, z the way his chest faces, y up.
  const neck = cyl(0.05, 0.05, 0.1, skin);
  neck.position.y = 0.62;
  chest.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.76;
  chest.add(head);
  head.add(sph(0.115, skin));
  const helmet = sph(0.13, helmetMat);
  helmet.scale.set(1, 0.85, 1.05);
  helmet.position.set(0, 0.04, -0.01);
  const peak = box(0.17, 0.02, 0.1, helmetMat);
  peak.position.set(0, 0.02, 0.12);
  const grille = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 16, Math.PI), mats.grille);
  grille.rotation.set(Math.PI / 2, 0, 0);
  grille.position.set(0, -0.04, 0.04);
  head.add(helmet, peak, grille);
  // Shoulders: the front (left) one towards the bowler, the back (right) one towards the keeper.
  const shoulderL = new THREE.Object3D();
  shoulderL.position.set(0.19, 0.5, 0);
  const shoulderR = new THREE.Object3D();
  shoulderR.position.set(-0.19, 0.5, 0);
  chest.add(shoulderL, shoulderR, hands);
  hands.add(batPivot);
  // The bat: handle up from the hands, blade below; the middle is about 0.5 m down from the grip.
  const handle = cyl(0.017, 0.017, 0.3, mats.grip);
  handle.position.y = 0.02;
  const blade = box(0.108, 0.56, 0.045, mats.bat);
  blade.position.y = -0.4;
  const spine = box(0.04, 0.5, 0.03, mats.batSpine);
  spine.position.set(0, -0.4, 0.03);
  const gloveTop = sph(0.05, mats.glove);
  gloveTop.position.y = 0.06;
  const gloveBot = sph(0.05, mats.glove);
  gloveBot.position.y = -0.06;
  const middle = new THREE.Object3D();
  middle.position.y = -0.5;
  batPivot.add(handle, blade, spine, gloveTop, gloveBot, middle);
  const batParts = new Set([handle, blade, spine, gloveTop, gloveBot]);

  // Arms and legs: limbs joined between points each frame.
  const UP = new THREE.Vector3(0, 1, 0);
  const limb = (r0, r1, mat) => {
    const m = cyl(r1, r0, 1, mat);
    all.add(m);
    return (a, b) => {
      const d = new THREE.Vector3().subVectors(b, a);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.scale.set(1, d.length(), 1);
      m.quaternion.setFromUnitVectors(UP, d.normalize());
    };
  };
  const armL = limb(0.045, 0.04, mats.whites);
  const foreL = limb(0.04, 0.035, skin);
  const armR = limb(0.045, 0.04, mats.whites);
  const foreR = limb(0.04, 0.035, skin);
  const thighL = limb(0.085, 0.07, mats.whites);
  const shinL = limb(0.075, 0.065, mats.pad);
  const thighR = limb(0.085, 0.07, mats.whites);
  const shinR = limb(0.075, 0.065, mats.pad);
  const footL = box(0.12, 0.08, 0.28, mats.pad);
  const footR = box(0.12, 0.08, 0.28, mats.pad);
  all.add(footL, footR);
  const scale = root.scale.x;
  // A joint between two ends, bent out by `out` to keep the bone lengths.
  const joint = (a, b, bone, out) => {
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const bend = Math.sqrt(Math.max(0, bone * bone - (a.distanceTo(b) / 2) ** 2));
    return mid.addScaledVector(out, bend);
  };
  const ELBOW_L = new THREE.Vector3(0.6, -0.6, -0.4).normalize();
  const ELBOW_R = new THREE.Vector3(0.1, -0.9, 0.4).normalize();
  const KNEE_L = new THREE.Vector3(0.3, 0, -1).normalize();
  const KNEE_R = new THREE.Vector3(0.6, 0, -0.6).normalize();

  /** Draw pose p, with the body shifted by `reach` (three.js metres) to get the bat to the ball. */
  function apply(p, reach = null) {
    const rx = reach?.x ?? 0;
    const ry = reach?.y ?? 0;
    const rz = reach?.z ?? 0;
    root.position.set(STAND.x + rx, 0, STAND.z + p.back * BACK_STEP + rz);
    hips.rotation.set(0, Math.PI / 2 + p.hip, 0);
    hips.position.set(p.back * 0.15, 0.95 - p.step * 0.12, -p.step * 0.32 + p.back * 0.1);
    // The chest turns on from the hips and leans forward at the waist.
    chest.rotation.set(p.lean, p.chest - p.hip, 0);
    hands.position.set(p.hands[2], p.hands[1] + ry / scale, p.hands[0]);
    batPivot.quaternion.copy(p.q);
    // The head keeps looking down the pitch at the bowler: it turns back against the chest.
    head.rotation.set(-p.lean * 0.7, Math.PI / 2 - p.chest, 0);
    root.updateMatrixWorld(true);
    const top = gloveTop.getWorldPosition(new THREE.Vector3());
    const bottom = gloveBot.getWorldPosition(new THREE.Vector3());
    const sL = shoulderL.getWorldPosition(new THREE.Vector3());
    const sR = shoulderR.getWorldPosition(new THREE.Vector3());
    const eL = joint(sL, top, 0.29 * scale, ELBOW_L);
    const eR = joint(sR, bottom, 0.29 * scale, ELBOW_R);
    armL(sL, eL);
    foreL(eL, top);
    armR(sR, eR);
    foreR(eR, bottom);
    // Legs: the front (left) foot steps down the pitch, the back foot goes back and across.
    const hipL = hips.localToWorld(new THREE.Vector3(0.11, -0.05, 0));
    const hipR = hips.localToWorld(new THREE.Vector3(-0.11, -0.05, 0));
    const base = root.position;
    const fL = new THREE.Vector3(base.x + 0.12 * scale, 0.04, base.z - (0.3 + p.step * 0.7) * scale);
    const fR = new THREE.Vector3(base.x + (-0.05 + p.back * 0.3) * scale, 0.04, base.z + (0.22 + p.back * 0.15) * scale);
    const kL = joint(hipL, fL, 0.47 * scale, KNEE_L);
    const kR = joint(hipR, fR, 0.47 * scale, KNEE_R);
    thighL(hipL, kL);
    shinL(kL, fL);
    thighR(hipR, kR);
    shinR(kR, fR);
    footL.position.copy(fL);
    footL.rotation.y = 0.5;
    footR.position.copy(fR);
    footR.rotation.y = 1.2;
  }

  let shot = null;
  let eye = false;
  const batter = {
    root,
    head,
    /**
     * Play a shot: `kind` (see shotPath), the ball time the bat arrives, when he starts moving and
     * when the downswing starts (ball time), and where the bat is going (three.js point, or null).
     */
    play(kind, arriveAt, fromAt, swingAt, target) {
      const path = shotPath(kind, fromAt - arriveAt, swingAt - arriveAt);
      let reach = null;
      if (target && HIT[kind]) {
        // Where the middle of the bat would be in the hitting pose, and how far he has to move it.
        apply(P[HIT[kind]]);
        const m = middle.getWorldPosition(new THREE.Vector3());
        batter.wanted = { x: +(target.x - m.x).toFixed(2), y: +(target.y - m.y).toFixed(2), z: +(target.z - m.z).toFixed(2) };
        reach = {
          x: clamp(target.x - m.x, -REACH.x, REACH.x),
          y: clamp(target.y - m.y, -REACH.y, REACH.y),
          z: clamp(target.z - m.z, -REACH.z, REACH.z),
        };
      }
      shot = { path, arriveAt, fromAt, reach };
    },
    reset() {
      shot = null;
    },
    remove() {
      scene.remove(all);
    },
    /** Pose him at ball time t (t < 0 during the run-up). */
    update(t) {
      if (!shot) {
        // A small trigger movement as the bowler lets go.
        apply(t > 0 ? mix(P.stance, P.lift, clamp(t * 1.2, 0, 0.22)) : P.stance);
        return;
      }
      const tt = t - shot.arriveAt;
      const p = along(shot.path, tt);
      // The reach builds as he moves into the shot and is held through it.
      let reach = null;
      if (shot.reach) {
        const w = ease(clamp((t - shot.fromAt) / Math.max(0.05, shot.arriveAt - shot.fromAt), 0, 1));
        reach = { x: shot.reach.x * w, y: shot.reach.y * w, z: shot.reach.z * w };
      }
      apply(p, reach);
    },
    /** Through his own eyes: only the bat and gloves are drawn, the rest of him would fill the view. */
    setEye(on) {
      if (on === eye) return;
      eye = on;
      all.traverse((o) => {
        if (o.isMesh) o.visible = !on || batParts.has(o);
      });
    },
    /** The middle of the bat now (three.js point). */
    middle: () => middle.getWorldPosition(new THREE.Vector3()),
  };
  apply(P.stance);
  return batter;
}
