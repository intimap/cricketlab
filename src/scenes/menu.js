import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawPanel } from "../engine/screen.js";
import { drawText, wrapText } from "../engine/text.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { load, save } from "../engine/storage.js";
import { PITCH_TYPES } from "../sim/conditions.js";
import { FORMATS, CLASSICS, OVERS_CHOICES } from "../sim/formats.js";

const FORMAT_IDS = Object.keys(FORMATS);
const MODES = ["bat", "bowl"];
const PITCHES = ["green", "dust", "cracked"];
const CLASSIC_IDS = CLASSICS.map((c) => c.id);

const cycle = (list, value, dir) => list[(list.indexOf(value) + dir + list.length) % list.length];

const BAT_HELP = [
  "BATTING: SPACE TO FACE UP, THEN S DRIVE / Q CUT-PULL / W LOFT AS IT ARRIVES",
  "A = DEFEND.  NO KEY = LEAVE.  HOLD SHIFT FOR POWER, BUT PLAY IT EARLIER",
  "ARROWS AIM.  DOWN+W RAMP, DOWN+LEFT/RIGHT+Q SWEEP.  UP/DOWN = RUN",
  "O = SIM OVER   C = CAMERA   B = BATTER/BOWLER END   ESC = MENU",
];
const BOWL_HELP = [
  "BOWLING: ARROWS SET LINE & LENGTH, NUMBERS PICK THE BALL, E EFFORT, F FIELD",
  "SPACE TO RUN IN, SPACE AGAIN IN THE GOLD ZONE OF THE METER TO RELEASE",
  "FIND EACH BATTER'S WEAKNESS. SET HIM UP, THEN CHANGE IT.  H = APPEAL  R = REVIEW",
  "V = FIELD   O = SIM OVER   C = CAMERA   B = BATTER/BOWLER END   ESC = MENU",
];

export class Menu {
  sel = 0;
  /** The last game chosen is remembered. */
  cfg = { format: "spell", mode: "bat", pitch: "green", overs: 20, classic: CLASSIC_IDS[0], ...load("menu", {}) };
  t = 0;

  constructor(game) {
    this.game = game;
    if (!FORMATS[this.cfg.format]) this.cfg.format = "spell";
    if (!CLASSIC_IDS.includes(this.cfg.classic)) this.cfg.classic = CLASSIC_IDS[0];
  }

  get classic() {
    return CLASSICS.find((c) => c.id === this.cfg.classic);
  }

  /** The menu rows for the chosen format: [key, label, value]. */
  get rows() {
    const cfg = this.cfg;
    const format = ["format", "GAME", FORMATS[cfg.format].name];
    if (cfg.format === "classic") {
      const won = load("classicsWon", {});
      const done = CLASSIC_IDS.filter((id) => won[id]).length;
      return [
        format,
        ["classic", "MATCH", `${this.classic.title}${won[cfg.classic] ? "  WON" : ""}`],
        ["start", "", `START  >     (${done}/${CLASSICS.length} WON)`],
      ];
    }
    const overs = `${cfg.overs} OVERS${cfg.overs === 90 ? " (A FULL DAY)" : cfg.format === "match" ? " EACH" : ""}`;
    return [
      format,
      ["mode", "YOU", cfg.mode === "bat" ? "BAT FIRST (AUSTRALIA)" : "BOWL FIRST (AUSTRALIA)"],
      ["pitch", "PITCH", PITCH_TYPES[cfg.pitch].name],
      ["overs", cfg.format === "match" ? "INNINGS" : "SPELL", overs],
      ["start", "", "START  >"],
    ];
  }

  update(dt) {
    this.t += dt;
    const rows = this.rows;
    if (keys.pressed("ArrowUp")) {
      this.sel = (this.sel + rows.length - 1) % rows.length;
      sfx.click();
    }
    if (keys.pressed("ArrowDown")) {
      this.sel = (this.sel + 1) % rows.length;
      sfx.click();
    }
    const dir = keys.pressed("ArrowRight") ? 1 : keys.pressed("ArrowLeft") ? -1 : 0;
    const cfg = this.cfg;
    const key = rows[this.sel][0];
    if (dir && key !== "start") {
      sfx.click();
      if (key === "format") {
        cfg.format = cycle(FORMAT_IDS, cfg.format, dir);
        const choices = OVERS_CHOICES[cfg.format];
        if (choices && !choices.includes(cfg.overs)) cfg.overs = choices[1];
      }
      if (key === "mode") cfg.mode = cycle(MODES, cfg.mode, dir);
      if (key === "pitch") cfg.pitch = cycle(PITCHES, cfg.pitch, dir);
      if (key === "overs") cfg.overs = cycle(OVERS_CHOICES[cfg.format], cfg.overs, dir);
      if (key === "classic") cfg.classic = cycle(CLASSIC_IDS, cfg.classic, dir);
    }
    if (keys.pressed("Enter") || (keys.pressed("Space") && key === "start")) {
      save("menu", cfg);
      this.game.startMatch({ ...cfg });
    }
  }

  draw() {
    ctx.drawImage(this.game.images.wide, 0, 0, WIDTH, HEIGHT);
    fillRect(0, 0, WIDTH, HEIGHT, "rgba(6,18,10,0.55)");
    const bob = Math.round(Math.sin(this.t * 2) * 2);
    drawText("CRICKET LAB", WIDTH / 2 + 3, 26 + bob + 3, { scale: 6, color: COLORS.black, align: "center", shadow: null });
    drawText("CRICKET LAB", WIDTH / 2, 26 + bob, { scale: 6, color: COLORS.gold, align: "center", outline: "#3a2a08" });
    drawText("16-BIT TEST CRICKET  -  PROTOTYPE V0.1", WIDTH / 2, 78, { align: "center", color: COLORS.cream });

    const rows = this.rows;
    if (this.sel >= rows.length) this.sel = rows.length - 1;
    drawPanel(130, 98, 380, 132);
    rows.forEach(([key, label, value], i) => {
      const y = 112 + i * 18;
      const selected = this.sel === i;
      if (selected) fillRect(138, y - 4, 364, 15, "#24563a");
      drawText(label, 150, y, { color: COLORS.dim });
      const color = selected ? COLORS.gold : COLORS.cream;
      if (key !== "start") drawText(`< ${value} >`, 210, y, { color, align: "left" });
      else drawText(value, 320, y, { color, align: "center" });
    });
    const cfg = this.cfg;
    const blurb =
      cfg.format === "classic"
        ? `${this.classic.blurb} YOU ${this.classic.human === "bat" ? "BAT" : "BOWL"}.`
        : cfg.format === "match"
          ? FORMATS.match.blurb
          : PITCH_TYPES[cfg.pitch].blurb;
    wrapText(blurb, 60).forEach((line, i) =>
      drawText(line, 320, 112 + rows.length * 18 + 4 + i * 10, { align: "center", color: COLORS.dim }),
    );

    drawPanel(40, 238, 560, 84, "#0d2318");
    const role = cfg.format === "classic" ? this.classic.human : cfg.mode;
    (role === "bat" ? BAT_HELP : BOWL_HELP).forEach((line, i) =>
      drawText(line, 320, 248 + i * 12, { align: "center", color: i === 0 ? COLORS.gold : COLORS.cream }),
    );
    drawText("ARROWS + ENTER", 320, 330, { align: "center", color: COLORS.dim });
    drawText("M = SOUND ON/OFF", 320, 342, { align: "center", color: COLORS.dim });
  }
}
