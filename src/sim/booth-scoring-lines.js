/** Authored ball calls, in Bunnings / Lorry / Grog order. Placeholders are factual, not invented detail. */
export const BOOTH_SCORING_LINES = {
  single: [
    [
      "{b}'s {shot} brings a single. Quietly useful.",
      "A single to {b}. The small change counts.",
      "One more. The score moves without much ceremony.",
    ],
    [
      "They're through for one! Keep that board moving!",
      "{shot}, {where}! They've got a single!",
      "One added! That's another little job done!",
    ],
    [
      "{b} plays a {shot} for one. Useful work without a big risk.",
      "One to {b}. Not every scoring ball needs a big stroke.",
      "They take one. That keeps the innings moving without a boundary.",
    ],
  ],
  two: [
    [
      "{shot} from {b}, and they get back for two.",
      "They come back with a pair. Nicely accounted for.",
      "Two more. A little more value from that stroke.",
    ],
    [
      "They've got two! That's busy cricket!",
      "{where}! They're back for the second! Two more!",
      "A pair! They've made that ball count!",
    ],
    [
      "Two runs. That's good value without needing the rope.",
      "A pair for {b}. More useful than settling for the single.",
      "Two added. The running has made a contribution there.",
    ],
  ],
  three: [
    [
      "{b} plays a {shot}. They have worked three from it.",
      "They collect three. A substantial amount of running.",
      "Three more. The batters have been kept occupied.",
    ],
    [
      "Three! They've worked for every one of those!",
      "They're back for a third! That's properly busy!",
      "Three runs to {b}! Look at the effort in that!",
    ],
    [
      "Three runs. That's a valuable return without a boundary.",
      "They make three. The running has squeezed more from the stroke.",
      "A three. Useful work between the wickets.",
    ],
  ],
  runs: [
    [
      "{n} added to the total. A productive delivery for the batting side.",
      "The score moves by {n}. That is the return from this ball.",
      "{n} more. The scorebook has some work to do.",
    ],
    [
      "{n} added! The batting side have made that ball pay!",
      "They've collected {n}! That gets the board moving!",
      "It's {n} more! A busy delivery for the scorers!",
    ],
    [
      "{n} from the ball. The batting side have got value out of it.",
      "The total rises by {n}. The bowler has to reset now.",
      "They add {n}. That's a useful return from one delivery.",
    ],
  ],
  edgeRuns: [
    [
      "A {contact} brings {n}. The bat's intentions are not recorded.",
      "{n} off an edge. A useful accident for {b}.",
      "Not quite the intended contact, but {n} go into the book.",
    ],
    [
      "Off the edge, and {n} added! He'll take those!",
      "A {contact}! It's brought {b} {n}!",
      "He hasn't middled it, but he's got {n}!",
    ],
    [
      "{n} off the edge. That result flatters the contact.",
      "An edge brings {n}. I wouldn't call that a controlled scoring shot.",
      "The edge supplies {n}. The bowler hasn't got the reward he wanted.",
    ],
  ],
  offCentreRuns: [
    [
      "The {part} supplies {n}. Not the purest route into the scorebook.",
      "{n} from contact on the {part}. Useful, if imperfect.",
      "Off the {part}, and {n} are added.",
    ],
    [
      "Off the {part}, but they've got {n}!",
      "He's found {n} despite catching it on the {part}!",
      "The {part} takes it! And it still brings {n}!",
    ],
    [
      "{n} from the {part}. Better contact could have given that stroke more pace.",
      "Off the {part} for {n}. The bat's sweet spot hasn't done the work.",
      "{b} gets {n}, but the connection on the {part} costs him power.",
    ],
  ],
  four: [
    [
      "A {shot} from {b}, and it reaches the rope. Four.",
      "The ball reaches the rope. Four rather useful runs.",
      "Four more. {b} has given the scoreboard a small lift.",
    ],
    [
      "Four! That's what {b} was looking for!",
      "{where}! To the rope! Four more to {b}!",
      "He's got his boundary! Four added!",
    ],
    [
      "Four to {b}. The bowler has conceded a scoring ball.",
      "It reaches the boundary. That's a ball the bowler will review.",
      "{shot}, {where}, for four. I'd be thinking about denying that scoring option.",
    ],
  ],
  six: [
    [
      "{b}'s {shot} clears the rope. The ground has proved a little small.",
      "Beyond the rope without a bounce. Six to {b}.",
      "Six more. That is one way to move the calculation along.",
    ],
    [
      "Six! {b} has cleared the boundary!",
      "All the way! Six more to {b}!",
      "He's sent it over the rope! That's six!",
    ],
    [
      "Six. {b} has taken the aerial option and made it pay.",
      "Cleared for six. The bowler must find a different answer.",
      "Six to {b}. That's an expensive result from one delivery.",
    ],
  ],
  edgeBoundary: [
    [
      "A {contact}, and {boundary}. Fortune has made its contribution.",
      "An edge reaches the boundary for {boundary}. The bowler may need a moment.",
      "{boundary} to {b}. Not all boundaries follow the intended route.",
    ],
    [
      "An edge, and it's gone for {boundary}! He'll take every one!",
      "Off the edge for {boundary}! The bowler can't believe the return!",
      "It's reached the boundary off the edge! {boundary} more!",
    ],
    [
      "An edge for {boundary}. The result is better than the contact.",
      "{boundary} from an edge. I wouldn't discard a plan just because of that.",
      "The edge brings a boundary. {boundary} is the cost of that escape.",
    ],
  ],
  drop: [
    [
      "The chance goes down. {b} survives. {result}.",
      "{b} has been given another opportunity. {result}.",
      "A catch not completed. The batter remains. {result}.",
    ],
    [
      "He's put it down! {b} survives! {result}!",
      "A chance has gone begging! {result}!",
      "They've let {b} off! {result}!",
    ],
    [
      "A missed catch. {b} stays, and the ball brings {result}.",
      "The chance wasn't held. {result}. I'd stick to the plan that made it.",
      "{b} survives a chance. {result}. That is an opening wasted.",
    ],
  ],
  byes: [
    [
      "Byes, {n} of them. A contribution without the bat.",
      "{n} byes go into the extras column.",
      "{n} added as byes. {b}'s own account is unchanged.",
    ],
    [
      "Byes! {n} more to the total!",
      "They've got {n} byes! Extras doing the scoring!",
      "It's byes, {n} of them! Nothing off the bat!",
    ],
    [
      "{n} byes. No bat runs, but the team still benefits.",
      "Byes add {n}. Those runs matter to the total all the same.",
      "{n} in byes. That's a delivery without bat runs, but not without cost.",
    ],
  ],
  legByes: [
    [
      "{n} in leg-byes. The pad has made a contribution.",
      "Leg-byes supply {n}. Not an entry in {b}'s own account.",
      "{n} leg-byes. The team benefits, if the bat does not.",
    ],
    [
      "Leg-byes! {n} added to the total!",
      "Off the body, and {n} in leg-byes!",
      "They've collected {n} leg-byes! Every one counts!",
    ],
    [
      "{n} leg-byes. No runs to the bat, but the total moves.",
      "Leg-byes, {n}. The batting side still gets a return.",
      "{n} from the body. Those leg-byes all count in the equation.",
    ],
  ],
  wide: [
    [
      "Called wide. The ball costs {n}, and does not use a legal delivery.",
      "A wide, with {n} added. A small piece of generosity.",
      "Wide signalled. {n} to the total, and another ball to bowl.",
    ],
    [
      "Wide! {n} added, and he has to bowl another!",
      "It's a wide! A gift of {n} to the batting side!",
      "Wide called! {n} more without using a legal ball!",
    ],
    [
      "A wide costs {n}. That's a legal ball still owed by the bowler.",
      "Wide, and {n} added. I'd want more discipline from the next one.",
      "{n} from a wide. The bowler has given away runs and a delivery.",
    ],
  ],
  noBall: [
    [
      "A no-ball. The total rises by {n}, with no legal ball used.",
      "No-ball signalled. {n} go into the scorebook.",
      "An illegal delivery costs {n}. Another ball is required.",
    ],
    [
      "No-ball! {n} more, and that delivery doesn't count!",
      "He's bowled a no-ball! The total gets {n}!",
      "No-ball called! It's cost {n} in all!",
    ],
    [
      "A no-ball costs {n}. The bowler still owes a legal delivery.",
      "{n} from a no-ball. That's a costly way to lose control of an over.",
      "No-ball. {n} added, and no progress through the legal deliveries.",
    ],
  ],
  noBallBoundary: [
    [
      "A no-ball and {boundary} off the bat. {n} added in all.",
      "{boundary} to {b}, plus the no-ball. An expensive entry.",
      "The boundary comes with a no-ball. {n} to the total.",
    ],
    [
      "No-ball, and {boundary} off the bat! That's {n} altogether!",
      "He's hit {boundary}, and there's a no-ball as well! {n} added!",
      "A boundary and the no-ball! The total jumps by {n}!",
    ],
    [
      "{n} in all: {boundary} off the bat and the no-ball. The bowler has paid twice.",
      "A no-ball punished for {boundary}. That's {n} from the delivery.",
      "{boundary} plus the no-ball. I'd call that an expensive lapse.",
    ],
  ],
};

export const WINNING_EXTRA_LINES = [
  ["{event}. {n} added, and the chase is over.", "{event} completes the scoring. They have reached their target.",
    "{event}, and the target is reached. No more arithmetic required."],
  ["{event}! That's enough! They've completed the chase!", "It's over! {event}, and the batting side are home!",
    "{event}! The target's reached! They can celebrate now!"],
  ["{event}. The chase is finished; the batting side have their target.",
    "The target is reached with {event}. That's the job done.",
    "{event} closes the chase. The bowling side cannot defend that total any longer."],
];
