import { COLORS, fillRect } from "../engine/screen.js";
import { drawText } from "../engine/text.js";

export const FLAG_SIZE = { w: 36, h: 20 };

/** Small pixel flags stay sharp at the game's native resolution. */
export function drawTeamFlag(team, x, y) {
  const { w, h } = FLAG_SIZE;
  fillRect(x - 1, y - 1, w + 2, h + 2, COLORS.gold2);
  if (team.abbr === "ENG") {
    fillRect(x, y, w, h, COLORS.cream);
    fillRect(x + 15, y, 5, h, COLORS.red);
    fillRect(x, y + 8, w, 4, COLORS.red);
    return;
  }
  if (team.abbr === "SA") return southAfrica(x, y, w, h);
  if (team.abbr === "IND") return india(x, y, w, h);
  if (team.abbr === "PAK") return pakistan(x, y, w, h);
  if (team.abbr === "SL") return sriLanka(x, y, w, h);
  const canton = team.abbr === "AUS" || team.abbr === "NZ";
  fillRect(x, y, w, h, team.abbr === "AUS" ? "#172a50" : team.abbr === "NZ" ? "#14306e" : team.colour);
  if (!canton) {
    drawText(team.abbr, x + w / 2, y + 6, { align: "center", color: COLORS.cream });
    return;
  }
  unionCanton(x, y);
  if (team.abbr === "NZ") {
    // The Southern Cross in four red stars, edged white.
    for (const [sx, sy] of [
      [26, 4],
      [22, 10],
      [30, 9],
      [26, 16],
    ]) {
      fillRect(x + sx - 1, y + sy - 1, 3, 3, COLORS.cream);
      fillRect(x + sx, y + sy, 1, 1, COLORS.red);
    }
    return;
  }
  // The Commonwealth star and the Southern Cross.
  for (const [sx, sy] of [
    [7, 15],
    [26, 4],
    [22, 10],
    [31, 11],
    [26, 17],
  ]) {
    fillRect(x + sx - 1, y + sy, 3, 1, COLORS.cream);
    fillRect(x + sx, y + sy - 1, 1, 3, COLORS.cream);
  }
  fillRect(x + 29, y + 8, 1, 1, COLORS.cream);
}

/** The Union Jack in the top corner of the Australian and New Zealand flags. */
function unionCanton(x, y) {
  for (let i = 0; i < 16; i++) {
    const row = Math.floor((i * 10) / 16);
    fillRect(x + i, y + row, 1, 1, COLORS.cream);
    fillRect(x + i, y + 9 - row, 1, 1, COLORS.cream);
  }
  fillRect(x + 6, y, 4, 10, COLORS.cream);
  fillRect(x, y + 3, 16, 4, COLORS.cream);
  fillRect(x + 7, y, 2, 10, COLORS.red);
  fillRect(x, y + 4, 16, 2, COLORS.red);
}

/** South Africa: red over blue, the green Y edged white, and the black triangle edged gold at the hoist. */
function southAfrica(x, y, w, h) {
  fillRect(x, y, w, h / 2, "#de3831");
  fillRect(x, y + h / 2, w, h / 2, "#002395");
  for (let i = 0; i < 14; i++) {
    // The Y's arms, white then green, narrowing to the middle band.
    const top = Math.round((i * 7) / 14);
    fillRect(x + i, y + top - 1, 2, 4, COLORS.cream);
    fillRect(x + i, y + h - top - 3, 2, 4, COLORS.cream);
    fillRect(x + i, y + top, 2, 2, "#007a4d");
    fillRect(x + i, y + h - top - 2, 2, 2, "#007a4d");
  }
  fillRect(x + 12, y + 7, w - 12, 6, COLORS.cream);
  fillRect(x + 12, y + 8, w - 12, 4, "#007a4d");
  for (let i = 0; i < 9; i++) {
    const half = Math.round(((9 - i) * 6) / 9);
    fillRect(x + i, y + 10 - half - 1, 1, half * 2 + 2, "#ffb612");
    fillRect(x + i, y + 10 - half, 1, half * 2, "#000000");
  }
}

/** India: saffron, white and green, the navy wheel in the middle. */
function india(x, y, w, h) {
  fillRect(x, y, w, 7, "#ff9933");
  fillRect(x, y + 7, w, 6, "#f8f8f2");
  fillRect(x, y + 13, w, h - 13, "#138808");
  const cx = x + w / 2;
  const cy = y + 10;
  // The wheel: a ring with a hub.
  fillRect(cx - 2, cy - 3, 4, 1, "#0b2a80");
  fillRect(cx - 2, cy + 2, 4, 1, "#0b2a80");
  fillRect(cx - 3, cy - 2, 1, 4, "#0b2a80");
  fillRect(cx + 2, cy - 2, 1, 4, "#0b2a80");
  fillRect(cx - 1, cy - 1, 2, 2, "#0b2a80");
}

/** Pakistan: dark green with a white band at the hoist, and the white crescent and star. */
function pakistan(x, y, w, h) {
  const green = "#0b5d2a";
  fillRect(x, y, w, h, green);
  fillRect(x, y, 9, h, "#f4f4f0");
  // The crescent: a white disc with a green one cut from it, up and to the right.
  const cx = x + 22;
  const cy = y + 11;
  for (let dy = -5; dy <= 5; dy++)
    for (let dx = -5; dx <= 5; dx++) {
      const inner = (dx - 1.6) ** 2 + (dy + 1.4) ** 2 <= 16;
      if (dx * dx + dy * dy <= 25 && !inner) fillRect(cx + dx, cy + dy, 1, 1, "#f4f4f0");
    }
  // The star.
  fillRect(x + 26, y + 6, 3, 1, "#f4f4f0");
  fillRect(x + 27, y + 5, 1, 3, "#f4f4f0");
}

/** Sri Lanka: a gold border, green and saffron stripes at the hoist, the gold lion on maroon. */
function sriLanka(x, y, w, h) {
  const gold = "#ffbe29";
  fillRect(x, y, w, h, gold);
  fillRect(x + 2, y + 2, 4, h - 4, "#00534e");
  fillRect(x + 6, y + 2, 4, h - 4, "#eb7400");
  fillRect(x + 12, y + 2, w - 14, h - 4, "#8d153a");
  // The lion, standing with a sword raised: body, head, legs and the sword.
  const lx = x + 18;
  const ly = y + 6;
  fillRect(lx, ly + 3, 9, 4, gold);
  fillRect(lx + 6, ly, 4, 4, gold);
  fillRect(lx, ly + 7, 2, 3, gold);
  fillRect(lx + 7, ly + 7, 2, 3, gold);
  fillRect(lx + 10, ly - 2, 1, 5, gold);
  fillRect(lx - 2, ly + 2, 2, 1, gold);
  // Bo leaves in the corners of the maroon.
  for (const [dx, dy] of [
    [14, 4],
    [w - 4, 4],
    [14, h - 5],
    [w - 4, h - 5],
  ])
    fillRect(x + dx, y + dy, 1, 1, gold);
}
