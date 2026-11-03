/**
 * Reading a computer batter's hidden weakness (sim/plans.js) from how he plays it. A ball aimed squarely at
 * it that gets him in trouble (beaten, edged, out, a shout for LBW) is a clue: the first gets a hint from the
 * box, the second gives it away, and it's tagged on screen from then on. Read from the ball; no dice.
 */

/** How the box and the screen name each weakness (tags fit the batter's panel: 17 characters at most). */
export const WEAKNESS_NAMES = {
  offStump: { tag: "LOOSE OUTSIDE OFF", how: "OUTSIDE OFF STUMP" },
  hook: { tag: "CAN'T RESIST HOOK", how: "GOING FOR THE HOOK" },
  bouncer: { tag: "HATES SHORT BALL", how: "AGAINST THE SHORT BALL" },
  earlySpin: { tag: "SHAKY VS SPIN", how: "AGAINST THE SPINNER" },
  inswingYorker: { tag: "LATE ON INSWINGER", how: "TO THE FULL INSWINGER" },
};

/** A ball must go at the weakness this squarely (0..1, plans.js exploits) to count as a clue. */
const AT_IT = 0.6;

/** After ball `rec`: a hint, the weakness given away, or null. Counts the striker's clues as it goes. */
export function scout(inn, rec) {
  if ((rec.battle?.weak ?? 0) < AT_IT) return null;
  const troubled =
    rec.wicket?.batter === rec.striker || rec.beatBat || /edge|gloved/i.test(rec.contact ?? "") || !!rec.padVerdict;
  const batter = inn.bat[rec.striker];
  if (!troubled || !batter?.p.weakness || batter.weaknessShown) return null;
  batter.clues = (batter.clues ?? 0) + 1;
  const names = WEAKNESS_NAMES[batter.p.weakness];
  if (!names) return null;
  if (batter.clues === 1) return { kind: "weaknessHint", how: names.how };
  batter.weaknessShown = true;
  return { kind: "weaknessShown", how: names.how, tag: names.tag };
}
