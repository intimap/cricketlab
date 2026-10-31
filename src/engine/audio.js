// Every sound is synthesised: filtered noise bursts and short oscillator
// tones, over a looping crowd murmur whose level swells on big moments.

import { load, save } from "./storage.js";

let ac = null;
let master;
let crowd;
let noise;
let muted = load("muted", false);

/** Create (or resume) the audio context. Must run from a user gesture. */
export function unlockAudio() {
  if (ac) {
    if (ac.state === "suspended") ac.resume();
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

  const loop = ac.createBufferSource();
  loop.buffer = noise;
  loop.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700;
  filter.Q.value = 0.6;
  crowd = ac.createGain();
  crowd.gain.value = 0.05;
  loop.connect(filter);
  filter.connect(crowd);
  crowd.connect(master);
  loop.start();
}

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  save("muted", muted);
  if (master) master.gain.value = muted ? 0 : 0.6;
}

function noiseBurst(duration, freq, q, volume, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(1e-4, t + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t, Math.random());
  src.stop(t + duration + 0.05);
}

function tone(freq, duration, volume, type = "sine", delay = 0, slide = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(1e-4, t + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export const sfx = {
  bat(quality) {
    tone(700 + quality * 500, 0.07, 0.35 + quality * 0.3, "triangle", 0, -300);
    noiseBurst(0.06, 2400, 1.5, 0.5 + quality * 0.4);
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
    if (!ac) return;
    const t = ac.currentTime;
    crowd.gain.cancelScheduledValues(t);
    crowd.gain.setValueAtTime(crowd.gain.value, t);
    crowd.gain.linearRampToValueAtTime(0.05 + 0.35 * level, t + 0.25);
    crowd.gain.linearRampToValueAtTime(0.05 + 0.2 * level, t + 1.4);
    crowd.gain.linearRampToValueAtTime(0.05, t + 3.5);
    for (let i = 0; i < 10 * level; i++) {
      noiseBurst(0.05, 2000 + Math.random() * 2000, 4, 0.12 * level, 0.3 + Math.random() * 2);
    }
  },
  groan() {
    if (!ac) return;
    const t = ac.currentTime;
    crowd.gain.setValueAtTime(crowd.gain.value, t);
    crowd.gain.linearRampToValueAtTime(0.18, t + 0.15);
    crowd.gain.linearRampToValueAtTime(0.05, t + 1.2);
  },
  appeal() {
    tone(330, 0.35, 0.12, "sawtooth", 0, 120);
    noiseBurst(0.4, 900, 0.8, 0.25);
  },
};
