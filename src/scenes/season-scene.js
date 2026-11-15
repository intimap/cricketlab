import { WIDTH, HEIGHT, COLORS, ctx, fillRect, drawPanel } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";
import { MENU_PAD } from "../engine/gamepad.js";
import { drawDisplayText } from "../render/display-font.js";
import { CLUB_NAMES } from "../sim/season-clubs.js";
import {
  ladder,
  leaders,
  roundName,
  playerFixture,
  battingFirst,
  simFixture,
  simRest,
  recordResult,
  currentFixtures,
  FINALISTS,
} from "../sim/season.js";
import { saveSeason } from "./season-store.js";

/**
 * The season's own screen, between matches: the ladder, the round and the player's next match (play it, or
 * sim it), the last round's results, the season's leading players, and at the end the champions. The season
 * (sim/season.js) is saved after every change (scenes/season-store.js).
 */

const name = (club) => CLUB_NAMES[club] ?? club;
const short = (club) => name(club).split(" ").slice(0, -1).join(" ") || club;

export class SeasonScene {
  touchMode = "menu";
  padBinding = MENU_PAD;
  /** "hub", "results" or "stats". */
  page = "hub";
  sel = 0;
  t = 0;

  constructor(game, season) {
    this.game = game;
    this.season = season;
    // A match quit part-way through counts as simulated.
    const mine = playerFixture(season);
    if (season.inProgress && mine?.id === season.inProgress) {
      recordResult(season, simFixture(season, mine));
      season.inProgress = null;
    }
    this.settle();
  }

  /** Out of it (not in this round's finals): the rest is played out until it's the player's turn again or it's over. */
  settle() {
    const s = this.season;
    for (let i = 0; i < 4 && !s.champion && !playerFixture(s) && currentFixtures(s).length; i++) simRest(s);
    saveSeason(s);
  }

  /** The hub's buttons, as [key, label]. */
  get buttons() {
    const s = this.season;
    if (s.champion)
      return [
        ["results", "LAST RESULTS"],
        ["stats", "SEASON STATS"],
        ["menu", "MENU"],
      ];
    return [
      ["play", "PLAY MATCH"],
      ["sim", "SIM MATCH"],
      ["results", "LAST RESULTS"],
      ["stats", "SEASON STATS"],
      ["menu", "MENU"],
    ];
  }

  update(dt) {
    this.t += dt;
    if (this.page !== "hub") {
      if (keys.pressed("Escape") || keys.pressed("Enter") || keys.pressed("Space") || keys.pressed("Backspace")) {
        this.page = "hub";
        sfx.click();
      }
      return;
    }
    const buttons = this.buttons;
    if (keys.pressed("ArrowUp")) this.sel = (this.sel + buttons.length - 1) % buttons.length;
    if (keys.pressed("ArrowDown")) this.sel = (this.sel + 1) % buttons.length;
    this.sel = Math.min(this.sel, buttons.length - 1);
    if (keys.pressed("Escape")) return this.game.toMenu();
    if (!keys.pressed("Enter") && !keys.pressed("Space")) return;
    sfx.click();
    const key = buttons[this.sel][0];
    if (key === "menu") return this.game.toMenu();
    if (key === "results" || key === "stats") return (this.page = key);
    const fixture = playerFixture(this.season);
    if (!fixture) return;
    if (key === "sim") {
      simRest(this.season);
      recordResult(this.season, simFixture(this.season, fixture));
      this.settle();
      return;
    }
    // Play it: saved as under way, so quitting part-way counts as simulated.
    this.season.inProgress = fixture.id;
    saveSeason(this.season);
    this.game.startSeasonMatch(this.season, fixture);
  }

  draw() {
    ctx.drawImage(this.game.images.wide, 0, 0, WIDTH, HEIGHT);
    fillRect(0, 0, WIDTH, HEIGHT, "rgba(6,18,10,0.7)");
    drawDisplayText("SEASON", WIDTH / 2, 8, { scale: 4, palette: "title", align: "center" });
    if (this.page === "results") return this.drawResults();
    if (this.page === "stats") return this.drawStats();
    this.drawLadder(20, 62);
    this.drawNext(340, 62);
  }

  drawLadder(x, y) {
    const s = this.season;
    drawPanel(x, y, 300, 186, "#0d2318");
    const title =
      s.round === 0 ? "THE LADDER" : s.round <= s.rounds.length ? `LADDER AFTER ${roundName(s, s.round - 1)}` : "FINAL LADDER";
    drawText(title, x + 150, y + 7, { align: "center", color: COLORS.gold });
    const cols = { club: x + 26, p: x + 188, w: x + 210, l: x + 232, pts: x + 258, nrr: x + 292 };
    const head = y + 22;
    for (const [k, label] of Object.entries({ p: "P", w: "W", l: "L", pts: "PTS", nrr: "NRR" }))
      drawText(label, cols[k], head, { align: "right", color: COLORS.dim });
    ladder(s).forEach((r, i) => {
      const ry = head + 14 + i * 18;
      if (r.club === s.club) fillRect(x + 6, ry - 4, 288, 16, "#24563a");
      if (i === FINALISTS - 1) fillRect(x + 8, ry + 13, 284, 1, "#2c6b45");
      const color = r.club === s.club ? COLORS.gold : COLORS.cream;
      drawText(String(i + 1), x + 16, ry, { align: "right", color: COLORS.dim });
      drawText(short(r.club), cols.club, ry, { color });
      drawText(String(r.p), cols.p, ry, { align: "right", color });
      drawText(String(r.w), cols.w, ry, { align: "right", color });
      drawText(String(r.l), cols.l, ry, { align: "right", color });
      drawText(String(r.pts), cols.pts, ry, { align: "right", color });
      drawText((r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(2), cols.nrr, ry, { align: "right", color: COLORS.dim });
    });
    drawText(`TOP ${FINALISTS} PLAY THE FINALS`, x + 150, y + 176, { align: "center", color: COLORS.dim });
  }

  drawNext(x, y) {
    const s = this.season;
    drawPanel(x, y, 280, 186, "#0d2318");
    drawText(`YOU: ${name(s.club)}`, x + 140, y + 7, { align: "center", color: COLORS.gold });
    const fixture = playerFixture(s);
    let line = y + 26;
    if (s.champion) {
      drawText("CHAMPIONS", x + 140, line, { align: "center", color: COLORS.dim });
      drawText(name(s.champion), x + 140, line + 14, {
        align: "center",
        color: s.champion === s.club ? COLORS.gold : COLORS.cream,
      });
      drawText(s.champion === s.club ? "WHAT A SEASON!" : "THERE'S ALWAYS NEXT SEASON", x + 140, line + 30, {
        align: "center",
        color: COLORS.cream,
      });
    } else if (fixture) {
      drawText(roundName(s), x + 140, line, { align: "center", color: COLORS.cream });
      const home = fixture.home === s.club;
      drawText(`${short(fixture.home)} V ${short(fixture.away)}`, x + 140, line + 14, { align: "center", color: COLORS.white });
      const bats = battingFirst(s, fixture) === s.club;
      drawText(`${home ? "AT HOME" : "AWAY"}  -  YOU ${bats ? "BAT" : "BOWL"} FIRST (20 OVERS)`, x + 140, line + 28, {
        align: "center",
        color: COLORS.dim,
      });
    }
    const top = y + 90;
    this.buttons.forEach(([, label], i) => {
      const by = top + i * 18;
      const selected = i === this.sel;
      if (selected) fillRect(x + 20, by - 4, 240, 15, "#24563a");
      drawText(label, x + 140, by, { align: "center", color: selected ? COLORS.gold : COLORS.cream });
    });
    drawText("ARROWS + ENTER   ESC = MENU", WIDTH / 2, 262, { align: "center", color: COLORS.dim });
  }

  /** The last round played: each match, its scores and its best players. */
  drawResults() {
    const s = this.season;
    const all = [...s.rounds, ...s.finals];
    const last = [...all].reverse().find((round) => round.every((f) => s.results[f.id]));
    drawPanel(20, 62, 600, 200, "#0d2318");
    if (!last) {
      drawText("NO RESULTS YET", WIDTH / 2, 150, { align: "center", color: COLORS.dim });
      return this.drawBack();
    }
    drawText(roundName(s, last[0].round), WIDTH / 2, 69, { align: "center", color: COLORS.gold });
    last.forEach((f, i) => {
      const r = s.results[f.id];
      const y = 88 + i * 42;
      const score = (t) => `${short(t.club)} ${t.runs}/${t.wkts}`;
      const mine = f.home === s.club || f.away === s.club;
      drawText(`${score(r.totals[0])}   ${score(r.totals[1])}`, WIDTH / 2, y, {
        align: "center",
        color: mine ? COLORS.gold : COLORS.white,
      });
      drawText(r.text.toUpperCase(), WIDTH / 2, y + 11, { align: "center", color: COLORS.cream });
      const bat = r.top?.bat ? `${r.top.bat.name.toUpperCase()} ${r.top.bat.runs}${r.top.bat.out ? "" : "*"}` : "";
      const bowl = r.top?.bowl ? `${r.top.bowl.name.toUpperCase()} ${r.top.bowl.wkts}/${r.top.bowl.runs}` : "";
      drawText(`${bat}    ${bowl}`, WIDTH / 2, y + 22, { align: "center", color: COLORS.dim });
    });
    this.drawBack();
  }

  /** The season's top five run-scorers and wicket-takers. */
  drawStats() {
    const { bat, bowl } = leaders(this.season);
    drawPanel(20, 62, 600, 200, "#0d2318");
    drawText("MOST RUNS", 170, 72, { align: "center", color: COLORS.gold });
    drawText("MOST WICKETS", 470, 72, { align: "center", color: COLORS.gold });
    const row = (i) => 92 + i * 30;
    bat.forEach((b, i) => {
      drawText(`${i + 1}. ${b.name.toUpperCase()}`, 34, row(i), { color: COLORS.cream });
      drawText(String(b.runs), 306, row(i), { align: "right", color: COLORS.white });
      const avg = b.outs ? (b.runs / b.outs).toFixed(1) : "-";
      drawText(`${short(b.club)}   HS ${b.best}   AVE ${avg}`, 48, row(i) + 11, { color: COLORS.dim });
    });
    bowl.forEach((b, i) => {
      drawText(`${i + 1}. ${b.name.toUpperCase()}`, 334, row(i), { color: COLORS.cream });
      drawText(String(b.wkts), 606, row(i), { align: "right", color: COLORS.white });
      const econ = b.balls ? ((b.runs * 6) / b.balls).toFixed(2) : "-";
      drawText(`${short(b.club)}   ECON ${econ}`, 348, row(i) + 11, { color: COLORS.dim });
    });
    if (!bat.length) drawText("NO MATCHES PLAYED YET", WIDTH / 2, 150, { align: "center", color: COLORS.dim });
    this.drawBack();
  }

  drawBack() {
    drawText("ENTER / ESC = BACK", WIDTH / 2, 270, { align: "center", color: COLORS.dim });
  }
}
