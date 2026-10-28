import { bearingOf } from "./geometry.js";

/**
 * Ball-by-ball calls built from parts - what was bowled, the shot, where it
 * went, what came of it - so ordinary balls don't keep landing on the same
 * handful of lines. Also names the area of the ground a shot went to, which
 * the commentary remembers for each batter (his scoring zones).
 */

// What was bowled: a length word, then (usually) a line. Spinners get their own lengths.
const LENGTHS = {
  pace: {
    yorker: ["Right up in the blockhole", "Fired in full at the toes", "Searching for the yorker"],
    full: ["Full", "Pitched up", "Overpitched", "Full and inviting"],
    good: ["On a good length", "Good length", "Hitting the deck on a length", "Nagging length"],
    back: ["Back of a length", "Short of a length", "Just back of a length"],
    short: ["Banged in short", "Short", "Dug in short", "Short and sharp"],
  },
  spin: {
    yorker: ["Fired in flat at the toes", "Darted in full"],
    full: ["Tossed up", "Flighted, full", "Given plenty of air", "Loopy and full"],
    good: ["Flighted on a length", "Nicely flighted", "Dipping on a length", "Tidy length"],
    back: ["Quicker and flatter", "Pushed through", "Flatter, back of a length"],
    short: ["Dragged down short", "A long hop", "Short, and a rank one"],
  },
};
const LINES_AT = {
  stumps: ["on the stumps", "and straight", "at middle stump", "attacking the stumps"],
  off: ["outside off", "just outside off", "in the corridor", "on fourth stump"],
  wide: ["and wide", "well wide of off", "with width on offer", "outside off, and wide"],
  leg: ["on the pads", "drifting onto leg stump", "on the hip", "down the leg side"],
};
// The same, as a noun: "{b} drives the half-volley through the covers."
const BALL_NOUN = {
  pace: {
    yorker: ["the yorker", "the full one"],
    full: ["the half-volley", "the full ball", "the overpitched one"],
    good: ["the length ball", "a good-length ball", "the one on a length"],
    back: ["the back-of-a-length ball", "the short-of-a-length one"],
    short: ["the short ball", "the bouncer", "the short one"],
  },
  spin: {
    yorker: ["the quicker, fuller one"],
    full: ["the flighted ball", "the tossed-up one", "the full toss"],
    good: ["the flighted delivery", "the one on a length"],
    back: ["the quicker one", "the flatter delivery"],
    short: ["the long hop", "the short one"],
  },
};

// The shot, as a verb, from the shot's name (batting.js shotName).
function shotVerb(name) {
  if (name.includes("late cut")) return ["dabs", "late-cuts", "guides"];
  if (name.includes("cut")) return ["cuts", "slaps", "carves", "flays"];
  if (name.includes("hook")) return ["hooks", "takes on the hook and sends"];
  if (name.includes("pull")) return ["pulls", "swivels and pulls", "whips"];
  if (name.includes("reverse sweep")) return ["reverse-sweeps", "switches and sweeps"];
  if (name.includes("sweep")) return ["sweeps", "gets down and sweeps", "paddles"];
  if (name.includes("ramp") || name.includes("scoop")) return ["ramps", "scoops", "helps"];
  if (name.includes("lofted") || name.includes("slog")) return ["lofts", "launches", "goes aerial and hits", "chips"];
  if (name.includes("glance")) return ["glances", "tickles", "helps"];
  if (name.includes("clip")) return ["clips", "flicks", "works", "nurdles"];
  if (name.includes("square drive")) return ["square-drives", "punches", "slashes"];
  if (name.includes("drive")) return ["drives", "punches", "caresses", "leans into and drives", "eases"];
  return ["pushes", "nudges", "works", "taps"];
}

/**
 * The area of the ground a shot went to, as commentators say it, and the
 * zone it counts towards in a batter's scoring areas. bearing: degrees from
 * straight down the ground, positive on the off side.
 */
export function shotArea(exit, deep) {
  const bearing = bearingOf(exit.x, exit.z);
  const angle = Math.abs(bearing);
  const off = bearing >= 0;
  const area = (zone, near, far) => ({ zone, words: deep ? far : near });
  if (angle < 12) return area("straight", ["back past the bowler", "straight"], ["straight down the ground", "past the bowler"]);
  if (angle < 30)
    return off
      ? area("straight", ["past mid-off", "wide of mid-off"], ["down to long-off", "past mid-off"])
      : area("straight", ["past mid-on", "wide of mid-on"], ["down to long-on", "past mid-on"]);
  if (angle < 72)
    return off
      ? area(
          "the covers",
          ["into the covers", "to cover", "through extra cover"],
          ["through the covers", "to deep cover", "through extra cover"],
        )
      : area(
          "midwicket",
          ["to midwicket", "into the leg side"],
          ["through midwicket", "to deep midwicket", "through mid-on and midwicket"],
        );
  if (angle < 112)
    return off
      ? area("point", ["to point", "square on the off side"], ["behind point", "square through point", "to deep point"])
      : area("square leg", ["to square leg", "square on the leg side"], ["to deep square leg", "square on the leg side"]);
  if (angle < 150)
    return off
      ? area("third man", ["past gully", "behind square on the off side"], ["down to third man", "past gully"])
      : area("fine leg", ["behind square", "fine on the leg side"], ["down to fine leg", "behind square on the leg side"]);
  return off
    ? area("third man", ["fine past the slips"], ["down to third man", "fine past the slips"])
    : area("fine leg", ["fine down the leg side"], ["down to fine leg", "very fine on the leg side"]);
}

// Leading with the result instead: "Two more, as {b} ..."
const RESULT_LEADS = {
  0: ["No run", "Nothing doing"],
  1: ["A single", "One more", "Another single"],
  2: ["Two more", "A couple"],
  3: ["Three more", "Three"],
  4: ["Four more", "Four"],
};

// Where a dot ball was fielded, by zone.
const FIELDED = {
  straight: ["back to the bowler", "straight to mid-off", "straight to mid-on"],
  "the covers": ["to cover", "to extra cover", "straight to cover"],
  midwicket: ["to midwicket", "straight to midwicket"],
  point: ["to point", "to backward point"],
  "square leg": ["to square leg", "to short leg"],
  "third man": ["to gully", "into gully's hands"],
  "fine leg": ["to short fine leg", "fine, and it's fielded"],
};

const RESULTS = {
  0: ["No run.", "Fielded. No run.", "Good stop, no run.", "Nothing in it.", "No run there."],
  1: ["One run.", "They take a single.", "Easy single.", "Quick single.", "Just the one.", "They scamper through for one."],
  2: ["They come back for two.", "Two runs.", "Hard running, two.", "Good running, they get two.", "Two, comfortably."],
  3: ["Three.", "They run three.", "Three, and they're puffing.", "Brilliant running, three."],
  4: ["Four.", "Four runs.", "That's four.", "Boundary.", "Nobody's stopping that. Four."],
};

/**
 * A call built from parts for a ball that met the middle of the bat, or null
 * to leave it to the hand-written lines.
 */
export function composeCall(rec, batter, spinner, rng) {
  if (rec.contact !== "middle" || !rec.exit || rec.extra.type || rec.boundary === 6 || rec.shot === "defend") return null;
  const seen = rec.seenBall;
  if (!seen) return null;
  const kind = spinner ? "spin" : "pace";
  const runs = Math.min(rec.runsBat, 4);
  const where = shotArea(rec.exit, runs >= 2 || rec.boundary === 4);
  const verb = rng.pick(shotVerb(rec.shotName));
  const dest = rng.pick(runs === 0 ? FIELDED[where.zone] : where.words);
  const result = rng.pick(RESULTS[runs] ?? RESULTS[1]);
  const len = rng.pick(LENGTHS[kind][seen.length]);
  const line = seen.length === "yorker" ? "" : ` ${rng.pick(LINES_AT[seen.line])}`;
  const noun = rng.pick(BALL_NOUN[kind][seen.length]);
  const shapes = [
    () => `${len}${line}, and ${batter} ${verb} it ${dest}. ${result}`,
    () => `${len}${line}. ${batter} ${verb} it ${dest}. ${result}`,
    () => `${batter} ${verb} ${noun} ${dest}. ${result}`,
    () => `${rng.pick(RESULT_LEADS[runs])}, as ${batter} ${verb} ${noun} ${dest}.`,
  ];
  return rng.pick(shapes)();
}
