import { isSpinner } from "./teams.js";

/**
 * Short-pitched bowling (Law 41.6): more than two bouncers in an over is a no-ball and a first and final
 * warning; the next time in the innings the bowler is taken off, and another finishes the over. A bouncer,
 * for the law, is one that passes the batter above the shoulder, whatever it was meant to be.
 */

/** A ball passing the batter higher than this (m, about his shoulder) counts as a bouncer. */
export const BOUNCER_HEIGHT = 1.3;

/** The umpire's call on delivery `d` from `bowler` (marks it a no-ball, and warns or takes off the bowler). */
export function callBouncer(inn, bowler, d) {
  if (isSpinner(bowler.p.bowl) || (d.atCrease?.y ?? 0) <= BOUNCER_HEIGHT) return;
  inn.overBouncers++;
  if (inn.overBouncers <= 2) return;
  d.noBall = true;
  d.bouncerNoBall = true;
  bowler.bouncerWarnings = (bowler.bouncerWarnings ?? 0) + 1;
  d.bouncerWarning = bowler.bouncerWarnings === 1 ? "warning" : "suspended";
  if (d.bouncerWarning === "suspended") bowler.suspended = true;
}
