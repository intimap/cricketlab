import { playSound, sfx } from "../engine/audio.js";
import { batSound, powerOf } from "./bat-sound.js";
import { TRACKING_TIME, REPLAY_TIME } from "../render/match-broadcast.js";

/**
 * Match contact data selects timbre here; the audio engine only synthesises voices. Bat on ball is its own
 * profile (scenes/bat-sound.js): how clean it was, how hard it left the bat, and where on the bat it hit.
 */
export function playContact(contact) {
  if (contact.kind === "gloved") return sfx.gloves();
  if (contact.kind === "padPop") {
    sfx.edge();
    return sfx.pad();
  }
  playSound(
    batSound({
      kind: contact.kind,
      quality: contact.quality,
      power: powerOf(contact.exit),
      region: contact.impact?.region,
      thickness: contact.impact?.thickness ?? 0.4,
    }),
  );
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
  // The tracking boxes' reveals (after the REPLAY card), then the verdict.
  const thresholds = [1, 1.6, 2.2].map((t) => t + REPLAY_TIME).concat(TRACKING_TIME);
  const cur = scene.cur;
  cur.reviewAudioStage ??= 0;
  while (cur.reviewAudioStage < thresholds.length && scene.phaseT >= thresholds[cur.reviewAudioStage]) {
    if (cur.reviewAudioStage === 3) playBroadcast("verdict");
    else playSound({ bus: "cues", tones: [[880, 0.045, 0.08, "sine"]] });
    cur.reviewAudioStage++;
  }
}
