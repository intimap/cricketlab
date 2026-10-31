/** Authored ball calls, in Bunnings / Lorry / Grog order. Placeholders are factual, not invented detail. */
export const BOOTH_DOT_LINES = {
  leave: [
    [
      "No stroke from {b}. A quiet decision.",
      "{b} lets that go. Nothing to add.",
      "Bat stays out of the discussion. No run.",
      "Watched through by {b}. Quite content to wait.",
      "{b} declines the invitation. No run.",
      "Through it goes. {b} keeps the bat to himself.",
      "A leave from {b}. No unnecessary conversation with the ball.",
      "{b} watches, waits, and leaves the score alone.",
    ],
    [
      "He's leaving it! {b} won't be drawn into that one!",
      "No shot! {b} is making the bowler come to him!",
      "Through to the keeper! {b} never offered!",
      "He's watched it all the way! Nothing doing!",
      "Bat out of harm's way! No run to {b}!",
      "Not tempted! {b} is happy to watch that go!",
      "He's kept the bat parked! No run!",
      "Another look for {b}, but no swing at it!",
    ],
    [
      "{b} leaves. Make him play the next one.",
      "No stroke. {w} hasn't drawn him into a contest there.",
      "{b} lets it pass. The bowler must ask again.",
      "A leave. I wouldn't chase a ball just because it's there.",
      "{b} keeps the bat away. No gift for the bowler.",
      "Through without a shot. That's a ball the batter can forget.",
      "{b} won't reach for it. Nothing earned by either side.",
      "Left alone. {w} still has to find a way through him.",
    ],
  ],
  defend: [
    [
      "Bat meets ball, ambition kept in reserve. No run.",
      "A block from {b}. Nothing extravagant.",
      "{b} puts the bat in the way. The score can wait.",
      "Quietly defended. {b} has made his point.",
      "{b} keeps that one out. A small job completed.",
      "A defensive bat. The scoreboard remains untroubled.",
      "{b} blocks. Not every ball needs a flourish.",
      "Safely dealt with by {b}. No run.",
    ],
    [
      "Bat down! {b} isn't giving that one a chance!",
      "He's kept it out! No run, but the bat did its job!",
      "A solid block from {b}! Nothing through there!",
      "Defended! {b} is staying right with the contest!",
      "No big swing! Just the bat in the way from {b}!",
      "That's kept out! No room for the ball to sneak through!",
      "He's blocked it! {w} has to go again!",
      "Bat and ball meet! No run for {b}!",
    ],
    [
      "{b} defends. Keep the scoring ball separate from the survival ball.",
      "A block. No need to manufacture a shot at everything.",
      "{b} keeps it out. The bowler hasn't found a way through.",
      "Defended. I'd make him keep doing that before changing the plan.",
      "A defensive stroke. The batter has kept the risk down.",
      "{b} blocks. Now the bowler has to repeat the question.",
      "Kept out. A patient bat rather than an ambitious one.",
      "{b} chooses defence. Nothing wasted on a low-percentage swing.",
    ],
  ],
  beaten: [
    [
      "A swing from {b}, but the ball wins that exchange.",
      "{b} has played at air. No damage this time.",
      "The bat offered an answer. The ball declined to meet it.",
    ],
    [
      "Past the bat! {b} has had a proper look at trouble!",
      "He's missed it! {w} will like the sight of that!",
      "Oh, the ball's beaten him! No contact at all!",
    ],
    [
      "Beaten. {b} hasn't matched the bat to that delivery.",
      "{w} gets past the bat. That's a question worth asking again.",
      "An unsuccessful stroke. The batter has to reset his read.",
    ],
  ],
  miss: [
    [
      "No contact for {b}. Nothing added.",
      "The bat and ball remain strangers. No run.",
      "Nothing off the bat, and nothing on the board.",
    ],
    [
      "He's not connected! No run for {b}!",
      "Nothing on it! The score hasn't moved!",
      "No contact, no run! {b} has to start again!",
    ],
    [
      "No contact. The batter has to judge the next one afresh.",
      "Nothing off the bat. {b} can't force a result from that.",
      "A missed connection. No reward for the stroke.",
    ],
  ],
  pad: [
    [
      "Onto the pad. {b} survives, with nothing added.",
      "The pad is involved, the scorebook isn't.",
      "{b} wears that on the pad. No wicket, no run.",
    ],
    [
      "On the pad! But {b} is still there!",
      "It's hit the pad! No wicket this time!",
      "Pad first, and no run! {b} survives that exchange!",
    ],
    [
      "The pad takes it. No wicket, but the bat hasn't settled the matter.",
      "Onto the pad. I'd want {b} to judge that one carefully.",
      "No run from the pad. The bowler has made contact, not a breakthrough.",
    ],
  ],
  edgeDot: [
    [
      "A {contact} from {b}. Nothing to add to the score.",
      "Not the part of the bat he ordered. No run.",
      "An edge, and the score remains exactly where it was.",
    ],
    [
      "An edge! No run, but that wasn't what {b} wanted!",
      "A {contact}! Nothing added for {b}!",
      "Off the edge! {b} hasn't got that one away!",
    ],
    [
      "An edge for no run. The bat hasn't fully controlled that.",
      "Edge found. I'd keep testing that contact.",
      "A {contact}, for no run. Not a stroke the batter has controlled.",
    ],
  ],
  offCentreDot: [
    [
      "Off the {part}. The ball has taken the energy out of that stroke.",
      "The {part} is involved. Not much reward, and no run.",
      "No run. That met the {part}, rather than the bat's best address.",
    ],
    [
      "Off the {part}! He's got no run from that connection!",
      "That hasn't flown off the {part}! Nothing added!",
      "The {part} takes it! {b} hasn't got it away!",
    ],
    [
      "Off the {part}. The stroke has lost its punch.",
      "No run. Contact on the {part} has taken the pace out of it.",
      "{b} finds the {part}, not the sweet spot. No reward.",
    ],
  ],
  stopped: [
    [
      "{b} connects, but there is no run in it.",
      "{b} plays a {shot}. No run despite the connection.",
      "{b} finds the bat's middle, but not a scoring result.",
    ],
    [
      "He's connected, but there's no run!",
      "Bat on ball! {b} can't get a run from it!",
      "He's met that one, but the scoreboard hasn't moved!",
    ],
    [
      "Good contact without a run. Finding the gap is the next part.",
      "{b} connects, but the stroke hasn't produced a scoring chance.",
      "No run despite the connection. Contact alone doesn't do the job.",
    ],
  ],
  miscue: [
    [
      "Not much authority in that stroke. No run.",
      "{b} hasn't got hold of it. Nothing added.",
      "A rather modest return from the swing. No run.",
    ],
    [
      "He's not got hold of it! No run for {b}!",
      "That hasn't come off as he'd hoped! Nothing added!",
      "A swing, but no scoring result from {b}!",
    ],
    [
      "The connection hasn't delivered much pace. No run.",
      "{b} hasn't controlled that stroke well enough to score.",
      "No run. I'd look for a cleaner meeting of bat and ball.",
    ],
  ],
};

export const GLOVE_LINES = [
  ["Off the glove. {result}. Not quite the intended instrument.",
    "The glove is involved. {result} from the delivery.", "{b} gets the glove to it. {result}."],
  ["Off the glove! {result}!", "It's taken the glove! {result} for the batting side!",
    "Glove on it! {result}! That wasn't the bat!"],
  ["The glove makes contact. {result}. That was not a controlled connection.",
    "{result} off the glove. The ball has not met the blade.", "Glove involved. {result}. I'd want the bat doing that work."],
];
