// 3D Nets: the game's own nets (sim/), seen in three.js. Every ball is the real thing: the AI
// bowler's plan and delivery, the player's shot committed mid-flight (COMMIT in batting.js), the
// sim's contact and the live ball with its fielders, then the nets coach's verdict.
// This page only draws it and takes the keys; nothing here decides what happens.

import { createMatch } from "../sim/formats.js";
import { Rng } from "../sim/rng.js";
import { isSpinner } from "../sim/teams.js";
import { PITCH_TYPES } from "../sim/conditions.js";
import { PITCH_LENGTH } from "../sim/geometry.js";
import { crossingAtZ, sampleAtTime, DELIVERY_NAMES, movementText } from "../sim/delivery.js";
import {
  CONTACT_Z_FRONT,
  CONTACT_Z_BACK,
  SWING_TIME,
  NORMAL_CHARGE,
  COMMIT,
  playsBack,
  idealCommitLead,
  committedTiming,
  backFootShot,
} from "../sim/batting.js";
import { keeperSpot } from "../sim/field.js";
import { battingFeedback } from "../sim/coach.js";
import { sfx, unlockAudio, toggleMute, isMuted } from "../engine/audio.js";
import { load, save } from "../engine/storage.js";
import { makeStage, makeGround, makeStumps, makeFielder, makeBowler, makeBall, toWorld, colour } from "./world.js";
import { makeBatter, STAND } from "./batter.js";

const THREE = globalThis.THREE;
const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

// The player's swing, as in scenes/match.js.
const BACKLIFT_TIME = 0.15;
const POWER_BACKLIFT_TIME = 0.22;
const MIN_BACKLIFT = 0.04;
const DEFENCE_TIME = 0.25;
const POWER_CHARGE = 0.95;
const PLAYER_TIMING_WINDOW = 1.35;
const PLAYER_SLOWMO = 0.8;
/**
 * Longest the ball stays live after it reaches the bat (s). The 2D nets cut it at 1.6 s; here it
 * plays out (fielded, caught or over the rope) so you can watch where it went.
 */
const PLAY_TIME = 6;
/** Seconds the result and the coach's verdict stay up before the next ball (Space skips). */
const AFTER_TIME = 3.2;
/** Where the bowler's body is when he lets it go (sim z), and where he follows through to. */
const RELEASE_Z = 19.1;
const FOLLOW_THROUGH = { x: 0.9, z: 16.8 };

const SHOT_KEYS = { KeyS: "drive", KeyW: "loft", KeyQ: "cutpull" };
const DEFEND_KEYS = { KeyA: "front", KeyD: "back" };
const PITCHES = Object.keys(PITCH_TYPES);

/** Reading aids, remembered in this browser. */
const aids = { shadow: true, trail: false, mark: true, follow: true, ...load("nets3d:aids", {}) };

// ---------- The stage ----------
const { renderer, scene, camera } = makeStage($("scene"));
makeGround(scene);
const strikerStumps = makeStumps(scene, 0);
makeStumps(scene, PITCH_LENGTH);
const ball = makeBall(scene);

/** Cameras, in three.js coordinates (the bowler is down -z). */
const CAMS = [
  { name: "Behind the batter", pos: [0.75, 2.35, 6.2], look: [0.05, 0.75, -12] },
  { name: "Batter's eye", pos: [STAND.x + 0.06, 1.6, STAND.z + 0.02], look: [0.05, 1.0, -20], eye: true },
  { name: "Side on", pos: [9.5, 1.6, -2.5], look: [0, 0.9, -4.5] },
  { name: "Broadcast", pos: [0.4, 6.5, -34], look: [0, 0.7, -2] },
];
let camIx = clamp(load("nets3d:cam", 0), 0, CAMS.length - 1);
const camLook = new THREE.Vector3();
const camPos = new THREE.Vector3();

// ---------- The match ----------
let pitchId = PITCHES.includes(load("nets3d:pitch", "green")) ? load("nets3d:pitch", "green") : "green";
let match;
let inn;
let batter = null;
let batterIdx = -1;
let bowler = null;
let bowlerIdx = -1;
let fielders = [];
const tally = { balls: 0, good: 0, outs: 0, fours: 0, sixes: 0 };
let cur = null;
let phase = "wait";
let phaseT = 0;
let timeScale = 1;
let strikeAt = null;
let powerNext = false;

function newMatch() {
  match = createMatch({ format: "nets", mode: "bat", pitch: pitchId }, new Rng());
  inn = match.inn;
  batterIdx = bowlerIdx = -1;
  for (const f of fielders) scene.remove(f.group);
  fielders = [];
  Object.assign(tally, { balls: 0, good: 0, outs: 0, fours: 0, sixes: 0 });
  $("pitch-name").textContent = PITCH_TYPES[pitchId].name.toLowerCase();
  showTally();
  phase = "wait";
  phaseT = 0.6;
}

const spinnerNow = () => isSpinner(inn.bowler?.p.bowl);

/** The people on the field for this ball: striker, bowler, keeper and the nine fielders. */
function castForBall() {
  if (inn.striker !== batterIdx) {
    batter?.remove();
    batterIdx = inn.striker;
    batter = makeBatter(scene, inn.bat[batterIdx].p.look, inn.batTeam.colour);
  }
  if (inn.currentBowler !== bowlerIdx) {
    if (bowler) scene.remove(bowler.group);
    bowlerIdx = inn.currentBowler;
    const p = inn.bowler.p;
    bowler = makeBowler(scene, p.look.skin, inn.bowlTeam.colour);
    bowler.group.scale.setScalar(p.look.height / 1.82);
    $("bowler").textContent = `${p.name} · ${p.bowl.style}`;
  }
  // Keeper first, then the field (as BallInPlay numbers them, bowler aside).
  const others = inn.bowlTeam.players.filter((p) => !p.keeper && p !== inn.bowler.p);
  const spots = [
    { player: inn.keeper, pos: keeperSpot(spinnerNow()) },
    ...inn.placements.slice(0, 9).map((place, i) => ({ player: others[i % others.length], pos: place.pos })),
  ];
  while (fielders.length < spots.length) fielders.push(makeFielder(scene, "#c98f68", inn.bowlTeam.colour));
  spots.forEach((s, i) => {
    fielders[i].head.material = colour(s.player.look.skin);
    placeFielder(fielders[i], s.pos, null, 0);
  });
}

/** Stand a fielder at sim (x, z), facing the ball (or the batter), with a stride when moving. */
function placeFielder(f, pos, ballPos, speed, state = "idle") {
  toWorld(pos.x, 0, pos.z, f.group.position);
  const tx = ballPos ? ballPos.x : 0;
  const tz = ballPos ? ballPos.z : 0;
  f.group.rotation.set(0, Math.atan2(tx - pos.x, -(tz - pos.z)) + Math.PI, 0);
  const stride = speed > 0.5 ? Math.sin(performance.now() / 80) * 0.5 : 0;
  f.legs[0].rotation.x = stride;
  f.legs[1].rotation.x = -stride;
  f.group.rotation.z = state === "dive" ? 1.2 : 0;
  f.group.position.y = state === "celebrate" ? Math.abs(Math.sin(performance.now() / 120)) * 0.3 : 0;
}

// ---------- A ball ----------
function nextBall() {
  if (match.needOver) match.startOver();
  castForBall();
  const { intent, releaseError } = match.aiPlan();
  const spinner = spinnerNow();
  const style = inn.bowler.p.bowl.style;
  cur = {
    intent,
    aiReleaseError: releaseError,
    runupDur: spinner ? 1.5 : style === "fast" ? 2.5 : 2.2,
    runupStartZ: spinner ? 25.5 : 33,
    tRun: 0,
    delivery: null,
    t: 0,
    shot: null,
    play: null,
    contactDone: false,
    bounceDone: false,
    lastEv: 0,
    lbwChecked: false,
  };
  strikeAt = null;
  timeScale = 1;
  batter.reset();
  strikerStumps.reset();
  ball.hide();
  bowler.held.visible = true;
  setCall("");
  setButtons(null);
  $("speed").textContent = "";
  $("coach-title").textContent = "Face up";
  $("coach-title").className = "result";
  $("coach-lines").innerHTML = "<li>Pick your shot as the ball pitches. He plays it.</li>";
  phase = "runup";
  phaseT = 0;
}

function release() {
  cur.delivery = match.deliver(cur.intent, cur.aiReleaseError);
  cur.t = 0;
  bowler.held.visible = false;
  const d = cur.delivery;
  const type = DELIVERY_NAMES[cur.intent.type] ?? cur.intent.type;
  $("speed").textContent = `${Math.round(d.speed * 3.6)} km/h · ${type.toLowerCase()}`;
  if (d.noBall) setCall("No ball");
  phase = "flight";
  phaseT = 0;
}

/** Ball time at which it reaches the bat for a shot (and, for defence, a foot). */
function arrival(type, foot = null) {
  const d = cur.delivery;
  const back = playsBack(type, foot, d.pitchedAt?.z ?? 0);
  return crossingAtZ(d.samples, back ? CONTACT_Z_BACK : CONTACT_Z_FRONT)?.t ?? 0.6;
}

function commitTiming(type, foot = null) {
  const arrive = arrival(type, foot);
  const lead = arrive - cur.t;
  const timing = committedTiming(
    lead,
    idealCommitLead(cur.delivery, arrive),
    inn.bat[inn.striker].p.bat,
    inn.batterState(inn.striker),
    match.rng,
  );
  return { arrive, lead, timing };
}

/** Where the batter takes the bat (sim point), from the sim's verdict on the contact. */
function batTarget(res, back) {
  const c = res.contact;
  const z = back ? CONTACT_Z_BACK : CONTACT_Z_FRONT;
  const ballAt = crossingAtZ(cur.delivery.samples, z);
  if (c.at) {
    // Edges: the ball takes the side of the bat, so the middle is a little off it.
    const dx = { thickEdge: -0.05, thinEdge: -0.075, insideEdge: 0.06 }[c.kind] ?? 0;
    const dy = { topEdge: -0.1, gloved: -0.12, bottomEdge: 0.1 }[c.kind] ?? 0;
    return { x: c.at.x + dx, y: c.at.y + dy, z: c.at.z };
  }
  if (!ballAt) return null;
  // Beaten: he plays where he read it (the sim's bat line), or in line but at the wrong time.
  return { x: c.batX ?? ballAt.x, y: ballAt.y, z };
}

function commitSwing(type, power) {
  const { arrive, lead, timing } = commitTiming(type);
  // He plays it himself, timed to the ball: the swing starts so the bat arrives on time (give or
  // take his timing), the backlift before it, cut short if he's been left rushing.
  const swingAt = Math.max(cur.t + MIN_BACKLIFT, arrive - SWING_TIME[type] + timing.timingError);
  const backliftAt = Math.max(cur.t, swingAt - (power ? POWER_BACKLIFT_TIME : BACKLIFT_TIME));
  cur.shot = {
    type,
    charge: power ? POWER_CHARGE : NORMAL_CHARGE,
    timingError: swingAt + SWING_TIME[type] - arrive,
    readLead: timing.readLead,
    early: timing.early,
    commit: { lead, verdict: timing.verdict, off: timing.off },
    windowMult: PLAYER_TIMING_WINDOW,
  };
  cur.play = match.resolve(cur.intent, cur.delivery, cur.shot);
  const back = playsBack(type, null, cur.delivery.pitchedAt?.z ?? 0);
  let kind = type;
  if (type === "cutpull") {
    const at = crossingAtZ(cur.delivery.samples, CONTACT_Z_BACK) ?? { x: 0, y: 0.8 };
    kind = { cut: "cut", punch: "punch", glance: "glance", pull: "pull" }[backFootShot(at.x, at.y)];
  }
  animate(kind, swingAt + SWING_TIME[type], backliftAt, swingAt, back);
  showDecision(timing.verdict, timing.off, power);
}

function commitDefend(foot) {
  const { arrive, lead, timing } = commitTiming("defend", foot);
  const defendAt = Math.max(cur.t, arrive - DEFENCE_TIME + timing.timingError);
  cur.shot = {
    type: "defend",
    foot,
    charge: 0,
    timingError: Math.max(0, defendAt + DEFENCE_TIME - arrive),
    readLead: timing.readLead,
    early: timing.early,
    commit: { lead, verdict: timing.verdict, off: timing.off },
    windowMult: PLAYER_TIMING_WINDOW,
  };
  cur.play = match.resolve(cur.intent, cur.delivery, cur.shot);
  const back = foot === "back";
  animate(back ? "defendBack" : "defend", defendAt + DEFENCE_TIME, defendAt, defendAt, back);
  showDecision(timing.verdict, timing.off, false);
}

function commitLeave() {
  cur.shot = { type: "leave", charge: 0, timingError: 0 };
  cur.play = match.resolve(cur.intent, cur.delivery, cur.shot);
  batter.play("leave", cur.t + 0.2, cur.t, cur.t, null);
  $("coach-lines").innerHTML = "<li>Left it.</li>";
}

function animate(kind, arriveAt, fromAt, swingAt, back) {
  const target = batTarget(cur.play.res, back);
  batter.play(kind, arriveAt, fromAt, swingAt, target && toWorld(target.x, target.y, target.z));
}

/** Commit a shot from a key or button: drive, loft, cutpull, or defend with a foot. */
function shot(type, foot = null) {
  unlockAudio();
  if (phase === "after" && phaseT > 0.6) return nextBall();
  if (phase !== "flight" || cur.shot || !cur.delivery) return;
  setButtons(foot ? `defend-${foot}` : type);
  if (type === "defend") commitDefend(foot);
  else {
    commitSwing(type, powerNext || shiftDown);
    powerNext = false;
    $("b-power").classList.remove("on");
  }
}

// ---------- Each frame ----------
function updateFlight(dt) {
  if (strikeAt !== null) {
    // Slow motion just after a clean strike, as in the 2D game.
    timeScale = performance.now() / 1000 - strikeAt < 0.75 ? 0.3 : 1;
  }
  const slowmo = !cur.contactDone ? PLAYER_SLOWMO : 1;
  cur.t += dt * timeScale * slowmo;
  const d = cur.delivery;
  // Undecided with the ball nearly on him: he lets it go.
  if (!cur.shot && cur.t > (crossingAtZ(d.samples, CONTACT_Z_FRONT)?.t ?? 0.6) - COMMIT.lastCall) commitLeave();
  if (!cur.bounceDone && d.bounceIndex >= 0 && cur.t >= d.samples[d.bounceIndex].t) {
    cur.bounceDone = true;
    sfx.bounce();
    if (d.pitchedAt) ball.pitched(d.pitchedAt.x, d.pitchedAt.z, aids.mark);
  }
  const play = cur.play;
  if (!play || cur.t < play.res.start.t) {
    ball.place(sampleAtTime(d.samples, cur.t), aids);
    return;
  }
  const res = play.res;
  if (!cur.contactDone) {
    cur.contactDone = true;
    const kind = res.contact.kind;
    if (res.touchedBat) {
      if (kind === "middle") sfx.bat(res.contact.quality);
      else sfx.edge();
      if (kind === "middle" && play.shot.type !== "defend" && res.contact.quality > 0.25) strikeAt = performance.now() / 1000;
    } else if (res.padHit) {
      sfx.pad();
    }
    if (res.bowled) strikerStumps.knock();
    if (res.wide) setCall("Wide");
  }
  const live = play.live;
  for (let i = 0; live.t < cur.t && i++ < 50; ) live.step(Math.min(1 / 120, cur.t - live.t + 1e-6));
  handleEvents(live.events);
  ball.place(live.ball.pos, aids);
  if (!live.dead && live.t - res.start.t > PLAY_TIME) {
    live.dead = true;
    live.deadAt = live.t;
  }
  if (live.dead && live.t >= live.deadAt) ballDead();
}

function handleEvents(events) {
  for (; cur.lastEv < events.length; cur.lastEv++) {
    const ev = events[cur.lastEv];
    if (ev.type === "four") (setCall("Four"), sfx.cheer(0.7));
    else if (ev.type === "six") (setCall("Six"), sfx.cheer(1));
    else if (ev.type === "catch") (sfx.gloves(), sfx.cheer(0.9));
    else if (ev.type === "drop") (setCall("Dropped"), sfx.groan());
    else if (ev.type === "bowled") (sfx.stumps(), sfx.cheer(0.9));
    else if (ev.type === "stumped") (sfx.stumps(), strikerStumps.knock());
    else if (ev.type === "gather" || ev.type === "stop" || ev.type === "collect") sfx.gloves();
  }
}

function ballDead() {
  const play = cur.play;
  // A pad hit that might be LBW: the fielders go up and the umpire decides (no reviews in the nets).
  if (!cur.lbwChecked && match.lbwAppeal(play)) {
    cur.lbwChecked = true;
    sfx.appeal();
    const out = match.umpireLbw(play);
    if (out) match.giveLbw(play);
    setCall(out ? "Out, LBW" : "Not out");
  }
  const done = match.finish(play);
  const rec = done.rec;
  const fb = battingFeedback({ delivery: cur.delivery, shot: cur.shot, rec, spinner: spinnerNow() });
  tally.balls++;
  if (fb.grade === "good") tally.good++;
  if (rec.wicket) tally.outs++;
  if (rec.boundary === 4) tally.fours++;
  if (rec.boundary === 6) tally.sixes++;
  showTally();
  if (rec.wicket) setCall(`Out, ${rec.wicket.how === "caught" && rec.wicket.caughtBehind ? "caught behind" : rec.wicket.how}`);
  else if (!$("call").textContent) setCall(fb.title.toLowerCase());
  const moved = movementText(cur.delivery);
  if (moved) $("speed").textContent += ` · ${moved.toLowerCase()}`;
  $("coach-title").textContent = fb.title.toLowerCase();
  $("coach-title").className = "result " + fb.grade;
  $("coach-lines").innerHTML = fb.lines
    .slice(1)
    .map((l) => `<li${l.startsWith("COACH:") ? ' class="tip"' : ""}>${sentence(l)}</li>`)
    .join("");
  phase = "after";
  phaseT = 0;
}

/** The coach shouts in capitals on the 2D board; here it's read as ordinary sentences. */
const sentence = (s) => {
  const t = s.toLowerCase().replace(/\b(s|w|q|a|d)\)/g, (m) => m.toUpperCase());
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function updateRunup(dt) {
  cur.tRun += dt;
  const k = Math.min(1, cur.tRun / cur.runupDur);
  const z = lerp(cur.runupStartZ, RELEASE_Z, k);
  toWorld(0.15, 0, z, bowler.group.position);
  bowler.group.rotation.set(0, Math.PI, 0);
  bowler.group.position.y = Math.abs(Math.sin(cur.tRun * 11)) * 0.05;
  // The arm comes over in the last fifth of the run-up.
  bowler.arm.rotation.x = k < 0.8 ? Math.sin(cur.tRun * 6) * 0.3 : lerp(0, Math.PI * 1.15, (k - 0.8) / 0.2);
  if (cur.tRun >= cur.runupDur + clamp(cur.aiReleaseError, -0.08, 0.08)) release();
}

function updatePeople() {
  // The bowler follows through and pulls up.
  if (cur?.delivery) {
    const k = clamp(cur.t / 1.4, 0, 1);
    const x = lerp(0.15, FOLLOW_THROUGH.x, k);
    const z = lerp(RELEASE_Z, FOLLOW_THROUGH.z, 1 - (1 - k) * (1 - k));
    toWorld(x, 0, z, bowler.group.position);
    bowler.arm.rotation.x = Math.min(Math.PI * 2, Math.PI * 1.15 + cur.t * 8);
  }
  // Fielders (and the keeper) go wherever the live ball takes them.
  const live = cur?.contactDone ? cur.play.live : null;
  if (live) {
    const field = live.fielders.filter((f) => f.role !== "bowler");
    field.forEach((f, i) => fielders[i] && placeFielder(fielders[i], f.pos, live.ball.pos, f.curSpeed ?? 0, f.state));
  }
  batter?.update(cur ? (cur.delivery ? cur.t : cur.tRun - cur.runupDur) : -1);
}

function updateCamera(dt) {
  const c = CAMS[camIx];
  const target = new THREE.Vector3(...c.look);
  const pos = new THREE.Vector3(...c.pos);
  // After a hit in front of the wicket, follow the ball: lift up and look where it's going. (Behind
  // the wicket it would turn the camera right round, so those are watched from where it is.)
  if (aids.follow && !c.eye && cur?.contactDone && cur.play.res.touchedBat) {
    const b = cur.play.live.ball.pos;
    const away = Math.hypot(b.x, b.z);
    if (away > 8 && b.z > 2) {
      const w = clamp((away - 8) / 20, 0, 1);
      target.lerp(toWorld(b.x, Math.max(0.5, b.y), b.z), w);
      pos.y += 5 * w;
      pos.z += 3 * w;
    }
  }
  const k = 1 - Math.exp(-dt * 4);
  camPos.lerp(pos, k);
  camLook.lerp(target, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  batter?.setEye(!!c.eye);
  // Anyone walking right past the lens (the keeper coming up after the ball) is left out of the shot.
  for (const f of fielders) f.group.visible = f.group.position.distanceTo(camPos) > 3.5;
}

function snapCamera() {
  const c = CAMS[camIx];
  camPos.set(...c.pos);
  camLook.set(...c.look);
  $("b-cam").querySelector("span").textContent = c.name;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  phaseT += dt;
  if (phase === "wait" && phaseT > 1) nextBall();
  else if (phase === "runup") updateRunup(dt);
  else if (phase === "flight") updateFlight(dt);
  else if (phase === "after") {
    if (cur.contactDone) {
      // Let the ball roll on a little behind the verdict.
      const live = cur.play.live;
      if (live.t < cur.t + 1.5) live.step(dt);
      ball.place(live.ball.pos, aids);
    }
    if (phaseT > AFTER_TIME) nextBall();
  }
  if (phase !== "wait") updatePeople();
  if (debug && cur?.contactDone && !cur.logged) {
    // How far the middle of the bat is from the ball as it arrives (for tuning the poses).
    cur.logged = true;
    const res = cur.play.res;
    // Measured at the moment of contact, not this frame (a slow frame can be most of a metre late).
    batter.update(res.start.t);
    const p = res.start.pos;
    const gap = batter.middle().distanceTo(toWorld(p.x, p.y, p.z));
    batter.update(cur.t);
    debug.log.push({
      shot: cur.shot.type,
      contact: res.contact.kind,
      miss: res.contact.missReason,
      gap: +gap.toFixed(3),
      pitched: +(cur.delivery.pitchedAt?.z ?? 0).toFixed(2),
      wanted: batter.wanted,
      late: +(cur.t - res.start.t).toFixed(3),
    });
    batter.wanted = null;
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- HUD ----------
function setCall(text) {
  const el = $("call");
  el.textContent = text;
  el.classList.toggle("show", !!text);
}

function setButtons(on) {
  for (const b of document.querySelectorAll("[data-shot]")) b.classList.toggle("on", b.dataset.shot === on);
}

function showDecision(verdict, off, power) {
  const ms = `${Math.round(Math.abs(off) * 1000)} ms`;
  const text =
    verdict === "good" ? "Spot on: picked it as it pitched" : verdict === "early" ? `${ms} early: guessing` : `${ms} late: rushed`;
  $("coach-lines").innerHTML = `<li>${text}${power ? " · power" : ""}</li>`;
}

function showTally() {
  $("t-balls").textContent = tally.balls;
  $("t-good").textContent = tally.good;
  $("t-outs").textContent = tally.outs;
  $("t-bound").textContent = `${tally.fours} / ${tally.sixes}`;
}

function showAids() {
  for (const b of document.querySelectorAll("[data-aid]")) b.classList.toggle("on", !!aids[b.dataset.aid]);
  $("b-sound").classList.toggle("on", !isMuted());
}

function toggleAid(name) {
  aids[name] = !aids[name];
  save("nets3d:aids", aids);
  showAids();
}

function nextCamera() {
  camIx = (camIx + 1) % CAMS.length;
  save("nets3d:cam", camIx);
  snapCamera();
}

function nextPitch() {
  pitchId = PITCHES[(PITCHES.indexOf(pitchId) + 1) % PITCHES.length];
  save("nets3d:pitch", pitchId);
  ball.hide();
  newMatch();
}

// ---------- Input ----------
let shiftDown = false;
addEventListener("keydown", (e) => {
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") shiftDown = true;
  if (e.repeat) return;
  if (SHOT_KEYS[e.code]) shot(SHOT_KEYS[e.code]);
  else if (DEFEND_KEYS[e.code]) shot("defend", DEFEND_KEYS[e.code]);
  else if (e.code === "Space") {
    unlockAudio();
    if (phase === "after" && phaseT > 0.6) nextBall();
  } else if (e.code === "KeyC") nextCamera();
  else if (e.code === "KeyM") toggleAid("mark");
  else if (e.code === "KeyT") toggleAid("trail");
  else if (e.code === "KeyF") toggleAid("follow");
  else if (e.code === "KeyP") nextPitch();
  else if (e.code === "KeyN") (toggleMute(), showAids());
  else return;
  e.preventDefault();
});
addEventListener("keyup", (e) => {
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") shiftDown = false;
});
for (const b of document.querySelectorAll("[data-shot]")) {
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const [type, foot] = b.dataset.shot.split("-");
    shot(type, foot ?? null);
  });
}
for (const b of document.querySelectorAll("[data-aid]")) b.addEventListener("click", () => toggleAid(b.dataset.aid));
$("b-power").addEventListener("click", () => {
  powerNext = !powerNext;
  $("b-power").classList.toggle("on", powerNext);
});
$("b-cam").addEventListener("click", nextCamera);
$("b-pitch").addEventListener("click", nextPitch);
$("b-sound").addEventListener("click", () => {
  unlockAudio();
  toggleMute();
  showAids();
});
$("scene").addEventListener("pointerdown", () => {
  unlockAudio();
  if (phase === "after" && phaseT > 0.6) nextBall();
});

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 60 : 42;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
const debug = location.search.includes("debug") ? { log: [] } : null;
if (debug) {
  globalThis.nets3d = {
    debug,
    state: () => ({ phase, t: cur?.t, delivery: cur?.delivery, shot: cur?.shot }),
    /** Commit `type` (and foot) when the ball is `early` seconds before the ideal moment. */
    commitAt(type, foot = null, early = 0) {
      return new Promise((done) => {
        const tick = () => {
          if (phase === "flight" && cur.delivery && !cur.shot) {
            const arrive = arrival(type, foot);
            if (cur.t >= arrive - idealCommitLead(cur.delivery, arrive) - early) return done(shot(type, foot));
          }
          if (phase === "flight" && cur.shot) return done();
          requestAnimationFrame(tick);
        };
        tick();
      });
    },
  };
}

resize();
snapCamera();
showAids();
newMatch();
requestAnimationFrame(frame);
