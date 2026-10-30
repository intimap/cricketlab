import { COLORS } from "../engine/screen.js";
import { keys } from "../engine/input.js";
import { sfx } from "../engine/audio.js";

/**
 * LBW appeals, the umpire's decision and DRS reviews for the match scene. Each takes the scene
 * (scenes/match.js), whose methods of the same names call these.
 */

/** Seconds the player has to review a decision that went against them. */
const REVIEW_WINDOW = 10;

/** The player shouts. Appealing when there's nothing in it irritates the umpire. */
export function appeal(scene) {
  const cur = scene.cur;
  if (!cur?.play || !cur.contactDone || cur.appealed) return;
  cur.appealed = true;
  sfx.appeal();
  scene.banner("HOWZAT?", COLORS.cream, 0.9, 3, 60);
  const res = cur.play.res;
  if (!res.padHit || res.touchedBat) {
    scene.inn.irritation += 0.6;
    scene.flash("THE UMPIRE IS UNMOVED");
  }
}

export function decideLbw(scene) {
  const cur = scene.cur;
  if (!cur.appealed) {
    scene.completeBall();
    return;
  }
  const res = cur.play.res;
  const out = scene.match.umpireLbw(cur.play);
  if (scene.human === "bowl" && !res.lbw && res.lbwNote !== "umpire's call, not out") scene.inn.irritation += 1;
  cur.onField = out;
  scene.banner(out ? "THE FINGER GOES UP" : "NOT OUT", out ? COLORS.red : COLORS.cream, 1.6, 3, 60);
  if (out) sfx.cheer(0.8);
  else sfx.groan();
  scene.setPhase("decision");
}

/** The side that lost the decision may review it: the player by pressing R, the computer if it smells a mistake. */
export function updateDecision(scene) {
  const cur = scene.cur;
  const inn = scene.inn;
  const loser = cur.onField ? "bat" : "bowl";
  const playerSide = scene.human === "bowl" ? "bowl" : "bat";
  if (loser === playerSide && inn.reviews[loser] > 0) {
    // Play stops while the player decides; a moment's grace so a stray press doesn't accept it.
    if (keys.pressed("KeyR")) scene.startReview(loser);
    else if (scene.phaseT > REVIEW_WINDOW || (scene.phaseT > 0.4 && (keys.pressed("Space") || keys.pressed("Enter"))))
      scene.endDecision();
  } else if (loser === playerSide) {
    if (scene.phaseT > 2.8 || keys.pressed("Space")) scene.endDecision();
  } else if (scene.phaseT > 1) {
    const t = scene.match.tracking(cur.play);
    const wrong = cur.onField ? t.verdict === "notOut" : t.verdict === "out";
    if (inn.reviews[loser] > 0 && scene.match.rng.chance(wrong ? 0.65 : 0.1)) scene.startReview(loser);
    else scene.endDecision();
  }
}

/** Seconds left to review, while the player can. */
export function reviewTimeLeft(scene) {
  return Math.max(0, REVIEW_WINDOW - scene.phaseT);
}

export function startReview(scene, side) {
  const cur = scene.cur;
  cur.reviewBy = side;
  cur.tracking = scene.match.tracking(cur.play);
  scene.big("REVIEW", COLORS.gold, side === "bat" ? "THE BATTER REVIEWS" : "THE FIELDING SIDE REVIEWS", 1.2);
  scene.setPhase("review");
}

export function endReview(scene) {
  const cur = scene.cur;
  const t = cur.tracking;
  let out = cur.onField;
  if (t.verdict === "out") out = true;
  else if (t.verdict === "notOut") out = false;
  const won = cur.reviewBy === "bat" ? !out : out;
  // Umpire's call: the on-field decision stands and the review is kept.
  if (!won && t.verdict !== "umpiresCall") scene.inn.reviews[cur.reviewBy]--;
  const sub = out !== cur.onField ? "DECISION OVERTURNED" : t.verdict === "umpiresCall" ? "UMPIRE'S CALL" : "REVIEW LOST";
  cur.onField = out;
  scene.big(out ? "OUT" : "NOT OUT", out ? COLORS.red : COLORS.cream, sub, 1.6);
  scene.endDecision();
}

export function endDecision(scene) {
  if (scene.cur.onField) scene.match.giveLbw(scene.cur.play);
  scene.completeBall();
}
