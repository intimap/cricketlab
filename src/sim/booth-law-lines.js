/**
 * The box on the umpire's warnings for too many bouncers (Law 41.6): the first and final warning, then the
 * bowler taken off for the innings. Voice order, as in the other banks: dry Bunnings, excitable Lorry,
 * tactical Grog.
 */

const WARNING = [
  [
    "THIRD BOUNCER OF THE OVER. NO BALL, AND A FIRST AND FINAL WARNING FOR {w}.",
    "THE UMPIRE HAS HAD A WORD. ONE MORE OF THOSE AND HE'S OFF.",
  ],
  ["THAT'S TOO MANY! NO BALL! FINAL WARNING FOR {w}!", "{w} HAS BEEN WARNED! HE'S PLAYING WITH FIRE!"],
  [
    "TWO BOUNCERS AN OVER IS THE LIMIT. {w} IS ON A FINAL WARNING FOR THE INNINGS.",
    "A WARNING FOR {w}. HE'LL HAVE TO PITCH IT UP NOW.",
  ],
];
const SUSPENDED = [
  ["THAT'S IT. {w} IS TAKEN OFF FOR THE REST OF THE INNINGS.", "HE WAS WARNED. NOW HE'S DONE FOR THE INNINGS."],
  ["HE'S BEEN TAKEN OFF! {w} CAN'T BOWL AGAIN TODAY!", "UNBELIEVABLE! TAKEN OFF FOR BOUNCERS!"],
  ["{w} IS OFF FOR THE INNINGS. SOMEONE ELSE HAS TO FINISH THE OVER.", "THAT'S A BOWLER DOWN. THE CAPTAIN WON'T BE HAPPY."],
];

const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? "")).toUpperCase();

/** The voice's call on the umpire's word ("warning" or "suspended") to bowler `w`. */
export function warningCall(who, kind, facts, pick) {
  return fill(pick((kind === "suspended" ? SUSPENDED : WARNING)[who]), facts);
}
