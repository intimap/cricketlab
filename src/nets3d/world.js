// The 3D nets world: ground, stumps, fielders, bowler, ball and the aids that help read it.
// three.js is loaded as a global (see nets3d.html).
//
// The sim works in metres with the striker's stumps at the origin, z down the pitch towards the
// bowler, x to the off side of a right-hander, y up. three.js looks down -z, so a sim point
// (x, y, z) is drawn at (x, y, -z): from behind the batter the off side is on the right.

import { PITCH_LENGTH, MID_PITCH, CREASE, BOUNDARY, STUMPS_HEIGHT, BALL_RADIUS } from "../sim/geometry.js";

const THREE = globalThis.THREE;

/** A sim point as a three.js vector. */
export const toWorld = (x, y, z, out = new THREE.Vector3()) => out.set(x, y, -z);

export const mats = {
  whites: new THREE.MeshLambertMaterial({ color: 0xf2eedd }),
  whitesShade: new THREE.MeshLambertMaterial({ color: 0xe3dcc4 }),
  pad: new THREE.MeshLambertMaterial({ color: 0xfbfbf5 }),
  glove: new THREE.MeshLambertMaterial({ color: 0xf4f4ee }),
  bat: new THREE.MeshLambertMaterial({ color: 0xe6cc92 }),
  batSpine: new THREE.MeshLambertMaterial({ color: 0xc9a86e }),
  grip: new THREE.MeshLambertMaterial({ color: 0x2b2b33 }),
  grille: new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }),
  wood: new THREE.MeshLambertMaterial({ color: 0xe8d7a8 }),
};
const colourMats = new Map();
/** One shared material per colour (skin tones, team caps). */
export function colour(hex) {
  if (!colourMats.has(hex)) colourMats.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  return colourMats.get(hex);
}

const shadowed = (m) => {
  m.castShadow = true;
  return m;
};
export const cyl = (r0, r1, h, mat) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 12), mat));
export const sph = (r, mat) => shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat));
export const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

/** Renderer, scene and light. */
export function makeStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc6e8);
  scene.fog = new THREE.Fog(0x9cc6e8, 90, 230);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x3a6b2a, 0.75));
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.05);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -30, near: 1, far: 90 });
  sun.target.position.set(0, 0, -8);
  scene.add(sun, sun.target);
  return { renderer, scene, camera };
}

function canvasTexture(w, h, paint, repeat = null) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"));
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

/** Outfield, square, pitch, creases, rope and a ring of stands. */
export function makeGround(scene) {
  const outfield = canvasTexture(
    512,
    512,
    (g) => {
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? "#4f8a37" : "#5c9a3f";
        g.fillRect(0, i * 32, 512, 32);
      }
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(${20 + Math.random() * 40},${60 + Math.random() * 50},20,0.18)`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
    },
    6,
  );
  const centre = toWorld(0, 0, MID_PITCH);
  const field = new THREE.Mesh(new THREE.CircleGeometry(BOUNDARY + 25, 64), new THREE.MeshLambertMaterial({ map: outfield }));
  field.rotation.x = -Math.PI / 2;
  field.position.copy(centre);
  field.receiveShadow = true;
  scene.add(field);

  const pitchTex = canvasTexture(128, 1024, (g) => {
    g.fillStyle = "#b9a36a";
    g.fillRect(0, 0, 128, 1024);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = `rgba(${120 + Math.random() * 60},${100 + Math.random() * 50},60,0.25)`;
      g.fillRect(Math.random() * 128, Math.random() * 1024, 2, 2);
    }
    // Worn patches where the bowlers land it.
    for (const y of [300, 720]) {
      const gr = g.createRadialGradient(64, y, 4, 64, y, 70);
      gr.addColorStop(0, "rgba(150,120,70,0.5)");
      gr.addColorStop(1, "rgba(150,120,70,0)");
      g.fillStyle = gr;
      g.fillRect(0, y - 80, 128, 160);
    }
  });
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(3.05, PITCH_LENGTH + 4), new THREE.MeshLambertMaterial({ map: pitchTex }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.copy(centre).setY(0.003);
  pitch.receiveShadow = true;
  scene.add(pitch);

  const white = new THREE.MeshBasicMaterial({ color: 0xf6f3e6 });
  const line = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), white);
    m.rotation.x = -Math.PI / 2;
    toWorld(x, 0.006, z, m.position);
    scene.add(m);
  };
  for (const [end, s] of [
    [0, 1],
    [PITCH_LENGTH, -1],
  ]) {
    line(3.66, 0.05, 0, end + s * CREASE); // popping crease
    line(2.64, 0.05, 0, end); // bowling crease
    for (const x of [-1.32, 1.32]) line(0.05, 2.44, x, end + s * 0.1); // return creases
  }

  const rope = new THREE.Mesh(new THREE.TorusGeometry(BOUNDARY, 0.08, 6, 128), new THREE.MeshLambertMaterial({ color: 0xf4f1c6 }));
  rope.rotation.x = Math.PI / 2;
  rope.position.copy(centre).setY(0.06);
  scene.add(rope);
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(BOUNDARY + 18, BOUNDARY + 22, 9, 64, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x7c5a3a, side: THREE.BackSide }),
  );
  stand.position.copy(centre).setY(4.5);
  const crowd = new THREE.Mesh(
    new THREE.CylinderGeometry(BOUNDARY + 19, BOUNDARY + 21, 5, 64, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x9a8f86, side: THREE.BackSide }),
  );
  crowd.position.copy(centre).setY(6.5);
  // Sightscreens behind each end, so the ball is seen against white out of the hand.
  const screenMat = new THREE.MeshLambertMaterial({ color: 0xf4f2ea });
  for (const z of [MID_PITCH + BOUNDARY + 4, MID_PITCH - BOUNDARY - 4]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.4), screenMat);
    toWorld(0, 3.5, z, s.position);
    scene.add(s);
  }
  scene.add(stand, crowd);
}

/** A set of stumps at sim depth z, which can be knocked over and put back. */
export function makeStumps(scene, z) {
  const g = new THREE.Group();
  const stumps = [-0.0762, 0, 0.0762].map((x) => {
    const m = cyl(0.018, 0.018, STUMPS_HEIGHT, mats.wood);
    m.position.set(x, STUMPS_HEIGHT / 2, 0);
    g.add(m);
    return m;
  });
  const bails = [-0.04, 0.04].map((x) => {
    const m = cyl(0.008, 0.008, 0.11, mats.wood);
    g.add(m);
    return m;
  });
  toWorld(0, 0, z, g.position);
  scene.add(g);
  return {
    reset() {
      stumps.forEach((m) => m.rotation.set(0, 0, 0));
      bails.forEach((b, i) => {
        b.position.set(i ? 0.04 : -0.04, STUMPS_HEIGHT + 0.01, 0);
        b.rotation.set(0, 0, Math.PI / 2);
      });
    },
    knock() {
      stumps.forEach((m, i) => {
        m.rotation.x = 0.5 + i * 0.1;
        m.rotation.z = (i - 1) * 0.3;
      });
      bails.forEach((b, i) => b.position.set((i ? 1 : -1) * 0.3, 0.2, 0.6));
    },
  };
}

/** A fielder: body, legs, head and cap in the team colour. Drawn wherever the sim has him. */
export function makeFielder(scene, skin, cap) {
  const g = new THREE.Group();
  const body = cyl(0.17, 0.2, 0.6, mats.whites);
  body.position.y = 1.15;
  g.add(body);
  const legs = [-1, 1].map((s) => {
    const l = cyl(0.08, 0.07, 0.85, mats.whitesShade);
    l.position.set(s * 0.1, 0.43, 0);
    g.add(l);
    return l;
  });
  const head = sph(0.11, colour(skin));
  head.position.y = 1.58;
  const capMesh = sph(0.115, colour(cap));
  capMesh.scale.y = 0.6;
  capMesh.position.y = 1.64;
  g.add(head, capMesh);
  scene.add(g);
  return { group: g, legs, head };
}

/** The bowler: runs in, arm over, lets it go, and follows through. */
export function makeBowler(scene, skin, cap) {
  const f = makeFielder(scene, skin, cap);
  const arm = new THREE.Group();
  arm.position.set(0.22, 1.42, 0);
  const upper = cyl(0.045, 0.04, 0.7, mats.whites);
  upper.position.y = -0.35;
  const held = sph(BALL_RADIUS, colour(0xa11d1d));
  held.position.y = -0.72;
  arm.add(upper, held);
  f.group.add(arm);
  return { ...f, arm, held };
}

/**
 * The ball, with the reading aids: a soft shadow on the ground under it (a real one is too small
 * to see), an optional trail, and an optional mark where it pitched.
 */
export function makeBall(scene) {
  const ball = sph(BALL_RADIUS * 1.1, new THREE.MeshPhongMaterial({ color: 0xc0221f, shininess: 60, emissive: 0x2a0505 }));
  ball.visible = false;
  scene.add(ball);

  const blob = canvasTexture(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, "rgba(0,0,0,0.55)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.visible = false;
  scene.add(shadow);

  const TRAIL = 24;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: 0.55 }));
  trail.frustumCulled = false;
  trail.visible = false;
  scene.add(trail);
  let trailCount = 0;

  const mark = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.1, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  mark.rotation.x = -Math.PI / 2;
  mark.visible = false;
  scene.add(mark);

  return {
    mesh: ball,
    /** Put the ball at a sim position; `aids` says which reading aids are on. */
    place(p, aids) {
      toWorld(p.x, Math.max(p.y, 0) + BALL_RADIUS, p.z, ball.position);
      ball.visible = true;
      shadow.visible = aids.shadow;
      shadow.position.set(ball.position.x, 0.008, ball.position.z);
      const s = 1 + Math.min(2, p.y) * 0.6;
      shadow.scale.set(s, s, s);
      shadow.material.opacity = 1 / s;
      trailPos.copyWithin(3, 0, (TRAIL - 1) * 3);
      trailPos[0] = ball.position.x;
      trailPos[1] = ball.position.y;
      trailPos[2] = ball.position.z;
      trailCount = Math.min(TRAIL, trailCount + 1);
      trailGeo.setDrawRange(0, trailCount);
      trailGeo.attributes.position.needsUpdate = true;
      trail.visible = aids.trail && trailCount > 1;
    },
    hide() {
      ball.visible = shadow.visible = trail.visible = mark.visible = false;
      trailCount = 0;
    },
    pitched(x, z, show) {
      toWorld(x, 0.01, z, mark.position);
      mark.visible = show;
    },
    stopTrail() {
      trail.visible = false;
      trailCount = 0;
    },
  };
}
