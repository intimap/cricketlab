/** Generic Web Audio voices. Every transient starts and ends at zero to avoid clicks. */
export function holdGain(param, time) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
  else {
    const value = param.value;
    param.cancelScheduledValues(time);
    param.setValueAtTime(value, time);
  }
}

export function makeSynth(ac, noise, destination) {
  function voice(source, duration, volume, delay, filter = null) {
    const t = ac.currentTime + Math.max(0, delay);
    const dur = Math.max(0.012, duration);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), t + 0.003);
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
    tone(freq, duration, volume, type = "sine", delay = 0, slide = 0) {
      if (!(volume > 0)) return;
      const osc = ac.createOscillator();
      osc.type = type;
      const { t, end } = voice(osc, duration, volume, delay);
      osc.frequency.setValueAtTime(Math.max(30, freq), t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
      osc.start(t);
      osc.stop(end);
    },
    burst(duration, freq, q, volume, delay = 0) {
      if (!(volume > 0)) return;
      const source = ac.createBufferSource();
      source.buffer = noise;
      const filter = ac.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = q;
      const { t, end } = voice(source, duration, volume, delay, filter);
      source.start(t, Math.random() * Math.max(0, noise.duration - duration - 0.05));
      source.stop(end);
    },
  };
}
