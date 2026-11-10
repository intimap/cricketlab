import { COLORS, WIDTH, fillRect } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { setPractice } from "../sim/practice.js";
import { drawPracticePanel, practicePanelWidth, PRACTICE_PANEL_STEP } from "../render/practice-panel.js";
import { act } from "./player-actions.js";
import { practiceRows, stepRow, stepPitch, ballWords } from "./practice-rows.js";

/**
 * A practice session in the match scene (sim/practice.js has its rules): the Esc menu's PRACTICE panel for
 * changing the batter, the bowler, the ball and the pitch as you go (each change a "practice" action), and
 * what the strip along the bottom says in place of the score (render/practice-bar.js).
 */

/** The session's choices, as the practice rows (scenes/practice-rows.js) want them. */
const stateOf = (scene) => {
  const m = scene.match;
  return { settings: m.practice, team: m.inn.batTeam, mode: scene.human, pitch: m.pitch.type.id };
};

/** The line along the bottom: who's in, and how to change things. */
export function practiceLine(scene) {
  const m = scene.match;
  const batter = m.inn.batTeam.players[m.practice.batter];
  const bowler = m.inn.bowlTeam.players[m.practice.bowler];
  return scene.human === "bat"
    ? `Practice: ${batter.short} faces ${bowler.short}. Esc, then PRACTICE, to change who and what's bowled.`
    : `Practice: you bowl ${bowler.short} at ${batter.short}. Esc, then PRACTICE, to change who bats, who bowls, or the pitch.`;
}

/**
 * The "practice" action: new settings and (or) another pitch, from the next ball. A ball not yet bowled is
 * set up again when play resumes, so the change shows straight away.
 */
export function changePractice(scene, settings = null, pitch = null) {
  const m = scene.match;
  const before = m.pitch.type.id;
  setPractice(m, settings ?? m.practice, pitch);
  if (m.pitch.type.id !== before) scene.buildGround();
  scene.commentary = practiceLine(scene);
  scene.commT = 0;
  if (scene.phase === "pause" && (scene.pausedFrom === "ready" || scene.pausedFrom === "setup")) scene.practiceRedo = true;
}

/** The strip along the bottom (render/practice-bar.js). */
export function practiceBarOf(scene, delivery, line) {
  const m = scene.match;
  const team = m.inn.batTeam;
  const batter = team.players[m.practice.batter];
  const bowler = m.inn.bowlTeam.players[m.practice.bowler];
  const tally = scene.netsTally;
  const outs = m.inn.netsOuts;
  const count =
    scene.human === "bat"
      ? `BALLS ${tally.balls}   WELL PLAYED ${tally.good}   OUT ${outs}`
      : `BALLS ${tally.balls}   GOOD ${tally.good}   WICKETS ${outs}`;
  return {
    team,
    batter: `${batter.short.toUpperCase()} ${batter.hand === "left" ? "LH" : "RH"}`,
    bowler: bowler.short.toUpperCase(),
    delivery,
    ball: scene.human === "bat" ? ballWords(m.practice, bowler) : m.pitch.type.name,
    tally: count,
    line,
  };
}

/** The Esc menu's PRACTICE screen: up and down pick a row, left and right change it, Enter on DONE (or Esc) goes back. */
export function updatePracticeScreen(menu, scene) {
  const state = stateOf(scene);
  const rows = practiceRows(state, "session");
  menu.prow = Math.min(menu.prow ?? 0, rows.length - 1);
  if (keys.pressed("ArrowUp")) menu.prow = (menu.prow + rows.length - 1) % rows.length;
  if (keys.pressed("ArrowDown")) menu.prow = (menu.prow + 1) % rows.length;
  const key = rows[menu.prow][0];
  const dir = keys.pressed("ArrowRight") ? 1 : keys.pressed("ArrowLeft") ? -1 : 0;
  if (dir && key === "pitch") act(scene, { type: "practice", pitch: stepPitch(state.pitch, dir) });
  else if (dir && key !== "done") act(scene, { type: "practice", settings: stepRow(state, key, dir) });
  if (dir) sfx.click();
  const done = key === "done" && (keys.pressed("Enter") || keys.pressed("Space"));
  if (done || keys.pressed("Escape") || keys.pressed("Backspace")) menu.screen = "menu";
}

export function drawPracticeScreen(menu, scene) {
  fillRect(0, 0, WIDTH, 360, "rgba(0,0,0,0.45)");
  const rows = practiceRows(stateOf(scene), "session");
  const w = Math.max(300, practicePanelWidth(rows));
  const h = 34 + rows.length * PRACTICE_PANEL_STEP;
  const title = `PRACTICE: ${scene.human === "bat" ? "BATTING" : "BOWLING"}`;
  drawPracticePanel((WIDTH - w) / 2, 70, w, h, { title, rows, sel: menu.prow ?? 0, now: scene.now });
  drawText("UP/DOWN = CHOOSE   LEFT/RIGHT = CHANGE   FROM THE NEXT BALL", WIDTH / 2, 76 + h, {
    align: "center",
    color: COLORS.dim,
  });
}
