import { PITCH_TYPES } from "../sim/conditions.js";
import { deliveryName } from "../sim/delivery.js";
import { styleName } from "../sim/teams.js";
import { PRACTICE_WORDS, PRACTICE_PITCHES, stepPractice } from "../sim/practice.js";

/**
 * Practice's choices as rows ([key, label, value]) for the practice panel (render/practice-panel.js), and
 * moving one of them. The menu's practice page shows the squad and whether you bat or bowl first; a session's
 * Esc menu shows the pitch and DONE. Bowling, the ball's rows are left out: the player bowls it.
 *
 * state: { settings (sim/practice.js), team (the squad), mode ("bat" or "bowl"), pitch (an id) }.
 */

const SIDE_WORDS = { random: "RANDOM", over: "OVER THE WICKET", around: "AROUND THE WICKET" };

export function practiceRows({ settings: s, team, mode, pitch }, where) {
  const batter = team.players[s.batter];
  const bowler = team.players[s.bowler];
  const rows = [];
  if (where === "menu") {
    rows.push(["mode", "PRACTISE", mode === "bat" ? "BATTING" : "BOWLING"]);
    rows.push(["team", "SQUAD", team.name.toUpperCase()]);
  }
  rows.push([
    "batter",
    mode === "bat" ? "YOU BAT" : "BATTER",
    `${batter.name.toUpperCase()} ${batter.hand === "left" ? "LH" : "RH"}`,
  ]);
  rows.push(["bowler", mode === "bat" ? "BOWLER" : "YOU BOWL", `${bowler.name.toUpperCase()} ${styleName(bowler.bowl)}`]);
  if (mode === "bat") {
    rows.push(["side", "SIDE", SIDE_WORDS[s.side]]);
    rows.push(["delivery", "DELIVERY", s.delivery === "random" ? "RANDOM" : deliveryName(s.delivery, bowler.bowl)]);
    rows.push(["length", "LENGTH", PRACTICE_WORDS[s.length]]);
    rows.push(["line", "LINE", PRACTICE_WORDS[s.line]]);
  }
  if (where === "session") {
    rows.push(["pitch", "PITCH", PITCH_TYPES[pitch].name]);
    rows.push(["done", "", "DONE"]);
  }
  return rows;
}

/** One of the batter, bowler and ball rows moved one way (`dir`): the new settings. */
export const stepRow = ({ settings, team }, key, dir) => stepPractice(settings, key, dir, team);

/** The next pitch one way. */
export const stepPitch = (pitch, dir) =>
  PRACTICE_PITCHES[(PRACTICE_PITCHES.indexOf(pitch) + dir + PRACTICE_PITCHES.length) % PRACTICE_PITCHES.length];

/**
 * What the ball is set to, in a line: "AROUND THE WICKET, OUTSWING, GOOD LENGTH, OUTSIDE OFF", each RANDOM
 * one said as ANY (ANY SIDE, ANY BALL...). For the practice bar and the session's opening line.
 */
export function ballWords(s, bowler) {
  const any = (v, word, what) => (v === "random" ? `ANY ${what}` : word);
  return [
    any(s.side, SIDE_WORDS[s.side], "SIDE"),
    any(s.delivery, s.delivery === "random" ? "" : deliveryName(s.delivery, bowler.bowl), "BALL"),
    any(s.length, PRACTICE_WORDS[s.length], "LENGTH"),
    any(s.line, PRACTICE_WORDS[s.line], "LINE"),
  ].join(", ");
}
