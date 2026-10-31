import { getAudioLevels, setAudioLevels } from "../engine/audio.js";
import { keys, mouse } from "../engine/input.js";
import { COLORS, WIDTH, fillRect, drawPanel, drawBar } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

const CHANNELS = [["effects", "BALL / EFFECTS"], ["crowd", "CROWD"], ["cues", "BROADCAST"]];
const BAR_X = 245;
const BAR_W = 180;

export function updateAudioMix(menu) {
  menu.mixSel ??= 0;
  if (keys.pressed("Escape") || keys.pressed("Enter") || keys.pressed("Backspace") ||
      (mouse.pressed && mouse.x >= 165 && mouse.x < 240 && mouse.y >= 244 && mouse.y < 264)) {
    menu.screen = "menu";
    return;
  }
  if (keys.pressed("ArrowUp")) menu.mixSel = (menu.mixSel + 2) % 3;
  if (keys.pressed("ArrowDown")) menu.mixSel = (menu.mixSel + 1) % 3;
  const name = CHANNELS[menu.mixSel][0];
  const step = (keys.pressed("ArrowRight") ? 1 : 0) - (keys.pressed("ArrowLeft") ? 1 : 0);
  if (step) setAudioLevels({ [name]: Math.round((getAudioLevels()[name] + step * 0.1) * 20) / 20 });
  if (mouse.pressed && mouse.x >= BAR_X - 8 && mouse.x <= BAR_X + BAR_W + 8) {
    const i = CHANNELS.findIndex((_, i) => Math.abs(mouse.y - (110 + i * 42)) < 14);
    if (i >= 0) {
      menu.mixSel = i;
      setAudioLevels({ [CHANNELS[i][0]]: Math.round(((mouse.x - BAR_X) / BAR_W) * 20) / 20 });
    }
  }
}

export function drawAudioMix(menu) {
  drawPanel(155, 65, 330, 205, COLORS.green, COLORS.gold2);
  drawText("AUDIO MIX", WIDTH / 2, 77, { align: "center", color: COLORS.gold, scale: 2 });
  const levels = getAudioLevels();
  CHANNELS.forEach(([name, label], i) => {
    const y = 110 + i * 42;
    const selected = i === (menu.mixSel ?? 0);
    if (selected) fillRect(164, y - 10, 312, 30, "#24563a");
    drawText(label, 170, y - 3, { color: selected ? COLORS.gold : COLORS.cream });
    drawBar(BAR_X, y + 9, BAR_W, 5, levels[name], COLORS.gold);
    drawText(`${Math.round(levels[name] * 100)}%`, 467, y - 3, { align: "right", color: COLORS.cream });
  });
  drawText("ARROWS TO ADJUST / TAP A BAR", WIDTH / 2, 226, { align: "center", color: COLORS.dim });
  drawText("< BACK", 170, 251, { color: COLORS.gold });
  drawText("M: MUTE ALL", 467, 251, { align: "right", color: COLORS.dim });
}
