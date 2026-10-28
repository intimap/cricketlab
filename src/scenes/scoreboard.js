import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawPanel } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { keys, onKeyDown } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { load, save } from "../engine/storage.js";
import { addScore, readScores } from "../engine/scores.js";
import { NAME_MAX, NAME_CHARS, cleanName, boardFor, sortEntries, validEntry } from "../sim/leaderboard.js";
import { CLASSICS } from "../sim/formats.js";

/** Rows of the table on screen. */
const SHOWN = 12;
const ROW_H = 15;
/** Letters the arcade-style up/down cycles through. */
const CYCLE = NAME_CHARS;

/** The table's heading: "10-OVER MATCH", or the Classic Match's title. */
export function boardTitle(cfg) {
  if (cfg.format === "classic") return CLASSICS.find((c) => c.id === cfg.classic)?.title ?? "CLASSIC MATCH";
  return `${cfg.overs}-OVER MATCH`;
}

/**
 * The arcade high-score screen. After a match (`entry` given): the result,
 * then the player types a name and the score joins the table. From the menu
 * (no entry): just the table. Phases: entry, saving, loading, table.
 */
export class ScoreboardScene {
  /** cfg: the game's menu choice (which table); entry: resultEntry() of a finished match, or null. */
  constructor(game, cfg, entry = null) {
    this.game = game;
    this.cfg = cfg;
    this.board = boardFor(cfg);
    this.entry = entry;
    this.t = 0;
    this.rows = [];
    this.shared = false;
    this.mineId = null;
    this.savedShared = null;
    if (entry) {
      this.phase = "entry";
      this.name = cleanName(load("playerName", ""));
      this.openField();
    } else {
      this.phase = "loading";
      this.refresh();
    }
  }

  /** Which on-screen buttons a touch screen shows (engine/touch.js). */
  get touchMode() {
    return this.phase === "entry" ? "entry" : "menu";
  }

  /**
   * A real (invisible) text field holds the name, so a phone's own keyboard can
   * type into it; the touch KEYBOARD button focuses it inside the tap itself,
   * as phones only open their keyboard from a user gesture.
   */
  openField() {
    const field = document.createElement("input");
    field.type = "text";
    field.maxLength = NAME_MAX;
    field.autocomplete = "off";
    field.autocapitalize = "characters";
    field.spellcheck = false;
    field.setAttribute("aria-label", "Your name for the high scores");
    // 16px stops phones zooming in on focus; it sits off to the corner, unseen.
    field.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;";
    field.value = this.name;
    document.body.appendChild(field);
    this.field = field;
    this.stopListening = onKeyDown((code) => {
      if (code === "OpenKeyboard") field.focus();
    });
    // On a desktop the keyboard types straight in.
    if (!matchMedia("(pointer: coarse)").matches) field.focus({ preventScroll: true });
  }

  closeField() {
    this.stopListening?.();
    this.field?.blur();
    this.field?.remove();
    this.field = null;
  }

  get fieldFocused() {
    return !!this.field && document.activeElement === this.field;
  }

  setName(name) {
    this.name = cleanName(name);
    if (this.field && this.field.value !== this.name) this.field.value = this.name;
  }

  updateEntry() {
    // What the text field holds (typed on a keyboard, or a phone's), tidied up.
    if (this.fieldFocused) this.setName(this.field.value);
    else for (const ch of keys.typed()) this.setName(this.name + ch);
    if (!this.fieldFocused && keys.pressed("Backspace")) this.setName(this.name.slice(0, -1));
    // Arcade style: up/down change the last letter, right adds one, left takes it back.
    const dir = keys.pressed("ArrowUp") ? 1 : keys.pressed("ArrowDown") ? -1 : 0;
    if (dir) {
      // An empty name starts at A going up (or the end of the list going down).
      const at = this.name ? CYCLE.indexOf(this.name.slice(-1)) : dir > 0 ? -1 : 0;
      this.setName(this.name.slice(0, -1) + CYCLE[(at + dir + CYCLE.length) % CYCLE.length]);
      sfx.click();
    }
    if (keys.pressed("ArrowRight") && this.name.length < NAME_MAX) {
      this.setName(this.name + "A");
      sfx.click();
    }
    if (keys.pressed("ArrowLeft")) {
      this.setName(this.name.slice(0, -1));
      sfx.click();
    }
    if (this.field) this.field.setSelectionRange?.(this.name.length, this.name.length);
    if (keys.pressed("Enter")) this.submit();
    else if (keys.pressed("Escape")) {
      // Leave without a name: the score isn't kept.
      this.closeField();
      this.phase = "loading";
      this.refresh();
    }
  }

  async submit() {
    const name = this.name.trim() || "PLAYER";
    this.closeField();
    save("playerName", name);
    this.phase = "saving";
    sfx.click();
    const e = this.entry;
    const { id, shared } = await addScore({
      board: this.board,
      name,
      rank: e.rank,
      at: Date.now(),
      text: e.text,
      score: e.score,
    });
    this.mineId = id;
    this.savedShared = shared;
    await this.refresh();
  }

  async refresh() {
    const { entries, shared } = await readScores(this.board);
    this.rows = sortEntries(entries.map(validEntry).filter((e) => e && e.board === this.board));
    this.shared = shared;
    this.phase = "table";
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    if (this.phase === "entry") return this.updateEntry();
    if (this.phase !== "table" || this.t < 0.4) return;
    if (keys.pressed("Enter") || keys.pressed("Space") || keys.pressed("Escape")) {
      sfx.click();
      this.game.toMenu();
    }
  }

  draw() {
    ctx.drawImage(this.game.images.wide, 0, 0, WIDTH, HEIGHT);
    fillRect(0, 0, WIDTH, HEIGHT, "rgba(6,18,10,0.72)");
    drawText("HIGH SCORES", WIDTH / 2 + 2, 14 + 2, { scale: 4, color: COLORS.black, align: "center", shadow: null });
    drawText("HIGH SCORES", WIDTH / 2, 14, { scale: 4, color: COLORS.gold, align: "center", outline: "#3a2a08" });
    drawText(boardTitle(this.cfg), WIDTH / 2, 50, { align: "center", color: COLORS.cream });
    if (this.phase === "entry") this.drawEntry();
    else if (this.phase === "table") this.drawTable();
    else drawText(this.phase === "saving" ? "SAVING..." : "LOADING...", WIDTH / 2, 170, { align: "center", color: COLORS.dim });
  }

  drawEntry() {
    const e = this.entry;
    drawPanel(90, 70, 460, 200, "#0d2318");
    const color = e.won ? COLORS.gold : e.kind === "tie" ? COLORS.cream : COLORS.red;
    drawText(e.kind === "tie" ? "MATCH TIED" : e.won ? "YOU WON!" : "YOU LOST", WIDTH / 2, 84, {
      scale: 3,
      align: "center",
      color,
    });
    drawText(e.text, WIDTH / 2, 112, { align: "center", color: COLORS.cream });
    drawText(e.score, WIDTH / 2, 124, { align: "center", color: COLORS.dim });
    drawText("ENTER YOUR NAME", WIDTH / 2, 146, { align: "center", color: COLORS.gold });

    // One box per letter, arcade style, with a blinking cursor on the next one.
    const box = 20;
    const left = WIDTH / 2 - (NAME_MAX * box) / 2;
    for (let i = 0; i < NAME_MAX; i++) {
      const x = left + i * box;
      const cursor = i === Math.min(this.name.length, NAME_MAX - 1) && Math.floor(this.t * 3) % 2 === 0;
      fillRect(x + 2, 160, box - 4, 24, cursor ? "#24563a" : "#14301f");
      fillRect(x + 2, 182, box - 4, 2, i < this.name.length ? COLORS.gold : "#2c6b45");
      if (this.name[i]) drawText(this.name[i], x + box / 2, 165, { scale: 2, align: "center", color: COLORS.cream });
    }
    const touch = matchMedia("(pointer: coarse)").matches;
    const help = touch
      ? ["KEYBOARD = TYPE IT,  OR  UP/DOWN = LETTER  RIGHT = NEXT  LEFT = BACK", "OK = SAVE"]
      : ["TYPE YOUR NAME,  OR  UP/DOWN = LETTER  RIGHT = NEXT  LEFT = BACK", "ENTER = SAVE    ESC = DON'T SAVE"];
    help.forEach((line, i) => drawText(line, WIDTH / 2, 204 + i * 12, { align: "center", color: COLORS.dim }));
    drawText(`UP TO ${NAME_MAX} LETTERS`, WIDTH / 2, 248, { align: "center", color: COLORS.dim });
  }

  drawTable() {
    drawPanel(40, 64, 560, 258, "#0d2318");
    const cols = { rank: 76, name: 92, result: 210, score: 470 };
    const head = 74;
    drawText("#", cols.rank, head, { align: "right", color: COLORS.dim });
    drawText("NAME", cols.name, head, { color: COLORS.dim });
    drawText("RESULT", cols.result, head, { color: COLORS.dim });
    drawText("SCORE", cols.score, head, { color: COLORS.dim });

    const rows = this.rows;
    const mine = rows.findIndex((r) => r.id === this.mineId);
    // The top of the table, and the player's own row at the foot if it's further down.
    let shown = rows.slice(0, SHOWN).map((r, i) => [r, i]);
    if (mine >= SHOWN) shown = [...shown.slice(0, SHOWN - 1), [rows[mine], mine]];
    if (!rows.length) drawText("NO SCORES YET. BE THE FIRST!", WIDTH / 2, 150, { align: "center", color: COLORS.cream });
    shown.forEach(([r, i], n) => {
      const y = head + 16 + n * ROW_H;
      const me = i === mine;
      if (me) fillRect(46, y - 4, 548, ROW_H - 1, Math.floor(this.t * 3) % 2 ? "#24563a" : "#1b4630");
      const color = me ? COLORS.gold : i < 3 ? COLORS.cream : COLORS.dim;
      drawText(`${i + 1}`, cols.rank, y, { align: "right", color });
      drawText(r.name, cols.name, y, { color });
      drawText(r.text, cols.result, y, { color });
      drawText(r.score, cols.score, y, { color });
    });

    const note =
      this.savedShared === false && this.shared
        ? "YOUR SCORE IS SAVED ON THIS DEVICE ONLY (NO PERMISSION TO SHARE)"
        : this.shared
          ? "SHARED SCOREBOARD: EVERYONE PLAYING THIS GAME SEES THESE"
          : "SCORES ON THIS DEVICE ONLY";
    drawText(note, WIDTH / 2, 300, { align: "center", color: COLORS.dim });
    drawText("ENTER = MENU", WIDTH / 2, 334, { align: "center", color: COLORS.gold });
  }
}
