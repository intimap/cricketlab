/**
 * The box through an LBW decision and a DRS review, in stages: the on-field call, the review, the
 * ball-tracking, the verdict (with umpire's call explained). Reads the decision and tracking; decides
 * nothing. Voice order: dry Bunnings, excitable Lorry, tactical Grog.
 */

const ON_FIELD = {
  out: [
    ["THE FINGER GOES UP.", "GIVEN. {b} IS ON HIS WAY, UNLESS..."],
    ["THE FINGER GOES UP! HE'S GIVEN HIM!", "GIVEN OUT! LBW!"],
    ["GIVEN. THAT LOOKED TIGHT ON LINE.", "THE UMPIRE'S SURE. HE'S GIVEN IT."],
  ],
  notOut: [
    ["NOT OUT, SAYS THE UMPIRE.", "THE UMPIRE SHAKES HIS HEAD."],
    ["NOT OUT! THE BOWLER CAN'T BELIEVE IT!", "NO! HE'S NOT GIVEN IT!"],
    ["NOT OUT. PERHAPS PITCHING OUTSIDE, OR GOING OVER.", "NOT GIVEN. THE HEIGHT MAY HAVE SAVED HIM."],
  ],
};
const REVIEWING = {
  bat: [
    ["{b} IS GOING TO REVIEW. LET'S SEE.", "{b} WANTS A SECOND LOOK."],
    ["HE'S REVIEWING! {b} IS NOT HAVING THAT!", "THE BATTER REVIEWS! WAS THERE AN EDGE?"],
    ["{b} REVIEWS. HE'LL BE HOPING FOR LINE OR HEIGHT.", "A BATTER'S REVIEW. HE MUST FEEL IT WAS MISSING."],
  ],
  bowl: [
    ["THE FIELDING SIDE WILL REVIEW.", "THEY'RE GOING UPSTAIRS."],
    ["THEY'RE REVIEWING IT! THE BOWLER IS CONVINCED!", "UPSTAIRS WE GO! THE FIELDERS THINK IT'S OUT!"],
    ["THE BOWLER TALKED HIS CAPTAIN INTO THAT ONE. WE'LL SEE.", "A FIELDING REVIEW. THEY MUST THINK IT WAS HITTING."],
  ],
};
/** Ball-tracking, by its reason (sim/match.js tracking). */
const TRACKING = {
  "WICKETS: HITTING": ["PITCHING IN LINE... IMPACT IN LINE... HITTING!", "IN LINE, IN LINE... AND IT'S HITTING THE STUMPS!"],
  "WICKETS: UMPIRE'S CALL": ["IN LINE... IN LINE... CLIPPING THE STUMPS. UMPIRE'S CALL.", "IT'S JUST CLIPPING. UMPIRE'S CALL."],
  "PITCHING: OUTSIDE LEG": [
    "IT'S HITTING, BUT IT PITCHED OUTSIDE LEG. NOT OUT.",
    "HITTING THE STUMPS -- BUT PITCHED OUTSIDE LEG. HE'S SAFE.",
  ],
  "IMPACT: OUTSIDE OFF": [
    "IT'S HITTING, BUT HE WAS STRUCK OUTSIDE THE LINE PLAYING A SHOT. NOT OUT.",
    "HITTING -- BUT THE IMPACT WAS OUTSIDE OFF, AND HE PLAYED A SHOT. SAFE.",
  ],
  "WICKETS: GOING OVER": ["IN LINE... BUT IT'S GOING OVER THE TOP!", "TOO HIGH. GOING OVER THE STUMPS."],
  "WICKETS: MISSING": ["IN LINE... BUT MISSING THE STUMPS.", "IT'S SLIDING DOWN. MISSING."],
};
const VERDICT = {
  overturnedOut: [
    ["OVERTURNED. {b} HAS TO GO.", "THE DECISION IS REVERSED. OUT."],
    ["OVERTURNED! HE'S OUT! THE REVIEW WAS SPOT ON!", "THAT IS OUT! REVIEW SUCCESSFUL!"],
    ["THE TECHNOLOGY HAS FOUND IT. GOOD REVIEW.", "OUT ON REVIEW. THE BOWLER KNEW."],
  ],
  overturnedNotOut: [
    ["OVERTURNED. {b} SURVIVES.", "THE DECISION IS REVERSED. NOT OUT."],
    ["NOT OUT! HE'S SURVIVED! WHAT A REVIEW!", "OVERTURNED! {b} LIVES ON!"],
    ["A GOOD REVIEW. THE UMPIRE MISSED THE DETAIL ON THAT ONE.", "SAVED BY THE REVIEW. THAT'S WHAT IT'S FOR."],
  ],
  stands: [
    ["THE DECISION STANDS.", "NO CHANGE. THE ORIGINAL CALL STANDS."],
    ["IT STANDS! THE REVIEW IS LOST!", "REVIEW UNSUCCESSFUL!"],
    ["A WASTED REVIEW. THAT WAS ALWAYS GOING TO STAND.", "REVIEW LOST. THEY'LL REGRET THAT ONE."],
  ],
  umpiresCall: [
    ["UMPIRE'S CALL. THE DECISION STANDS, AND THEY KEEP THE REVIEW.", "UMPIRE'S CALL. NO CHANGE."],
    ["UMPIRE'S CALL! IT STAYS WITH THE ON-FIELD DECISION!", "SO CLOSE! UMPIRE'S CALL!"],
    [
      "MORE THAN HALF THE BALL HAS TO BE HITTING TO OVERTURN IT. UMPIRE'S CALL.",
      "UMPIRE'S CALL: TOO CLOSE TO OVERTURN, SO THE REVIEW IS KEPT.",
    ],
  ],
};

const fill = (text, facts) => text.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? `{${k}}`)).toUpperCase();

/** The umpire's decision as it's given. */
export const onFieldCall = (who, out, facts, pick) => fill(pick(ON_FIELD[out ? "out" : "notOut"][who]), facts);

/** A review is called for, by "bat" or "bowl". */
export const reviewCall = (who, by, facts, pick) => fill(pick(REVIEWING[by][who]), facts);

/** The ball-tracking, said as it plays. */
export const trackingCall = (reason, pick) => pick(TRACKING[reason] ?? TRACKING["WICKETS: MISSING"]);

/** The verdict: out or not after the review, against what was given on the field. */
export function verdictCall(who, { onField, out, verdict }, facts, pick) {
  const kind =
    verdict === "umpiresCall" ? "umpiresCall" : out === onField ? "stands" : out ? "overturnedOut" : "overturnedNotOut";
  return fill(pick(VERDICT[kind][who]), facts);
}
