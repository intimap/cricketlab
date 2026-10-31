/** Let the ball burst off the bat at real pace before the broadcast cuts wide. */
export const STRIKE_CLOSE_HOLD = 0.32;

export function updateStrikePresentation(scene) {
  const strikeAt = scene.cur?.strikeAt;
  if (!Number.isFinite(strikeAt)) return;
  // Incoming delivery assistance remains in match.js; a struck ball runs at full speed.
  scene.timeScale = 1;
  if (scene.now - strikeAt >= STRIKE_CLOSE_HOLD && scene.cam === "auto" && scene.view === "close") {
    scene.view = "wide";
  }
}
