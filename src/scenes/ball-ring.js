import { movementOf, lengthName } from "../sim/delivery.js";
import { isSpinner } from "../sim/teams.js";
import { ASSIST } from "./assists.js";

/**
 * The ring round the ball in flight (render/ball-ring.js): its colour is the length, its side which way the
 * ball will move, as it'll look on screen. Batting, it is the batter's read: it appears once he's read it
 * (earlier for a better batter with his eye in) and shows what he thinks, so a googly or slower ball he hasn't
 * picked shows the decoy. Bowling, it is the truth, from release. Worked out once per ball, at release.
 * The assist level (EASY, NORMAL, HARD) changes this: EASY shows the truth from release when batting too,
 * HARD shows nothing when batting.
 */

/** Movement smaller than this (m) is shown as straight on: a ring both sides, dimmer. */
const STRAIGHT = 0.05;

const LENGTH_COLOURS = {
  "full toss": "purple",
  yorker: "purple",
  full: "green",
  "good length": "gold",
  "back of a length": "red",
  short: "red",
};

/** The ring for this ball, or null for none: { length (colour key), side (-1, 0 or +1 on screen), showAt, hideAt }. */
export function ballRing(scene, d) {
  const shows = (ASSIST[scene.assist] ?? ASSIST.normal).ring;
  const batting = scene.human === "bat";
  if (batting && shows === "none") return null;
  const spinner = isSpinner(scene.inn.bowler.p.bowl);
  const pitchZ = d.pitchedAt?.z ?? 0;
  const tAir = Math.max(0.05, (d.release.z - pitchZ) / d.speed);
  const tAfter = pitchZ / Math.max(1, d.speed * d.paceKept);
  let move;
  let showAt = 0.04;
  if (batting && shows === "read") {
    // What he reads: the swing he expects, and the turn he expects (the decoy's if he hasn't picked it).
    move = 0.5 * d.expectedSwingAcc * tAir * tAir + d.expectedSpinKick * tAfter;
    const striker = scene.inn.bat[scene.inn.striker];
    const skill = spinner ? striker.p.bat.vsSpin : striker.p.bat.vsPace;
    // He picks it up a share of the way to the pitch: half way at worst, a tenth with his eye in.
    showAt = tAir * Math.max(0.1, 0.5 - 0.25 * (striker.eye ?? 0) - 0.2 * (skill - 0.5));
  } else {
    const m = movementOf(d);
    move = m.swing + m.offPitch;
  }
  const side = Math.abs(move) < STRAIGHT ? 0 : Math.sign(move) * scene.screenTurn;
  return { length: LENGTH_COLOURS[lengthName(pitchZ, spinner)] ?? "gold", side, showAt, hideAt: tAir + 0.12 };
}
