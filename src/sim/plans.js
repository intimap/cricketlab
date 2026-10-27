// The battle between bowler and batter: each computer batter has a hidden
// weakness, remembers what he's been bowled, and gets harder to dismiss with
// the same ball and easier with a well-disguised change.

/**
 * Hidden weaknesses. `hints` are commentary lines that nudge the player
 * towards the weakness when it shows ({b} = batter).
 */
export const WEAKNESSES = {
  offStump: {
    hints: [
      "{b} is fishing outside off stump again. He can't help himself.",
      "Another loose waft outside off from {b}. There's a weakness there.",
      "{b} is feeling for it outside off. The slips are interested.",
    ],
  },
  hook: {
    hints: [
      "{b} took that on without a second thought. He loves the hook, and he might not be able to resist it.",
      "He's hooking at everything. That's a risk worth tempting.",
    ],
  },
  bouncer: {
    hints: ["{b} doesn't like it up around the ribs. Not one bit.", "Hurried by the short ball again. {b} looks uncomfortable."],
  },
  earlySpin: {
    hints: [
      "{b} looks all at sea against the spinner. He hasn't worked out the length yet.",
      "Nervy against the turning ball, {b}. Hard hands, no footwork.",
    ],
  },
  inswingYorker: {
    hints: [
      "Jammed! {b} is struggling with the full one coming back in.",
      "{b} is late on the full inswinger. That's the ball to get him with.",
    ],
  },
};

/** Pick a hidden weakness for a batter. Openers and top order lean towards outside-off; tailenders hate the short ball. */
export function pickWeakness(role, rng) {
  const odds = {
    opener: { offStump: 4, inswingYorker: 2, hook: 1, earlySpin: 1, bouncer: 1 },
    top: { offStump: 3, hook: 2, earlySpin: 2, inswingYorker: 1, bouncer: 1 },
    middle: { hook: 2, earlySpin: 3, offStump: 2, inswingYorker: 1, bouncer: 1 },
    keeper: { offStump: 2, earlySpin: 2, hook: 2, inswingYorker: 2, bouncer: 1 },
    allround: { hook: 3, offStump: 2, earlySpin: 1, inswingYorker: 2, bouncer: 1 },
    tail: { bouncer: 4, inswingYorker: 3, earlySpin: 2, hook: 1, offStump: 1 },
    bunny: { bouncer: 4, inswingYorker: 4, earlySpin: 2, hook: 1, offStump: 1 },
  }[role];
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (const [w, n] of Object.entries(odds)) {
    roll -= n;
    if (roll < 0) return w;
  }
  return "offStump";
}

/** Which way a delivery moves, as the batter sees it. */
const MOVEMENT = {
  outswing: "away",
  legspin: "away",
  cutter: "away",
  inswing: "in",
  offspin: "in",
  googly: "in",
  armBall: "straight",
  seam: "straight",
  slower: "straight",
  bouncer: "straight",
  yorker: "straight",
};

/** A compact description of a delivery for the batter's memory. */
export function describeBall(d) {
  const at = d.atCrease;
  const x = at ? at.x : d.intent.line;
  const pitchZ = d.pitchedAt?.z ?? 0;
  return {
    type: d.intent.type,
    move: MOVEMENT[d.intent.type] ?? "straight",
    line: x > 0.35 ? "wide" : x > 0.12 ? "off" : x > -0.12 ? "stumps" : "leg",
    length: pitchZ < 2.6 ? "yorker" : pitchZ < 4.5 ? "full" : pitchZ < 7.5 ? "good" : pitchZ < 9.5 ? "back" : "short",
  };
}

/**
 * How this ball relates to the last few the batter has faced.
 * familiar: 0..3 recent balls that looked just like it (he's lined it up).
 * surprise: 1 if it breaks a clear pattern (three away then one in; three
 * short then a full one), else 0.
 */
export function readAgainst(seen, ball) {
  const recent = seen.slice(-4);
  const familiar = Math.min(
    3,
    recent.filter((b) => b.move === ball.move && b.line === ball.line && b.length === ball.length).length,
  );
  const last3 = seen.slice(-3);
  let surprise = 0;
  if (last3.length === 3) {
    const sameMove = last3.every((b) => b.move === last3[0].move);
    const shortThenFull =
      last3.every((b) => b.length === "back" || b.length === "short") && (ball.length === "full" || ball.length === "yorker");
    const fullThenShort = last3.every((b) => b.length === "full" || b.length === "good") && ball.length === "short";
    const moveSwitch = sameMove && last3[0].move !== "straight" && ball.move !== "straight" && ball.move !== last3[0].move;
    if (moveSwitch || shortThenFull || fullThenShort) surprise = 1;
  }
  return { familiar, surprise };
}

/** 0..1: how squarely this ball targets the batter's weakness. */
export function exploits(weakness, ball, ctx) {
  switch (weakness) {
    case "offStump":
      return ball.line === "wide" || ball.line === "off" ? (ball.length === "good" || ball.length === "full" ? 1 : 0.5) : 0;
    case "hook":
    case "bouncer":
      return ball.length === "short" ? (ball.line === "stumps" || ball.line === "leg" ? 1 : 0.6) : 0;
    case "earlySpin":
      return ctx.spinner ? Math.max(0, 1 - ctx.settled * 2) : 0;
    case "inswingYorker":
      return (ball.length === "yorker" || ball.length === "full") && ball.move === "in" && ball.line !== "wide" ? 1 : 0;
    default:
      return 0;
  }
}

// Tuned against simulated innings.
const WEAK_EFFECT = 0.8;
const SURPRISE_EFFECT = 0.5;

/** Multiplier on how hard the batter finds the ball to play (1 = normal). */
export function difficulty({ weak, surprise, familiar }) {
  return (1 + WEAK_EFFECT * weak) * (1 + SURPRISE_EFFECT * surprise) * (1 - 0.12 * familiar);
}
