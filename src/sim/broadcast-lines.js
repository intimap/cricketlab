// Voice order throughout: observant Bunnings, excitable Lorry, analytical Grog.
export const LINES = {
  leaveWide: [
    ["Shoulders arms outside off. Discipline from {b}.", "{b} leaves the width alone. No need to chase it."],
    ["Not tempted! {b} makes the bowler come straighter!", "Arms up! {b} won't give away an edge out there!"],
    ["{b} leaves the width. Make the bowler change the line.", "A disciplined leave. That width belongs to the keeper."],
  ],
  leaveClose: [
    ["Fourth-stump corridor. {b} shoulders arms. Good judgement.", "Close to off, but {b} trusts the leave."],
    ["Arms raised in the corridor! {b} holds his nerve!", "No invitation accepted! {b} leaves outside off!"],
    [
      "That corridor tests judgement. {b} keeps the bat inside it.",
      "{b} leaves fourth stump. The bowler must attack the stumps.",
    ],
  ],
  leaveLength: [
    ["{b} trusts the length and lets it pass. Quite composed."],
    ["Judged on length! {b} lets that one go through!"],
    ["{b} leaves on length. No need to follow the bounce."],
  ],
  defendPressure: {
    4: [
      ["{b}: {dots} dots faced in a row. A patient examination."],
      ["{dots} dots now for {b}! Nothing loose to work with!"],
      ["{dots} scoreless deliveries faced by {b}. The bowler is closing the options."],
    ],
    8: [
      ["{b} has faced {dots} dots in succession. Every run must be earned."],
      ["{dots} dots to {b}! The pressure is building with every ball!"],
      ["{b}: {dots} consecutive dots faced. He needs a single to break the hold."],
    ],
    12: [
      ["{b} has faced {dots} dots now. The bowler is making him work for every inch."],
      ["{dots} scoreless balls faced by {b}! Something has to give!"],
      ["{dots} dots faced by {b}. The bowler is narrowing his scoring options."],
    ],
  },
};

export const COLOUR_LINES = {
  lowBounce: [
    ["That kept low. Something else for the batter to consider."],
    ["That stayed down! Watch the bounce on this surface!"],
    ["Low bounce on a wearing surface. The straight ball remains a threat."],
  ],
  extraBounce: [
    ["A little extra lift there. Worth noting."],
    ["That climbed! There's still life in this pitch!"],
    ["Extra bounce on that delivery. The batter must allow for it."],
  ],
  unevenBounce: [
    ["We've seen one keep low and another climb. Not entirely predictable."],
    ["Low, then high! This surface is asking awkward questions!"],
    ["Low bounce and extra lift in this innings. The cracks complicate the length."],
  ],
  wideningCracks: [
    ["The cracks are opening as this pitch wears. Patience will matter."],
    ["Look at that worn surface! Every ball could bring a chance!"],
    ["Those widening cracks give the spinner another problem to pose."],
  ],
  afternoon: [
    ["Afternoon light, lengthening shadows. A fine setting for the contest."],
    ["Lovely afternoon light! Now, who makes the most of it?"],
    ["Long afternoon shadows across the ground. Keep watching the length."],
  ],
  evening: [
    ["The evening shadows stretch across the ground. A lovely light."],
    ["Evening light now! Still plenty of cricket in this contest!"],
    ["Long shadows in this evening light. Concentration still matters."],
  ],
};
