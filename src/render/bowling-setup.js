import { COLORS, drawPanel, drawBar } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { isSpinner, styleName } from "../sim/teams.js";
import { deliveryName, SPIN_EFFORT_NAMES, lengthName, lineName } from "../sim/delivery.js";
import { PRESET_LABELS } from "../sim/field.js";
import { staminaColor } from "./hud.js";
import { drawPitchMap } from "./pitch-map.js";

export const BOWLING_SIDE_CONTROL = { x: 8, y: 94, w: 232, h: 13 };

/** Bowling controls: bowler, delivery type, effort, target and field. */
export function drawSetupPanel(scene, wicketSide = "over") {
  const inn = scene.inn;
  const bowler = inn.bowler;
  const skills = bowler.p.bowl;
  const spinner = isSpinner(skills);
  const advice = scene.advice;
  drawPanel(4, 4, 240, advice ? 166 : 140, "rgba(13,35,24,0.92)");
  drawText(`${bowler.p.name.toUpperCase()}`, 10, 10, { color: COLORS.gold });
  drawText(`${styleName(skills)}  ${inn.bowlerOvers(bowler)} OV  ${inn.bowlerFigures(bowler)}`, 10, 20, {
    color: COLORS.dim,
  });
  drawText("STAMINA", 10, 31, { color: COLORS.dim });
  drawBar(58, 32, 70, 5, bowler.stamina, staminaColor(bowler.stamina));
  // Deliveries, three to a line.
  skills.repertoire.forEach((type, i) => {
    const x = 10 + (i % 3) * 78;
    const y = 43 + Math.floor(i / 3) * 10;
    drawText(`${i + 1}.${deliveryName(type, skills)}`, x, y, { color: type === scene.deliveryType ? COLORS.gold : COLORS.grey });
  });
  const effort = spinner ? `FLIGHT (E): ${SPIN_EFFORT_NAMES[scene.effort]}` : `EFFORT (E): ${scene.effort.toUpperCase()}`;
  drawText(effort, 10, 65, { color: COLORS.cream });
  drawText(`${lengthName(scene.target.length, spinner).toUpperCase()}, ${lineName(scene.target.line).toUpperCase()}`, 10, 76, {
    color: COLORS.cream,
  });
  drawText(`FIELD (F): ${inn.customField ? "CUSTOM" : PRESET_LABELS[inn.preset]}   V = EDIT`, 10, 87, { color: COLORS.cream });
  drawText(`SIDE (T): ${wicketSide === "around" ? "AROUND" : "OVER"} THE WICKET`, 10, 98, { color: COLORS.gold });
  let notes = [];
  if (!spinner) notes.push(`BOUNCERS ${inn.overBouncers}/2${bowler.bouncerWarnings ? " (WARNED)" : ""}`);
  if (inn.freeHit) notes.push("FREE HIT");
  drawText(notes.join("   "), 10, 109, { color: inn.freeHit ? COLORS.gold : COLORS.dim });
  drawText("ARROWS AIM  SHIFT = FINE", 10, 120, { color: COLORS.dim });
  drawText("SPACE = RUN IN   H = APPEAL", 10, 131, { color: COLORS.gold });
  if (advice) {
    // The keeper's ball (scenes/bowling-advice.js), and Enter to take it.
    drawText(advice.lines[0], 10, 145, { color: "#9fd0ff" });
    drawText(`${advice.lines[1]}  (ENTER)`, 10, 156, { color: COLORS.cream });
  }
  if (inn.newBallAvailable) drawText("N = TAKE THE NEW BALL", 252, 10, { color: COLORS.red, outline: COLORS.black });
  // Where the last balls to this batter pitched, under the panel.
  const pitches = inn.bat[inn.striker].pitches ?? [];
  if (pitches.length) drawPitchMap(4, advice ? 174 : 148, 84, 88, pitches, { title: "TO HIM", facing: scene.screenTurn });
}
