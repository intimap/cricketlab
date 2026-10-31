import { playSound, sfx } from "../engine/audio.js";
import { TRACKING_TIME } from "./match-broadcast.js";

/** Match contact data selects timbre here; the audio engine only synthesises voices. */
export function playContact(contact) {
  if (contact.kind === "gloved") return sfx.gloves();
  if (contact.kind === "padPop") {
    sfx.edge();
    return sfx.pad();
  }
  if (contact.kind !== "middle") {
    const thick = contact.impact?.thickness ?? 0.4;
    playSound({
      tones: [[1900 - 700 * thick, 0.035 + 0.025 * thick, 0.12 + 0.08 * thick, "triangle", 0, -500]],
      bursts: [[0.025 + 0.025 * thick, 3300 - 1200 * thick, 1.8, 0.18 + 0.15 * thick]],
    });
    return;
  }
  const region = contact.impact?.region;
  if (region !== "toe" && region !== "splice") return sfx.bat(contact.quality);
  const toe = region === "toe";
  playSound({
    tones: [[toe ? 300 : 210, toe ? 0.075 : 0.05, 0.3, "triangle", 0, -100]],
    bursts: [[0.045, toe ? 1400 : 850, 0.8, 0.35]],
  });
}

/** Short broadcast stings leave room for the ball sounds and crowd. */
export function playBroadcast(event) {
  const notes = {
    four: [523.25, 659.25, 783.99],
    six: [523.25, 659.25, 783.99, 1046.5],
    wicket: [392, 293.66, 196],
    review: [220, 329.63],
    verdict: [440, 554.37],
  }[event];
  if (!notes) return;
  playSound({ bus: "cues", tones: notes.map((f, i) => [f, 0.14, 0.13, "triangle", i * 0.09]) });
}

/** Cue each reveal once, from update rather than the rendering path. */
export function updateReviewAudio(scene) {
  const thresholds = [1, 1.6, 2.2, TRACKING_TIME];
  const cur = scene.cur;
  cur.reviewAudioStage ??= 0;
  while (cur.reviewAudioStage < thresholds.length && scene.phaseT >= thresholds[cur.reviewAudioStage]) {
    if (cur.reviewAudioStage === 3) playBroadcast("verdict");
    else playSound({ bus: "cues", tones: [[880, 0.045, 0.08, "sine"]] });
    cur.reviewAudioStage++;
  }
}
