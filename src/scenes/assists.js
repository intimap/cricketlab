import { load, save } from "../engine/storage.js";

/**
 * The assist level, EASY, NORMAL or HARD: how much help the player gets. Set on the menu's where-and-when page
 * and in the pause menu, remembered on this device. A match keeps the easiest level it was played at, for its
 * high-score entry.
 *   beatWiden, missedBeat  the run-up's beats (sim/rhythm.js): wider windows, and what a miss is still worth
 *   zone                   the release meter's gold zone, as a share of its width
 *   aim                    after running in: "marker" (the landing spot stays up), "crosshair", or "none"
 *   ring                   batting, the ring round the ball (scenes/ball-ring.js): "truth", "read", or "none"
 *   advice                 the keeper's ball: "selected" (already chosen), or "shown"
 *   feet                   batting: "auto" (his feet go to the length; you choose the shot and time it), or "own"
 *   window                 batting: the timing window, times the player's usual one
 *   landing                batting: the landing mark shows from release (otherwise only as it pitches)
 *   cue                    batting: half a second before release, the zone the ball will pitch in flashes on
 *                          the pitch in its ring colour, with a beep (scenes/match-ball.js); not on HARD
 *   gauge                  batting with the bat on a stick: the swing gauge (scenes/bat-stick.js); not on HARD
 */
export const ASSISTS = ["easy", "normal", "hard"];
/** A new player starts on EASY. */
export const DEFAULT_ASSIST = "easy";
export const ASSIST_NAMES = { easy: "EASY", normal: "NORMAL", hard: "HARD" };
export const ASSIST = {
  easy: {
    beatWiden: 1.8,
    missedBeat: 0.5,
    zone: 1.6,
    aim: "marker",
    ring: "truth",
    advice: "selected",
    feet: "auto",
    window: 1.3,
    landing: true,
    cue: true,
    gauge: true,
  },
  normal: {
    beatWiden: 1,
    missedBeat: 0,
    zone: 1,
    aim: "crosshair",
    ring: "read",
    advice: "shown",
    feet: "own",
    window: 1,
    landing: false,
    cue: true,
    gauge: true,
  },
  hard: {
    beatWiden: 0.75,
    missedBeat: 0,
    zone: 0.7,
    aim: "none",
    ring: "none",
    advice: "shown",
    feet: "own",
    window: 0.8,
    landing: false,
    cue: false,
    gauge: false,
  },
};

/** This device's assist level. */
export function assistSetting() {
  const level = load("assist", DEFAULT_ASSIST);
  return ASSISTS.includes(level) ? level : "normal";
}

/** What the scene's level gives (the table above). */
export const assistOf = (scene) => ASSIST[scene.assist] ?? ASSIST.normal;

/** Change the level mid-match (the pause menu): remembered, and the match notes it if it's easier. */
export function setAssist(scene, level) {
  save("assist", level);
  scene.assist = level;
  noteAssist(scene.match, level);
}

/** The match keeps the easiest level it has been played at. */
export function noteAssist(match, level) {
  const easiest = match.easiestAssist ?? level;
  match.easiestAssist = ASSISTS.indexOf(level) < ASSISTS.indexOf(easiest) ? level : easiest;
}
