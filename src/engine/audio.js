// Every sound is synthesised: filtered noise bursts and short oscillator
// tones, over a looping crowd murmur whose level swells on big moments.

import { load, save } from "./storage.js";
import { makeSynth, holdGain } from "./audio-synth.js";

let ac = null;
let master;
let crowd;
let noise;
let effects;
let cues;
let effectsBus;
let cuesBus;
let crowdBus;
let crowdEffects;
const levels = { effects: 0.8, crowd: 0.65, cues: 0.5 };
const savedLevels = load("audioLevels", {});
for (const name of Object.keys(levels)) {
  if (Number.isFinite(savedLevels?.[name])) levels[name] = Math.max(0, Math.min(1, savedLevels[name]));
}
let muted = load("muted", false);

/** Create (or resume) the audio context. Must run from a user gesture. */
export function unlockAudio() {
  if (ac) {
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return;
  }
  try {
    ac = new AudioContext();
  } catch {
    return;
  }
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.6;
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  master.connect(limiter);
  limiter.connect(ac.destination);

  // Two seconds of brown-ish noise, shared by the crowd loop and every burst.
  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = noise.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    data[i] = brown * 3.5 * 0.5 + white * 0.15;
  }

  effectsBus = ac.createGain();
  effectsBus.gain.value = levels.effects;
  effectsBus.connect(master);
  cuesBus = ac.createGain();
  cuesBus.gain.value = levels.cues;
  cuesBus.connect(master);
  effects = makeSynth(ac, noise, effectsBus);
  cues = makeSynth(ac, noise, cuesBus);

  crowdBus = ac.createGain();
  crowdBus.gain.value = levels.crowd;
  crowdBus.connect(master);
  crowdEffects = makeSynth(ac, noise, crowdBus);
  // Two differently filtered stands, with independent loop positions and stereo space.
  crowd = ac.createGain();
  crowd.gain.value = 0.05;
  crowd.connect(crowdBus);
  for (const [frequency, pan, rate] of [[550, -0.45, 0.87], [1150, 0.45, 1.03]]) {
    const loop = ac.createBufferSource();
    loop.buffer = noise;
    loop.loop = true;
    loop.playbackRate.value = rate;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const panner = ac.createStereoPanner();
    panner.pan.value = pan;
    loop.connect(filter);
    filter.connect(panner);
    panner.connect(crowd);
    loop.start(0, Math.random());
  }
}

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  save("muted", muted);
  if (master) {
    holdGain(master.gain, ac.currentTime);
    master.gain.linearRampToValueAtTime(muted ? 0 : 0.6, ac.currentTime + 0.03);
  }
}

export const getAudioLevels = () => ({ ...levels });

/** Independent mix levels, retained alongside the existing mute setting. */
export function setAudioLevels(next) {
  for (const name of ["effects", "crowd", "cues"]) {
    if (Number.isFinite(next[name])) levels[name] = Math.max(0, Math.min(1, next[name]));
  }
  save("audioLevels", levels);
  if (!ac) return;
  for (const [name, bus] of [["effects", effectsBus], ["crowd", crowdBus], ["cues", cuesBus]]) {
    holdGain(bus.gain, ac.currentTime);
    bus.gain.linearRampToValueAtTime(levels[name], ac.currentTime + 0.03);
  }
}

/** A generic layered sound; cricket-specific profiles live in the scene layer. */
export function playSound({ tones = [], bursts = [], bus = "effects" }) {
  if (!ac || muted || ac.state === "suspended") return;
  const synth = bus === "cues" ? cues : effects;
  for (const layer of tones) synth.tone(...layer);
  for (const layer of bursts) synth.burst(...layer);
}

function noiseBurst(...args) {
  if (ac && !muted && ac.state !== "suspended") effects.burst(...args);
}

function tone(...args) {
  if (ac && !muted && ac.state !== "suspended") effects.tone(...args);
}

export const sfx = {
  bat(quality) {
    tone(520 + quality * 260, 0.09, 0.3 + quality * 0.18, "triangle", 0, -180);
    tone(1250, 0.045, 0.12 * quality, "sine", 0.002, -260);
    noiseBurst(0.045, 2200, 1.2, 0.4 + quality * 0.2);
  },
  edge() {
    tone(1500, 0.04, 0.2, "square", 0, -600);
    noiseBurst(0.03, 3500, 2, 0.3);
  },
  pad() {
    tone(160, 0.08, 0.4, "sine", 0, -60);
    noiseBurst(0.05, 400, 1, 0.3);
  },
  bounce() {
    tone(120, 0.05, 0.25, "sine", 0, -40);
  },
  gloves() {
    tone(220, 0.05, 0.3, "sine", 0, -80);
    noiseBurst(0.04, 900, 1, 0.25);
  },
  stumps() {
    for (let i = 0; i < 4; i++) tone(900 + i * 220, 0.09, 0.25, "square", i * 0.035, -400);
    noiseBurst(0.2, 1800, 0.8, 0.4);
  },
  throw() {
    noiseBurst(0.12, 1200, 0.7, 0.08);
  },
  click() {
    tone(900, 0.03, 0.15, "square");
  },
  /** Crowd roar, `level` 0..1. */
  cheer(level) {
    if (!ac || muted || ac.state === "suspended") return;
    level = Math.max(0, Math.min(1, level));
    const t = ac.currentTime;
    holdGain(crowd.gain, t);
    crowd.gain.linearRampToValueAtTime(0.05 + 0.35 * level, t + 0.25);
    crowd.gain.linearRampToValueAtTime(0.05 + 0.2 * level, t + 1.4);
    crowd.gain.linearRampToValueAtTime(0.05, t + 3.5);
    for (let i = 0; i < 10 * level; i++) {
      crowdEffects.burst(0.065, 1800 + Math.random() * 1600, 2, 0.10 * level, 0.3 + Math.random() * 2);
    }
  },
  groan() {
    if (!ac || muted || ac.state === "suspended") return;
    const t = ac.currentTime;
    holdGain(crowd.gain, t);
    crowd.gain.linearRampToValueAtTime(0.18, t + 0.15);
    crowd.gain.linearRampToValueAtTime(0.05, t + 1.2);
  },
  appeal() {
    tone(330, 0.35, 0.12, "sawtooth", 0, 120);
    noiseBurst(0.4, 900, 0.8, 0.25);
  },
};
