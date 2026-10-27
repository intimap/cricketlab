import { isSpinner } from "./teams.js";
import { WEAKNESSES } from "./plans.js";

// Placeholders: {b} batter, {w} bowler, {f} fielder, {r} runs, {s} shot name,
// {note} LBW verdict reason.
const LINES = {
  leaveWide: [
    "Left alone. Plenty of width and {b} wants none of it.",
    "Shoulders arms. Easy leave, that one was in another postcode.",
    "Wafted at nothing, played at nothing. Good judgement from {b}.",
    "Let it go. The keeper takes it and tosses it to gully. Test cricket.",
    "{b} watches it all the way through to the keeper. Patience.",
  ],
  leaveClose: [
    "Left... and that was close to the off stump. Brave or foolish? Brave, this time.",
    "Shoulders arms and that has whistled over the top of off. Gulp.",
    "Leaves it, and the keeper takes it right in front of off stump. Fine margins.",
    "Judgement call from {b}, and it is just about the right one.",
  ],
  leaveNew: [
    "The new ball is hooping about and {b} is right to leave it.",
    "Hard, shiny and dangerous. {b} lets it go, sensibly.",
  ],
  beaten: [
    "Played and missed! {w} has beaten the outside edge.",
    "Beaten! That one nipped away late and {b} was groping for it.",
    "Ooh. Past the edge. {w} has his hands on his head.",
    "Through the gate... no, just over the top. Beaten all ends up.",
    "Squared up by that one. {b} was lucky not to get a nick.",
    "A jaffa. Nothing {b} could do about that except miss it, which he did.",
    "The slips go up, then go quiet. Beaten again.",
  ],
  beatenSwing: [
    "Swung late and beat the bat. That is lovely bowling from {w}.",
    "Shaped in, then out again. {b} played for the first bit only.",
  ],
  beatenReverse: [
    "Reverse swing! It went the wrong way and {b} had no idea.",
    "That has tailed in sharply. The old ball is talking now.",
  ],
  beatenSpin: [
    "Turned past the outside edge! {w} is getting some purchase out of this.",
    "Big turn there. {b} played down the wrong line entirely.",
    "Ripped it. That has spun a mile and {b} is left staring at the pitch.",
    "Drift, dip, turn. Beautiful from {w}.",
  ],
  defend: [
    "Solid forward defence. Dead bat, straight back.",
    "{b} gets in behind it. Nothing doing.",
    "Blocked. The crowd stirs, then settles.",
    "Watchful. That is Test match batting.",
    "Defended into the off side. No run.",
    "Pushed back to the bowler. {w} fields it and wanders back to his mark.",
    "Good, tight defence from {b}. Bat and pad together.",
    "Blocked with soft hands. It dies at his feet.",
  ],
  defendPressure: [
    "Another dot. The pressure is building on {b}.",
    "That is a lot of dots in a row now. Somebody has to blink.",
    "Blocked again. The field crowds in a step. You can feel it.",
    "Still no run. {b} is a statue out there.",
  ],
  defendSettled: [
    "Watchful, but {b} looks well set now. In no rush.",
    "Defends with all the time in the world. He is seeing it like a football.",
  ],
  defendLow: [
    "That one kept low! Jammed down on it just in time.",
    "Shooter! Dug out at the last second. The cracks are starting to play a part.",
  ],
  defendHigh: [
    "Jumped off a length! {b} fends it down safely, but that is a warning.",
    "Took off from a good length. Variable bounce, and the batters know it.",
  ],
  edgeShort: [
    "Edged... and it falls short of the slips! Soft hands saved him.",
    "Outside edge, but it dies before second slip. Phew.",
    "Nick! Doesn't carry. The cordon groans.",
  ],
  edgeRuns: [
    "Edged and it flies past the slips! {r} to third man. Lucky.",
    "Thick edge, down to third man. They'll take {r}. Not pretty.",
    "Off the edge and away. Count them in the book, {r} runs.",
  ],
  edgeFour: [
    "Edged, and it races between the slips to the fence! Four, but {w} won't mind the look of that.",
    "Thick edge, flying through gully for four. Streaky.",
    "Outside edge... and that's four! Through a gap that shouldn't be there.",
  ],
  insideEdge: [
    "Inside edge onto the pads. Close to the stumps, that.",
    "Inside edge, past the leg stump! Lucky boy.",
    "Squeezed off the inside edge and away to fine leg.",
  ],
  dropped: [
    "DROPPED! {f} puts it down! That could be costly.",
    "Chance goes begging! {f} gets two hands to it and spills it.",
    "Oh no. Shelled at {f}. {w} cannot believe it.",
    "Grassed! That will be replayed in {f}'s head all night.",
  ],
  dot: [
    "Struck well, but straight to {f}. No run.",
    "Good shot, good stop. {f} gets across.",
    "Driven firmly, but the field is set for that. Dot ball.",
    "Nicely timed, but it finds {f}.",
  ],
  single: [
    "Pushed into the gap for a single.",
    "Nudged away, they scamper through for one.",
    "Worked off the pads for a quiet single.",
    "Tucked away for one. Rotating the strike nicely.",
    "Dabbed down and they run. One.",
    "{s} for a single.",
  ],
  two: [
    "Placed into the gap, they come back for two. Good running.",
    "Two more. {b} and his partner are running well.",
    "{s}, and they hustle back for the second.",
  ],
  three: ["Chased down just inside the rope. Three runs.", "Three! Superb running, and a weary throw back in."],
  four: [
    "Glorious {s}! Four runs. Didn't need to hit that hard.",
    "Cracking shot. That races away to the boundary.",
    "FOUR! {b} leans into the {s} and it beats the field.",
    "Pierced the field! Four runs and a little bit of a statement.",
    "Timed to perfection. The fielder didn't move.",
    "Shot! That's four. The members in the pavilion approve.",
  ],
  fourCut: ["Cut hard! Four. Too short, too wide, and duly punished.", "Slapped through point. Four runs. Width is a gift."],
  fourSweep: ["Swept! Down on one knee and it races away fine for four.", "Sweeps hard, gets it in the gap behind square. Four."],
  fourReverseSweep: [
    "Reverse swept! Cheeky, and it beats third man for four.",
    "Switches the hands, reverse sweeps... four! Outrageous.",
  ],
  fourRamp: ["Ramped over the keeper! Four, and {w} can't believe it.", "Scooped fine off the pace. Audacious, and it's four."],
  fourPull: [
    "Pulled away! Four. Rolled the wrists over it nicely.",
    "Picked it up early and pulled it in front of square. Four.",
  ],
  six: [
    "SIX! Right out of the screws. That's gone into the crowd!",
    "Huge! {b} has launched that over the rope. Somebody catch it!",
    "Six! That's landed in the cheap seats and someone has spilled their beer.",
    "Down the track and over the top. Six! Bold cricket.",
  ],
  bowled: [
    "BOWLED HIM! Timber! {w} knocks over the stumps!",
    "Gone! Through the gate and the bails are flying!",
    "Clean bowled! {b} has to go. That is a cracker from {w}.",
    "Middle stump cartwheeling! What a ball!",
  ],
  playedOn: ["Played on! Off the inside edge and onto the stumps. {b} can't believe it.", "Dragged on! An agonising way to go."],
  lbw: [
    "Big appeal... and the finger goes up! LBW! Plumb.",
    "Trapped in front! {b} has to go, that was hitting.",
    "LBW! Pinned on the crease. {w} is roaring.",
  ],
  notOutLbw: [
    "Huge appeal for LBW... not out. {note}.",
    "They go up as one! The umpire is unmoved. {note}.",
    "Struck on the pad! Turned down. {note}.",
  ],
  caughtBehind: [
    "Edged and taken! Caught behind! {w} gets his man.",
    "Nick, and the keeper does the rest. Gone!",
    "Feathered it! Taken behind. {b} walks.",
  ],
  caughtSlip: [
    "Edged... and taken at {f}! Brilliant catch!",
    "Caught in the cordon! {f} snaffles it.",
    "Edge, and {f} makes no mistake. That is what the slips are for.",
  ],
  caught: [
    "In the air... and taken! {f} holds on!",
    "Caught! Straight to {f}. {b} will be livid.",
    "Up, up... and {f} takes it. Gone!",
    "Mistimed and caught at {f}. A soft dismissal.",
  ],
  caughtDive: ["WHAT A CATCH! {f} flings himself and clings on!", "Unbelievable! A full-length dive from {f}. Take a bow."],
  runout: [
    "RUN OUT! There was never a run there. Disaster.",
    "Direct... and he's short! Run out!",
    "Mix-up! Both batters at one end. Run out.",
    "Superb fielding, and {b} is short of his ground. Gone!",
  ],
  stumped: [
    "Stumped! Down the track, beaten in the flight, and the keeper whips the bails off.",
    "Lured out, beaten, stumped. Classic spin bowling.",
  ],
  wide: ["Wide. Sprayed down the leg side.", "Called wide. {w} won't be happy with that.", "Wide down the off side. Loose."],
  noball: ["No ball! Over-stepped. A free run for the batting side.", "Front foot no ball. The umpire's arm goes out."],
  byes: ["Through to the keeper... and it beats him! They run byes.", "Byes. The keeper will want that one back."],
  legbyes: ["Off the pads and they steal a leg bye.", "Leg byes, hit on the thigh pad and they scamper through."],
  padAway: ["Struck on the pad, going down leg. They don't run.", "Off the pad and away. Nothing in it."],
};

const COLOUR_LINES = {
  reverse: ["The old ball is reversing now. Different game.", "Look at that tail in the air. Reverse swing has arrived."],
  soft: ["The ball has gone soft, and batting looks a lot easier.", "Not much in it for the bowlers now. The ball has died."],
  shiny: ["Still a bit of shine on the new ball. Bowlers want to make it count."],
  tired: ["{w} is starting to blow. The pace is dropping.", "{w} looks cooked. Might be time for a change."],
  settled: ["{b} has been out there a long time now. Looks immovable."],
  turning: [
    "The pitch is starting to break up. Spinners will enjoy this.",
    "There are a few marks on this surface now. The footmarks are coming into play.",
  ],
  newBatter: ["New batter {b} gets off the mark. The first one is always the hardest."],
};

// The bowler-batter battle, free hits and captaincy.
const BATTLE_LINES = {
  setUp: [
    "That's the one he's been setting up! Beautiful bowling.",
    "Set up, and knocked over. That was a plan, executed.",
    "He's been working on that for a few balls. Lovely.",
  ],
  surpriseBeaten: ["Ooh, that one did something different. {b} was expecting the same again."],
  familiar: ["He'd seen that one before, and he was waiting for it.", "Same ball again, and {b} was all over it."],
  freeHitSix: ["Free hit, and he's made it count! Into the crowd."],
  freeHitNext: ["Free hit coming up."],
  thirdBouncer: ["That's the third bouncer of the over. No ball!"],
  tiredSpell: ["{w} is running on empty. Might be time for a change.", "That's a long spell from {w}. The legs are going."],
  noSpinner: ["Up in the box they're wondering why {s} hasn't had a bowl yet. This pitch is begging for spin."],
  pressure: ["The pressure is really building now. Something has to give."],
};

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Picks a line of commentary for each ball, avoiding recent repeats. */
export class Commentary {
  recent = [];
  /** When each batter's weakness was last hinted at (balls faced). */
  hinted = new Map();
  /** One-off colour remarks already made this innings. */
  flags = new Set();

  constructor(rng) {
    this.rng = rng;
  }

  pick(lines) {
    const fresh = lines.filter((l) => !this.recent.includes(l));
    const line = this.rng.pick(fresh.length ? fresh : lines);
    this.recent.push(line);
    if (this.recent.length > 40) this.recent.shift();
    return line;
  }

  /** Commentary for a finished ball record. */
  line(rec, inn) {
    const batter = inn.bat[rec.wicket ? rec.wicket.batter : rec.striker];
    const bowler = inn.bowl[rec.bowler];
    const spin = isSpinner(bowler.p.bowl);
    const fill = (text, fielder = "") =>
      text
        .replace(/\{b\}/g, batter.p.short)
        .replace(/\{w\}/g, bowler.p.short)
        .replace(/\{f\}/g, fielder || "the fielder")
        .replace(/\{r\}/g, String(rec.total))
        .replace(/\{s\}/g, rec.shotName || "shot")
        .replace(/\{note\}/g, capitalise(rec.lbwNote || "missing"));

    const w = rec.wicket;
    if (w) {
      let text;
      if (w.how === "bowled") {
        text = this.pick(rec.contact === "insideEdge" || rec.contact === "bottomEdge" ? LINES.playedOn : LINES.bowled);
      } else if (w.how === "lbw") text = this.pick(LINES.lbw);
      else if (w.how === "runout") text = this.pick(LINES.runout);
      else if (w.how === "stumped") text = this.pick(LINES.stumped);
      else text = this.pick(rec.quality < 0.4 ? LINES.caught : this.rng.chance(0.25) ? LINES.caughtDive : LINES.caught);
      return fill(text, w.fielder);
    }
    if (rec.dropped) return fill(this.pick(LINES.dropped), rec.dropped);

    let text;
    if (rec.extra.type === "wd") text = this.pick(LINES.wide);
    else if (rec.extra.type === "nb" && rec.total <= 1) text = this.pick(LINES.noball);
    else if (rec.extra.type === "b") text = this.pick(LINES.byes);
    else if (rec.extra.type === "lb") text = this.pick(LINES.legbyes);
    else if (rec.boundary === 6) text = this.pick(LINES.six);
    else if (rec.boundary === 4) {
      if (rec.contact === "thinEdge" || rec.contact === "thickEdge") text = this.pick(LINES.edgeFour);
      else if (rec.shotName.includes("reverse sweep")) text = this.pick(LINES.fourReverseSweep);
      else if (rec.shotName.includes("sweep")) text = this.pick(LINES.fourSweep);
      else if (rec.shotName.includes("ramp") || rec.shotName.includes("scoop")) text = this.pick(LINES.fourRamp);
      else if (rec.shotName.includes("cut")) text = this.pick(LINES.fourCut);
      else if (rec.shotName.includes("pull") || rec.shotName.includes("hook")) text = this.pick(LINES.fourPull);
      else text = this.pick(LINES.four);
    } else if (rec.contact === "thinEdge" || rec.contact === "thickEdge") {
      text = this.pick(rec.total > 0 ? LINES.edgeRuns : LINES.edgeShort);
    } else if (rec.contact === "insideEdge" || rec.contact === "padPop") text = this.pick(LINES.insideEdge);
    else if (rec.lbwNote) text = this.pick(LINES.notOutLbw);
    else if (rec.shot === "leave") {
      const close = rec.pitched && Math.abs(rec.pitched.x) < 0.35;
      text = this.pick(close ? LINES.leaveClose : inn.ball.overs < 8 ? LINES.leaveNew.concat(LINES.leaveWide) : LINES.leaveWide);
    } else if (rec.beatBat) {
      if (spin) text = this.pick(LINES.beatenSpin);
      else if (rec.reversing) text = this.pick(LINES.beatenReverse);
      else if (rec.deliveryType === "outswing" || rec.deliveryType === "inswing")
        text = this.pick(LINES.beatenSwing.concat(LINES.beaten));
      else text = this.pick(LINES.beaten);
    } else if (rec.total === 0 && rec.shot === "defend") {
      if (rec.bounceNote === "low") text = this.pick(LINES.defendLow);
      else if (rec.bounceNote === "high") text = this.pick(LINES.defendHigh);
      else if (batter.dotStreak > 8) text = this.pick(LINES.defendPressure);
      else if (batter.balls > 80 && this.rng.chance(0.3)) text = this.pick(LINES.defendSettled);
      else text = this.pick(LINES.defend);
    } else if (rec.total === 0) text = this.pick(rec.quality > 0.5 ? LINES.dot : LINES.defend);
    else if (rec.total === 1) text = this.pick(LINES.single);
    else if (rec.total === 2) text = this.pick(LINES.two);
    else text = this.pick(LINES.three);
    text = fill(text);

    if (batter.balls <= 1 && rec.runsBat > 0 && rec.striker > 1) text = fill(this.pick(COLOUR_LINES.newBatter));

    // One-off remarks about conditions, each made at most once per innings.
    const colour = (flag, when) => {
      if (!when || this.flags.has(flag) || !this.rng.chance(0.6)) return "";
      this.flags.add(flag);
      return fill(this.pick(COLOUR_LINES[flag]));
    };
    const extra =
      colour("reverse", rec.reversing) ||
      colour("soft", inn.ball.hardness < 0.6) ||
      colour("turning", inn.pitch.wear > 0.25 && spin) ||
      (bowler.stamina < 0.35 && this.rng.chance(0.25) ? fill(this.pick(COLOUR_LINES.tired)) : "") ||
      colour("settled", batter.balls > 150);
    const battle = this.battleLine(rec, inn, batter, fill);
    if (battle) return `${text} ${battle}`;
    return extra ? `${text} ${extra}` : text;
  }

  /** A line about the battle: set-ups, repeats, weaknesses showing, free hits. */
  battleLine(rec, inn, batter, fill) {
    const b = rec.battle;
    if (rec.bouncerNoBall) return this.pick(BATTLE_LINES.thirdBouncer);
    if (rec.extra.type === "nb") return this.pick(BATTLE_LINES.freeHitNext);
    if (rec.freeHit && rec.boundary === 6) return this.pick(BATTLE_LINES.freeHitSix);
    if (!b) return "";
    if (rec.wicket && b.surprise) return this.pick(BATTLE_LINES.setUp);
    if (rec.boundary && b.familiar >= 2) return fill(this.pick(BATTLE_LINES.familiar));
    if (rec.beatBat && b.surprise) return fill(this.pick(BATTLE_LINES.surpriseBeaten));
    // Let the weakness show now and then, without spelling it out every ball.
    const struggled =
      rec.beatBat || rec.contact === "thinEdge" || rec.contact === "topEdge" || rec.contact === "gloved" || rec.wicket;
    const key = batter.p.name;
    const since = batter.balls - (this.hinted.get(key) ?? -99);
    if (b.weak > 0.5 && struggled && since >= 6 && this.rng.chance(0.6)) {
      this.hinted.set(key, batter.balls);
      return fill(this.pick(WEAKNESSES[batter.p.weakness].hints));
    }
    return "";
  }

  overSummary(inn) {
    const b = inn.bowl[inn.lastOverBowler];
    if (!b) return "";
    const runs = b.overRuns;
    let text;
    if (runs === 0) text = `Maiden from ${b.p.short}. Tight.`;
    else if (runs >= 10) text = `${runs} from the over. ${b.p.short} will want to forget that.`;
    else text = `${runs} from the over.`;
    const note = this.captaincyNote(inn, b);
    return note ? `${text} ${note}` : text;
  }

  /** Between overs: is the bowler cooked, should the spinner be on, is the pressure telling? */
  captaincyNote(inn, b) {
    const spinner = isSpinner(b.p.bowl);
    if (b.spell >= (spinner ? 10 : 6) && b.stamina < 0.45) return this.pick(BATTLE_LINES.tiredSpell).replace(/\{w\}/g, b.p.short);
    const idle = inn.bowl.find((x) => isSpinner(x.p.bowl) && x.balls === 0);
    if (idle && inn.pitch.wear > 0.12 && inn.overNo >= 15 && this.rng.chance(0.5)) {
      return this.pick(BATTLE_LINES.noSpinner).replace(/\{s\}/g, idle.p.short);
    }
    if (inn.pressure > 0.6 && this.rng.chance(0.5)) return this.pick(BATTLE_LINES.pressure);
    return "";
  }
}

// Fielders' send-offs when a wicket falls ({N} = the batter).
const AUSSIE_SLEDGES = [
  "SEE YA, {N}! DON'T LET THE GATE HIT YA!",
  "WALK FASTER, YA FLAMIN' GALAH!",
  "MY NAN'S GOT BETTER FOOTWORK AND TWO NEW HIPS!",
  "OI {N}! BAR'S THAT WAY. YOU'LL NEED IT!",
  "YOU BAT LIKE A STUNNED MULLET!",
  "BRING ON THE NEXT VICTIM!",
  "HOPE YOU BROUGHT A BOOK, {N}. LONG SERIES!",
  "WAS THAT A SHOT OR A CRY FOR HELP?",
  "RACK OFF, {N}! HOO-ROO!",
  "STREWTH! SEEN BETTER HANDS ON A CLOCK!",
  "FAIR DINKUM, MY DOG READS SPIN BETTER!",
  "YOU'RE NOT EVEN THE BEST BATTER IN YOUR STREET!",
  "THAT'S LUNCH SORTED, BOYS! {N} ON TOAST!",
  "BEEN MORE RESISTANCE FROM A WET SERVIETTE!",
  "{N}, MATE, WAS THE BAT A GIFT?",
  "TELL YA MUM I SAID G'DAY!",
  "CARRY HIS BAT FOR HIM, IT'S HEAVY WHEN IT'S CLEAN!",
  "HE'S GONE LIKE A FREE BARBIE AT A FOOTY CLUB!",
  "CHEERS FOR COMING, {N}! WORTH THE AIRFARE?",
  "THAT'S THE MOST HE'S MOVED HIS FEET ALL DAY!",
  "OFF YA GO! DRINKS ARE ON YOU TONIGHT!",
  "HAVE A BIT OF A LIE DOWN, CHAMP!",
  "GROUNDSMAN'S BATTED LONGER THAN THAT!",
  "YEAAAHHH! GET IN THERE! WHO'S NEXT?!",
];

const ENGLISH_SLEDGES = [
  "WELL BOWLED, CHAPS. JOLLY GOOD.",
  "OH I SAY. BAD LUCK, OLD BEAN.",
  "SORRY ABOUT THAT, {N}. TERRIBLY SORRY.",
  "I SAY, THAT'S RATHER OUT, ISN'T IT?",
  "GOODNESS. WELL. THERE WE ARE.",
  "DO MIND THE STEPS ON YOUR WAY UP.",
  "CUP OF TEA, ANYONE? NO? RIGHT-O.",
  "HARD LINES, OLD CHAP. HARD LINES.",
  "GOSH. WHAT A PALAVER.",
  "SPLENDID! ...SORRY. COMMISERATIONS.",
  "TA-RA, {N}! DO WRITE!",
  "BIT OF A NAUGHTY SHOT, IF I'M HONEST.",
  "OOH, CHEEKY. NO OFFENCE MEANT.",
  "MUM'S DOING SCONES LATER, IF YOU FANCY.",
  "STEADY ON, LADS. STEADY ON.",
  "I SHAN'T SAY ANYTHING. BUT... OUT.",
  "LOVELY WEATHER FOR IT, AT LEAST.",
  "WELL PLAYED... UNTIL THAT BIT.",
  "{N}, YOU DROPPED THIS. YOUR WICKET.",
  "OH DEAR. OH DEAR, OH DEAR.",
  "SORRY! SORRY. WAS THAT TOO MUCH?",
  "CHIN UP, {N}. TOMORROW'S ANOTHER DAY.",
];

// Chirps from the close fielders when the bat is beaten.
const AUSSIE_CHIRPS = [
  "TRY HITTING IT, MATE!",
  "IS THAT BAT FOR DECORATION?",
  "NOT EVEN CLOSE, CHAMP!",
  "HE'S GOT NO IDEA, BOYS!",
  "KEEP SWINGING, WE'LL GET YA!",
];
const ENGLISH_CHIRPS = ["OH, WELL LEFT. SORT OF.", "BAD LUCK, OLD CHAP. MISSED AGAIN.", "STEADY ON, NEARLY HAD IT."];

export function pickChirp(fieldingAbbr) {
  const pool = fieldingAbbr === "AUS" ? AUSSIE_CHIRPS : ENGLISH_CHIRPS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Up to `count` different send-offs from the fielding side. */
export function pickSledges(fieldingAbbr, batterName, count) {
  const pool = [...(fieldingAbbr === "AUS" ? AUSSIE_SLEDGES : ENGLISH_SLEDGES)];
  const lines = [];
  while (lines.length < count && pool.length) {
    lines.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].replace(/\{N\}/g, batterName.toUpperCase()));
  }
  return lines;
}
