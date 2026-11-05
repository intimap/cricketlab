import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawPanel } from "../engine/screen.js";
import { drawText, wrapText } from "../engine/text.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { load, save } from "../engine/storage.js";
import { PITCH_TYPES } from "../sim/conditions.js";
import { FORMATS, CLASSICS, OVERS_CHOICES } from "../sim/formats.js";
import { boardFor } from "../sim/leaderboard.js";
import { GROUNDS, GROUND_CHOICES, DEFAULT_GROUND } from "../render/grounds.js";
import { prepareVenue } from "../render/venue/venue-build.js";
import { ballKindFor } from "./match-light.js";
import { LIGHTS } from "../render/light.js";
import { updateTeams, drawTeams } from "./menu-teams.js";
import { endTime } from "./match-light.js";
import { ASSISTS, ASSIST_NAMES, assistSetting } from "./assists.js";
import { EFFECTS, EFFECT_NAMES } from "../render/lighting.js";

const MODES = ["bat", "bowl"];
const PITCHES = ["green", "dust", "cracked"];
const CLASSIC_IDS = CLASSICS.map((c) => c.id);
const GROUND_IDS = GROUND_CHOICES;
const LIGHT_IDS = Object.keys(LIGHTS);

/** The overs a side in the start-up match, the one friends compete on. */
const DEFAULT_MATCH_OVERS = 10;

/** The kinds of match on offer: a Test, a one-innings-a-side match of so many overs, or a Classic. */
const MATCH_TYPES = [
  { format: "test", name: "TEST MATCH (5 DAYS)" },
  ...OVERS_CHOICES.match
    .slice()
    .reverse()
    .map((overs) => ({ format: "match", overs, name: `${overs} OVERS A SIDE` })),
  { format: "classic", name: "CLASSIC MATCHES" },
];
const typeOf = (cfg) =>
  MATCH_TYPES.find((t) => t.format === cfg.format && (t.overs === undefined || t.overs === cfg.overs)) ?? MATCH_TYPES[0];

const cycle = (list, value, dir) => list[(list.indexOf(value) + dir + list.length) % list.length];

const BAT_HELP = [
  "BATTING: ARROWS ARE THE FEET (UP = FORWARD FROM BEHIND HIM), FORWARD TWICE = CHARGE",
  "S ATTACK  A DEFEND  W LOFT  D IMPROVISE.  SHIFT POWER (HOLD OR TAP).  NO BUTTON = LEAVE",
  "LINE SETS DIRECTION, TIMING FINER OR SQUARER.  UP/DOWN AFTER THE SHOT TO RUN",
  "O = SIM OVER   B = BATTER/BOWLER END   ESC = MENU",
];
const BOWL_HELP = [
  "BOWLING: ARROWS SET LINE & LENGTH, NUMBERS PICK THE BALL, E EFFORT, F FIELD",
  "SPACE TO RUN IN, SPACE AGAIN IN THE GOLD ZONE OF THE METER TO RELEASE",
  "FIND EACH BATTER'S WEAKNESS. SET HIM UP, THEN CHANGE IT.  H = APPEAL  R = REVIEW",
  "V = FIELD   O = SIM OVER   B = BATTER/BOWLER END   ESC = MENU",
];

export class Menu {
  sel = 0;
  /** "game" (what to play), "teams" (who: scenes/menu-teams.js) or "setup" (where and when). */
  page = "game";
  /** The last game chosen is remembered, except that each visit starts on a 10-over match (see the constructor). */
  cfg = {
    format: "match",
    mode: "bat",
    team: "AUS",
    opponent: "ENG",
    pitch: "green",
    overs: DEFAULT_MATCH_OVERS,
    classic: CLASSIC_IDS[0],
    ground: DEFAULT_GROUND,
    light: LIGHT_IDS[0],
    ...load("menu", {}),
  };
  t = 0;
  /** Which on-screen buttons a touch screen shows (engine/touch.js). */
  touchMode = "menu";

  constructor(game) {
    this.game = game;
    if (!FORMATS[this.cfg.format]) this.cfg.format = "match";
    if (!CLASSIC_IDS.includes(this.cfg.classic)) this.cfg.classic = CLASSIC_IDS[0];
    if (!GROUND_IDS.includes(this.cfg.ground)) this.cfg.ground = DEFAULT_GROUND;
    if (!LIGHTS[this.cfg.light]) this.cfg.light = LIGHT_IDS[0];
    // The game opens on the 10-over match everyone's high scores are set in, with NEXT picked.
    this.cfg.format = "match";
    this.cfg.overs = DEFAULT_MATCH_OVERS;
    this.sel = this.rows.findIndex(([key]) => key === "next");
  }

  get classic() {
    return CLASSICS.find((c) => c.id === this.cfg.classic);
  }

  get practice() {
    return this.cfg.format === "nets";
  }

  /** Lighting effects: this machine's setting, kept apart from the match choices (render/lighting.js). */
  get effectsRow() {
    const setting = load("effects", "auto");
    const stepped = setting === "auto" && load("effectsAuto", "full") === "simple";
    return ["effects", "EFFECTS", `${EFFECT_NAMES[setting] ?? EFFECT_NAMES.auto}${stepped ? " (SIMPLE)" : ""}`];
  }

  /** The rows on the current page: [key, label, value]. */
  get rows() {
    const cfg = this.cfg;
    if (this.page === "teams") return [];
    if (this.page === "setup") {
      // When play starts, and (in a Test or a long game) the time it goes on to.
      const end = endTime(cfg);
      const time = `${LIGHTS[cfg.light].name}${end !== cfg.light ? ` TO ${LIGHTS[end].name}` : ""}`;
      return [
        [
          "mode",
          this.practice ? "PRACTISE" : "YOU",
          this.practice ? (cfg.mode === "bat" ? "BATTING" : "BOWLING") : cfg.mode === "bat" ? "BAT FIRST" : "BOWL FIRST",
        ],
        ["pitch", "PITCH", PITCH_TYPES[cfg.pitch].name],
        ["ground", "GROUND", GROUNDS[cfg.ground].name],
        ["light", "TIME", time],
        ["assist", "ASSIST", ASSIST_NAMES[assistSetting()]],
        this.effectsRow,
        ["start", "", "START  >"],
        ["back", "", "<  BACK"],
      ];
    }
    const play = ["play", "PLAY", this.practice ? "PRACTICE" : "A MATCH"];
    if (this.practice) return [play, ["next", "", "NEXT  >"]];
    const rows = [play, ["type", "MATCH", typeOf(cfg).name]];
    if (cfg.format === "classic") {
      const won = load("classicsWon", {});
      const done = CLASSIC_IDS.filter((id) => won[id]).length;
      rows.push(["classic", "CHALLENGE", `${this.classic.title}${won[cfg.classic] ? "  WON" : ""}`]);
      rows.push(["start", "", `START  >     (${done}/${CLASSICS.length} WON)`]);
    } else rows.push(["next", "", "NEXT  >"]);
    if (boardFor(cfg)) rows.push(["scores", "", "HIGH SCORES  >"]);
    return rows;
  }

  update(dt) {
    this.t += dt;
    // A ground built from a map draws its scenery while you choose, so the match starts straight away.
    prepareVenue(GROUNDS[this.cfg.ground], ballKindFor(this.cfg), 4, this.game.images);
    if (this.page === "teams") return updateTeams(this);
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
    if (dir && !BUTTONS.has(key)) {
      sfx.click();
      if (key === "play") cfg.format = this.practice ? "match" : "nets";
      if (key === "type") {
        const type = cycle(MATCH_TYPES, typeOf(cfg), dir);
        cfg.format = type.format;
        if (type.overs) cfg.overs = type.overs;
      }
      if (key === "mode") cfg.mode = cycle(MODES, cfg.mode, dir);
      if (key === "pitch") cfg.pitch = cycle(PITCHES, cfg.pitch, dir);
      if (key === "ground") {
        cfg.ground = cycle(GROUND_IDS, cfg.ground, dir);
        // Venue defaults apply on selection; players can still choose another pitch.
        if (GROUNDS[cfg.ground].defaultPitch) cfg.pitch = GROUNDS[cfg.ground].defaultPitch;
        // A night ground brings its own light with it (still changeable).
        if (GROUNDS[cfg.ground].light) cfg.light = GROUNDS[cfg.ground].light;
      }
      if (key === "light") cfg.light = cycle(LIGHT_IDS, cfg.light, dir);
      if (key === "assist") save("assist", cycle(ASSISTS, assistSetting(), dir));
      if (key === "effects") {
        save("effects", cycle(EFFECTS, load("effects", "auto"), dir));
        // Choosing AUTO again lets it try full effects afresh.
        save("effectsAuto", "full");
      }
      if (key === "classic") cfg.classic = cycle(CLASSIC_IDS, cfg.classic, dir);
    }
    const go = keys.pressed("Enter") || keys.pressed("Space");
    if (keys.pressed("Escape") && this.page === "setup") return this.turn("teams");
    if (!go) return;
    save("menu", cfg);
    sfx.click();
    if (key === "scores") this.game.showScores({ ...cfg });
    else if (key === "next") this.turn("teams");
    else if (key === "back") this.turn("teams");
    else if (key === "start" || keys.pressed("Enter")) this.game.startMatch({ ...cfg });
  }

  /** Go to another page, with `key`'s row picked. */
  turn(page, key) {
    this.page = page;
    this.sel = Math.max(
      0,
      this.rows.findIndex(([k]) => k === key),
    );
  }

  draw() {
    ctx.drawImage(this.game.images.wide, 0, 0, WIDTH, HEIGHT);
    fillRect(0, 0, WIDTH, HEIGHT, "rgba(6,18,10,0.55)");
    const bob = Math.round(Math.sin(this.t * 2) * 2);
    drawText("CRICKET LAB", WIDTH / 2 + 3, 26 + bob + 3, { scale: 6, color: COLORS.black, align: "center", shadow: null });
    drawText("CRICKET LAB", WIDTH / 2, 26 + bob, { scale: 6, color: COLORS.gold, align: "center", outline: "#3a2a08" });
    const cfg = this.cfg;
    const what = this.practice ? "PRACTICE" : typeOf(cfg).name;
    const heading =
      { teams: `${what}: CHOOSE THE TEAMS`, setup: `${what}: WHERE AND WHEN` }[this.page] ??
      "16-BIT TEST CRICKET  -  PROTOTYPE V0.1";
    drawText(heading, WIDTH / 2, 78, { align: "center", color: COLORS.cream });
    if (this.page === "teams") return drawTeams(this);

    const rows = this.rows;
    if (this.sel >= rows.length) this.sel = rows.length - 1;
    drawPanel(130, 98, 380, 132);
    // Rows close up a little when there are more of them.
    const step = rows.length > 7 ? 12 : rows.length > 6 ? 14 : 16;
    rows.forEach(([key, label, value], i) => {
      const y = 110 + i * step;
      const selected = this.sel === i;
      if (selected) fillRect(138, y - 4, 364, step - 1, "#24563a");
      drawText(label, 150, y, { color: COLORS.dim });
      const color = selected ? COLORS.gold : COLORS.cream;
      if (!BUTTONS.has(key)) drawText(`< ${value} >`, 210, y, { color, align: "left" });
      else drawText(value, 320, y, { color, align: "center" });
    });
    const blurb =
      this.page === "setup"
        ? PITCH_TYPES[cfg.pitch].blurb
        : cfg.format === "classic"
          ? `${this.classic.blurb} YOU ${this.classic.human === "bat" ? "BAT" : "BOWL"}.`
          : FORMATS[cfg.format].blurb;
    wrapText(blurb, 60).forEach((line, i) =>
      drawText(line, 320, 110 + rows.length * step + 4 + i * 10, { align: "center", color: COLORS.dim }),
    );

    drawPanel(40, 238, 560, 84, "#0d2318");
    const role = cfg.format === "classic" ? this.classic.human : cfg.mode;
    const help = [...(role === "bat" ? BAT_HELP : BOWL_HELP)];
    if (cfg.format === "test")
      help.push(role === "bat" ? "TEST: L = SIM TO THE BREAK   C TWICE = DECLARE" : "TEST: L = SIM TO THE BREAK");
    help.forEach((line, i) =>
      drawText(line, 320, 248 + i * 12, { align: "center", color: i === 0 ? COLORS.gold : COLORS.cream }),
    );
    drawText(this.page === "setup" ? "ARROWS + ENTER   ESC = BACK" : "ARROWS + ENTER", 320, 330, {
      align: "center",
      color: COLORS.dim,
    });
    drawText("M = SOUND ON/OFF", 320, 342, { align: "center", color: COLORS.dim });
  }
}

/** Rows that are pressed rather than changed with left and right. */
const BUTTONS = new Set(["next", "start", "back", "scores"]);
