/** Generic Web Audio voices. Every transient starts and ends at zero to avoid clicks. */
export function holdGain(param, time) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
  else {
    const value = param.value;
    param.cancelScheduledValues(time);
    param.setValueAtTime(value, time);
  }
}

/** A voice's usual attack (s): quick, but soft enough not to click. A struck sound asks for a sharper one. */
const ATTACK = 0.003;
/** The shortest a voice can be (s), and the shortest a click. */
const SHORTEST = 0.012;
const SHORTEST_CLICK = 0.003;

export function makeSynth(ac, noise, destination) {
  // White noise for clicks: the shared noise is mostly rumble, with too little top for a sharp transient.
  let white = null;
  const whiteNoise = () => {
    if (white) return white;
    white = ac.createBuffer(1, Math.round(ac.sampleRate * 0.25), ac.sampleRate);
    const data = white.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return white;
  };

  function voice(source, duration, volume, delay, filter = null, attack = ATTACK, shortest = SHORTEST) {
    const t = ac.currentTime + Math.max(0, delay);
    const dur = Math.max(shortest, duration);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), t + Math.min(attack, dur / 2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    gain.gain.linearRampToValueAtTime(0, t + dur + 0.01);
    source.connect(filter ?? gain);
    if (filter) filter.connect(gain);
    gain.connect(destination);
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
    };
    return { t, end: t + dur + 0.012 };
  }

  return {
    /** `attack` (s): how fast it comes up; a struck sound (wood, a bell) wants about a millisecond. */
    tone(freq, duration, volume, type = "sine", delay = 0, slide = 0, attack = ATTACK) {
      if (!(volume > 0)) return;
      const osc = ac.createOscillator();
      osc.type = type;
      const { t, end } = voice(osc, duration, volume, delay, null, attack);
      osc.frequency.setValueAtTime(Math.max(30, freq), t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
      osc.start(t);
      osc.stop(end);
    },
    burst(duration, freq, q, volume, delay = 0, attack = ATTACK) {
      if (!(volume > 0)) return;
      const source = ac.createBufferSource();
      source.buffer = noise;
      const filter = ac.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = q;
      const { t, end } = voice(source, duration, volume, delay, filter, attack);
      source.start(t, Math.random() * Math.max(0, noise.duration - duration - 0.05));
      source.stop(end);
    },
    /** A click: a few milliseconds of bright noise (everything above `cutoff` Hz), up in under a millisecond. */
    click(duration, cutoff, volume, delay = 0) {
      if (!(volume > 0)) return;
      const source = ac.createBufferSource();
      source.buffer = whiteNoise();
      const filter = ac.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 0.7;
      const { t, end } = voice(source, duration, volume, delay, filter, 0.0006, SHORTEST_CLICK);
      source.start(t, Math.random() * 0.2);
      source.stop(end);
    },
  };
}
