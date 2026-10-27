import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawPanel } from "../engine/screen.js";
import { drawText, wrapText } from "../engine/text.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { PITCH_TYPES } from "../sim/conditions.js";

const MODES = ["bat", "bowl"];
const PITCHES = ["green", "dust", "cracked"];
const SPELLS = [10, 20, 40, 90];

const cycle = (list, value, dir) => list[(list.indexOf(value) + dir + list.length) % list.length];

export class Menu {
  /** Highlighted row: 0 mode, 1 pitch, 2 spell length, 3 start. */
  sel = 0;
  cfg = { mode: "bat", pitch: "green", overs: 20 };
  t = 0;

  constructor(game) {
    this.game = game;
  }

  update(dt) {
    this.t += dt;
    if (keys.pressed("ArrowUp")) {
      this.sel = (this.sel + 3) % 4;
      sfx.click();
    }
    if (keys.pressed("ArrowDown")) {
      this.sel = (this.sel + 1) % 4;
      sfx.click();
    }
    const dir = keys.pressed("ArrowRight") ? 1 : keys.pressed("ArrowLeft") ? -1 : 0;
    if (dir) {
      sfx.click();
      if (this.sel === 0) this.cfg.mode = cycle(MODES, this.cfg.mode, dir);
      if (this.sel === 1) this.cfg.pitch = cycle(PITCHES, this.cfg.pitch, dir);
      if (this.sel === 2) this.cfg.overs = cycle(SPELLS, this.cfg.overs, dir);
    }
    if (keys.pressed("Enter") || (keys.pressed("Space") && this.sel === 3)) this.game.startMatch({ ...this.cfg });
  }

  draw() {
    ctx.drawImage(this.game.images.wide, 0, 0, WIDTH, HEIGHT);
    fillRect(0, 0, WIDTH, HEIGHT, "rgba(6,18,10,0.55)");
    const bob = Math.round(Math.sin(this.t * 2) * 2);
    drawText("CRICKET LAB", WIDTH / 2 + 3, 26 + bob + 3, { scale: 6, color: COLORS.black, align: "center", shadow: null });
    drawText("CRICKET LAB", WIDTH / 2, 26 + bob, { scale: 6, color: COLORS.gold, align: "center", outline: "#3a2a08" });
    drawText("16-BIT TEST CRICKET  -  PROTOTYPE V0.1", WIDTH / 2, 78, { align: "center", color: COLORS.cream });

    drawPanel(150, 98, 340, 132);
    const rows = [
      ["YOU", this.cfg.mode === "bat" ? "BAT  (AUSTRALIA v ENGLAND)" : "BOWL (AUSTRALIA v ENGLAND)"],
      ["PITCH", PITCH_TYPES[this.cfg.pitch].name],
      ["SPELL", `${this.cfg.overs} OVERS${this.cfg.overs === 90 ? " (A FULL DAY)" : ""}`],
      ["", "START  >"],
    ];
    rows.forEach(([label, value], i) => {
      const y = 112 + i * 18;
      const selected = this.sel === i;
      if (selected) fillRect(158, y - 4, 324, 15, "#24563a");
      drawText(label, 170, y, { color: COLORS.dim });
      const color = selected ? COLORS.gold : COLORS.cream;
      if (i < 3) drawText(`< ${value} >`, 230, y, { color, align: "left" });
      else drawText(value, 320, y, { color, align: "center" });
    });
    wrapText(PITCH_TYPES[this.cfg.pitch].blurb, 52).forEach((line, i) =>
      drawText(line, 320, 190 + i * 10, { align: "center", color: COLORS.dim }),
    );

    drawPanel(40, 238, 560, 84, "#0d2318");
    const help =
      this.cfg.mode === "bat"
        ? [
            "BATTING: SPACE TO FACE UP, THEN S DRIVE / Q CUT-PULL / W LOFT AS IT ARRIVES",
            "A = DEFEND.  NO KEY = LEAVE.  HOLD SHIFT FOR POWER, BUT PLAY IT EARLIER",
            "ARROWS AIM.  DOWN+W RAMP, DOWN+LEFT/RIGHT+Q SWEEP.  UP/DOWN = RUN",
            "O = SIMULATE THE OVER   C = CAMERA   V = VIEW FIELD   ESC = PAUSE / SCORECARD",
          ]
        : [
            "BOWLING: ARROWS SET LINE & LENGTH, NUMBERS PICK THE BALL, E EFFORT, F FIELD",
            "SPACE TO RUN IN, SPACE AGAIN IN THE GOLD ZONE OF THE METER TO RELEASE",
            "FIND EACH BATTER'S WEAKNESS. SET HIM UP, THEN CHANGE IT.  H = APPEAL  R = REVIEW",
            "V = DRAG FIELDERS   O = SIMULATE THE OVER   C = CAMERA   ESC = PAUSE",
          ];
    help.forEach((line, i) =>
      drawText(line, 320, 248 + i * 12, { align: "center", color: i === 0 ? COLORS.gold : COLORS.cream }),
    );
    drawText("ARROWS + ENTER", 320, 330, { align: "center", color: COLORS.dim });
    drawText("M = SOUND ON/OFF", 320, 342, { align: "center", color: COLORS.dim });
  }
}
