import { COLORS, WIDTH, fillRect, drawPanel } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { keys, mouse } from "../engine/input.js";
import { toggleMute, isMuted } from "../engine/audio.js";
import { drawScorecard } from "../render/hud.js";

const ITEMS = ["RESUME", "SCORECARD", "INSTRUCTIONS", "VIEW", "SOUND", "QUIT TO MENU"];
const MENU_X = 220;
const MENU_W = 200;
const MENU_TOP = 92;
const ROW_H = 18;

// Instructions, a page per tab: [keys, what they do].
const PAGES = [
  {
    title: "BATTING",
    rows: [
      ["SPACE", "FACE UP, THEN PLAY YOUR SHOT AS THE BALL ARRIVES"],
      ["S", "DRIVE"],
      ["Q", "CUT / PULL"],
      ["W", "LOFT"],
      ["A", "DEFEND"],
      ["NO KEY", "LEAVE IT"],
      ["ARROWS", "AIM THE SHOT"],
      ["SHIFT + SHOT", "POWER - BUT PLAY IT EARLIER"],
      ["DOWN + W", "RAMP OVER THE KEEPER"],
      ["DOWN+LEFT + Q", "SWEEP"],
      ["DOWN+RIGHT + Q", "REVERSE SWEEP"],
      ["UP / DOWN", "RUN, OR SEND HIM BACK"],
    ],
  },
  {
    title: "BOWLING",
    rows: [
      ["1 - 6", "CHOOSE THE DELIVERY"],
      ["ARROWS", "SET LINE AND LENGTH"],
      ["E", "EFFORT (SPINNERS: FLIGHT)"],
      ["F", "FIELD PRESET"],
      ["V", "DRAG FIELDERS WITH THE MOUSE"],
      ["SPACE", "RUN IN"],
      ["SPACE AGAIN", "RELEASE IN THE GOLD ZONE OF THE METER"],
      ["HOLD LEFT/RIGHT", "AFTERTOUCH IN THE RUN-UP: EXTRA SWING OR SPIN"],
      ["H", "APPEAL"],
      ["R", "REVIEW A DECISION (2 PER INNINGS)"],
      ["", ""],
      ["TIP", "FIND EACH BATTER'S WEAKNESS."],
      ["", "SET HIM UP, THEN CHANGE IT."],
    ],
  },
  {
    title: "MATCH",
    rows: [
      ["O", "SIMULATE THE OVER"],
      ["P", "SIMULATE FIVE OVERS"],
      ["C", "CAMERA: AUTO / CLOSE / WIDE"],
      ["B", "CLOSE VIEW FROM BEHIND THE BATTER OR BOWLER"],
      ["V", "VIEW THE FIELD (BOWLING: DRAG FIELDERS)"],
      ["M", "SOUND ON / OFF"],
      ["ESC", "THIS MENU"],
    ],
  },
];
const TAB_W = 120;
const TABS_X = WIDTH / 2 - (TAB_W * PAGES.length) / 2;

const inside = (x, y, w, h) => mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;

/** The Esc menu: resume, scorecard, instructions, sound, quit. */
export class PauseMenu {
  sel = 0;
  /** "menu", "card" or "help". */
  screen = "menu";
  page = 0;

  lastMouse = { x: 0, y: 0 };

  open() {
    this.sel = 0;
    this.screen = "menu";
    this.lastMouse = { x: mouse.x, y: mouse.y };
  }

  /** Handle input; returns "resume", "view" (swap the close camera's end), "quit" or null. */
  update() {
    if (this.screen !== "menu") {
      if (this.screen === "help") {
        if (keys.pressed("ArrowLeft")) this.page = (this.page + PAGES.length - 1) % PAGES.length;
        if (keys.pressed("ArrowRight") || keys.pressed("Tab")) this.page = (this.page + 1) % PAGES.length;
        if (mouse.pressed && inside(TABS_X, 24, TAB_W * PAGES.length, 14)) {
          this.page = Math.floor((mouse.x - TABS_X) / TAB_W);
          return null;
        }
      }
      const back = mouse.pressed && (this.screen === "card" || inside(26, 296, 80, 14));
      if (keys.pressed("Escape") || keys.pressed("Enter") || keys.pressed("Backspace") || back) this.screen = "menu";
      return null;
    }

    if (keys.pressed("Escape")) return "resume";
    if (keys.pressed("ArrowUp")) this.sel = (this.sel + ITEMS.length - 1) % ITEMS.length;
    if (keys.pressed("ArrowDown")) this.sel = (this.sel + 1) % ITEMS.length;
    let chosen = keys.pressed("Enter") || keys.pressed("Space");
    // The pointer only takes over the selection when it moves (or clicks), so a resting mouse doesn't fight the arrows.
    const moved = mouse.x !== this.lastMouse.x || mouse.y !== this.lastMouse.y;
    this.lastMouse = { x: mouse.x, y: mouse.y };
    ITEMS.forEach((_, i) => {
      if (!inside(MENU_X + 6, MENU_TOP + 22 + i * ROW_H - 4, MENU_W - 12, ROW_H)) return;
      if (moved || mouse.pressed) this.sel = i;
      if (mouse.pressed) chosen = true;
    });
    if (!chosen) return null;
    switch (ITEMS[this.sel]) {
      case "RESUME":
        return "resume";
      case "SCORECARD":
        this.screen = "card";
        return null;
      case "INSTRUCTIONS":
        this.screen = "help";
        return null;
      case "VIEW":
        return "view";
      case "SOUND":
        toggleMute();
        return null;
      default:
        return "quit";
    }
  }

  /** `closeEnd`: which end the close camera is at ("bat" or "bowl"), for the VIEW label. */
  draw(inn, closeEnd) {
    if (this.screen === "card") {
      drawScorecard(inn, 20, 18, 600, 290, "SCORECARD");
      drawText("ESC / CLICK = BACK", WIDTH / 2, 296, { align: "center", color: COLORS.gold });
      return;
    }
    if (this.screen === "help") {
      this.drawHelp();
      return;
    }
    fillRect(0, 0, WIDTH, 360, "rgba(0,0,0,0.45)");
    drawPanel(MENU_X, MENU_TOP, MENU_W, 22 + ITEMS.length * ROW_H + 6, "#0d2318");
    drawText("PAUSED", WIDTH / 2, MENU_TOP + 7, { align: "center", color: COLORS.gold });
    ITEMS.forEach((item, i) => {
      const y = MENU_TOP + 22 + i * ROW_H;
      const selected = i === this.sel;
      if (selected) fillRect(MENU_X + 6, y - 4, MENU_W - 12, 15, "#24563a");
      const label =
        item === "SOUND"
          ? `SOUND: ${isMuted() ? "OFF" : "ON"}`
          : item === "VIEW"
            ? `VIEW: BEHIND ${closeEnd === "bowl" ? "BOWLER" : "BATTER"}`
            : item;
      drawText(label, WIDTH / 2, y, { align: "center", color: selected ? COLORS.gold : COLORS.cream });
    });
  }

  drawHelp() {
    drawPanel(20, 18, 600, 296, "#0d2318");
    PAGES.forEach((p, i) => {
      const x = TABS_X + i * TAB_W;
      const on = i === this.page;
      fillRect(x + 2, 24, TAB_W - 4, 14, on ? "#24563a" : "#14301f");
      drawText(p.title, x + TAB_W / 2, 28, { align: "center", color: on ? COLORS.gold : COLORS.dim });
    });
    PAGES[this.page].rows.forEach(([key, what], i) => {
      const y = 52 + i * 18;
      drawText(key, 200, y, { align: "right", color: COLORS.gold });
      drawText(what, 216, y, { color: COLORS.cream });
    });
    drawText("< BACK", 30, 299, { color: COLORS.gold });
    drawText("LEFT / RIGHT OR CLICK A TAB   ESC = BACK", WIDTH / 2 + 30, 299, { align: "center", color: COLORS.dim });
  }
}
