/**
 * The box's wrap-up as the scorecard comes up at the end of an innings or the match: the lead voice sums it
 * up, a second voice has the last word. Voice order: dry Bunnings, excitable Lorry, tactical Grog.
 */

const BREAK = [
  ["{team} FINISH ON {score}. {chasers} NEED {need}.", "SO, {need} TO WIN. WE'LL SEE IF THAT'S ENOUGH."],
  ["{score} FOR {team}! {chasers} NEED {need} TO WIN!", "{need} TO WIN! THIS IS SET UP BEAUTIFULLY!"],
  ["{score}. {chasers} WILL WANT A GOOD START CHASING {need}.", "{need} TO WIN. WICKETS IN HAND WILL BE THE KEY."],
];
const RESULT = [
  ["{result}. AND THAT IS THAT.", "{result}. A FAIR RESULT, I THINK."],
  ["{result}! WHAT A GAME OF CRICKET!", "{result}! THEY'LL REMEMBER THIS ONE!"],
  ["{result}. THEY EARNED IT WITH THE BALL AND THE BAT.", "{result}. THE KEY MOMENTS WENT THEIR WAY."],
];
const FINISH = [
  ["THAT'S THE END OF IT. {team} {score}.", "{team} END ON {score}."],
  ["AND THAT'S IT! {team} {score}!", "ALL DONE! {team} ON {score}!"],
  ["{team} CLOSE ON {score}. PLENTY TO TALK ABOUT THERE.", "{score} FOR {team}. A FAIR DAY'S WORK."],
];

const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? "")).toUpperCase();

/**
 * The lead voice's wrap-up line for an innings that's just ended. facts: { team, score, chasers, need,
 * result }: a break between innings when `need` is set, a result when `result` is.
 */
export function wrapUpCall(who, facts, pick) {
  const bank = facts.need ? BREAK : facts.result ? RESULT : FINISH;
  return fill(pick(bank[who]), facts);
}
