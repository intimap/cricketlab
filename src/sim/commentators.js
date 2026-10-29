import { MOMENT_LINES } from "./booth-lines.js";
import { CHAT_TOPICS, CHAT_REPLIES } from "./booth-chat.js";
import { PACK_MOMENTS, packContext } from "./pack-voice.js";

/**
 * The commentary box: three voices who take turns at the microphone, an over
 * each. The man on duty calls every ball (mostly from the commentary pack,
 * see pack-voice.js); another may follow with the moment or a reaction.
 * Placeholders: {b} batter, {w} bowler, {f} fielder, {duty} the first name of
 * whoever is on the microphone.
 */
export const COMMENTATORS = [
  {
    id: "bunnings",
    name: "RICHIE BUNNINGS",
    first: "RICHIE",
    lines: {
      wicket: [
        "GOT HIM. {w} WILL BE QUIETLY PLEASED WITH THAT.",
        "AND THAT'S THE END OF {b}. A SHOT HE'D LIKE BACK.",
        "OUT. MARVELLOUS BOWLING, THAT.",
        "{b} GOES. I DON'T THINK I NEED TO ADD ANYTHING.",
      ],
      six: [
        "UP... AND INTO THE CROWD. MARVELLOUS.",
        "THAT'S GONE A VERY LONG WAY. SIX.",
        "{b} HAS PUT THAT IN THE SECOND TIER. DELIGHTFUL.",
      ],
      four: ["FOUR. AND NOBODY MOVED.", "CRISPLY STRUCK. FOUR.", "A LOVELY SHOT. THE FIELDERS SIMPLY WATCHED IT GO."],
      beaten: [
        "BEATEN. QUITE BEAUTIFULLY.",
        "PAST THE EDGE. {w} MIGHT ALLOW HIMSELF A SMILE.",
        "THAT ONE LEFT HIM. LOVELY BOWLING.",
      ],
      dropped: ["OH DEAR. {f} WILL BE HEARING ABOUT THAT ONE.", "DOWN. THAT COULD BE AN EXPENSIVE MOMENT."],
      quiet: [
        "A QUIET PASSAGE. THE SEAGULLS ARE ENJOYING IT.",
        "NOTHING HAPPENING. SOMETIMES THAT'S THE BEST THING IN CRICKET.",
        "THE SHADOWS ARE LENGTHENING. MARVELLOUS LIGHT.",
      ],
    },
  },
  {
    id: "lorry",
    name: "BILL LORRY",
    first: "BILL",
    lines: {
      wicket: ["GOT HIM! YES! GOT HIM!", "HE'S GONE! {b}'S GONE! WHAT A MOMENT!", "OUT! OUT! THE CROWD IS GOING BERSERK!"],
      six: ["IT'S A SIX! IT'S GONE ALL THE WAY! OH MY WORD!", "BANG! UP INTO THE STANDS! WHAT A HIT!"],
      four: ["FOUR! CRACKED AWAY! WHAT A SHOT!", "THAT'S RACED AWAY! THEY'LL NEVER CATCH THAT!"],
      beaten: ["OH! JUST MISSED! WHAT A DELIVERY!", "BEATEN! BEATEN ALL ENDS UP!"],
      dropped: ["OH NO! HE'S DROPPED IT! HE'S PUT IT DOWN!", "DROPPED! I CAN'T BELIEVE IT!"],
      quiet: [
        "I'VE BEEN WATCHING THE PIGEONS DOWN AT FINE LEG. LOVELY BIRDS.",
        "IT'S ALL HAPPENING! WELL, NOT RIGHT NOW. BUT IT WILL!",
      ],
    },
    // Lines for barging in on someone else's over when a wicket falls.
    jumpIn: ["GOT HIM! YES! SORRY {duty}, GOT HIM!", "HE'S GONE! YES! I HAD TO SAY IT!", "OUT! YES! WHAT A MOMENT!"],
  },
  {
    id: "grog",
    name: "TONY GROG",
    first: "TONY",
    lines: {
      wicket: [
        "AND {w} HAS DONE HIM. THAT'S A MASSIVE BLOW.",
        "{b} IS ON HIS WAY. I SAID THIS MORNING THE PITCH WOULD DO IT.",
        "THAT'S THE BREAKTHROUGH. RIGHT WHEN THEY NEEDED IT.",
      ],
      six: ["THAT IS HUGE! RIGHT OUT OF THE GROUND!", "OH, HE'S MURDERED THAT ONE!"],
      four: ["SUPERB. THE TIMING IS SWEET AS YOU LIKE.", "FOUR. THROUGH THE GAP LIKE A SPORTS CAR."],
      beaten: ["BEATEN! THAT'S DONE A LITTLE OFF THE SEAM.", "NEARLY THROUGH THE GATE. LOOK AT THAT MOVEMENT."],
      dropped: ["OH, THAT'S A SITTER! MY GRANDMOTHER HOLDS THAT.", "DROPPED. THAT COULD COST THEM DEARLY."],
      quiet: [
        "LET'S HAVE A LOOK AT THE PITCH. I'VE GOT MY CAR KEY HERE.",
        "THE PITCH IS HOLDING UP NICELY. NOT A CRACK TO LOSE A KEY IN.",
      ],
    },
    sixSpecial: "MIND THE WINDOWS, TINO!",
  },
];

const LORRY = 1;
const GROG = 2;
/** How often Lorry barges in on a wicket in someone else's over. */
const LORRY_JUMPS_IN = 0.3;
/** Share of sixes Tony claims for his catchphrase, whoever is on. */
const GROG_SIX_SHARE = 0.3;
/** How often the box talks between overs. */
const CHAT_CHANCE = 0.7;

const NUMBER_WORDS = ["NO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];

/** Lines used lately, so the box doesn't repeat itself. */
const recent = [];
const RECENT_LINES = 40;

function pickFresh(lines, rng) {
  const fresh = lines.filter((l) => !recent.includes(l));
  const line = rng.pick(fresh.length ? fresh : lines);
  recent.push(line);
  if (recent.length > RECENT_LINES) recent.shift();
  return line;
}

/** A joke (Commentary.joke) as booth calls. */
export function boothJoke(joke) {
  if (!joke) return [];
  return joke.map(([id, text]) => ({ who: COMMENTATORS.findIndex((c) => c.id === id), text }));
}

/**
 * Talk between overs, once the over is done: the next over's voice raises
 * something (Commentary.chatTopic) and another answers. A list of { who, text }, often empty.
 */
export function boothChat(comm, inn, rng) {
  if (!rng.chance(CHAT_CHANCE)) return [];
  const chat = comm.chatTopic(inn);
  if (!chat) return [];
  let lead = inn.overNo % COMMENTATORS.length;
  let text;
  if (chat.topic === "joke") return boothJoke(comm.joke());
  if (chat.topic === "story") {
    // Whoever still has a story to tell.
    const tellers = [lead, (lead + 1) % 3, (lead + 2) % 3];
    for (const who of tellers) {
      text = comm.story(COMMENTATORS[who].id);
      if (text) {
        lead = who;
        break;
      }
    }
    if (!text) return [];
  } else {
    const f = chat.facts;
    text = pickFresh(CHAT_TOPICS[chat.topic][COMMENTATORS[lead].id], rng)
      .replace(/\{b\}/g, f.b ?? "")
      .replace(/\{p\}/g, f.p ?? "")
      .replace(/\{w\}/g, f.w ?? "")
      // Fielders are known by where they stand.
      .replace(/\{f\}/g, !f.f ? "THE FIELDER" : f.f.startsWith("the ") ? f.f : `THE MAN AT ${f.f}`)
      .replace(/\{zone\}/g, f.zone ?? "")
      .replace(/\{figs\}/g, f.figs ?? "")
      .replace(/\{overs\}/g, String(f.overs ?? ""))
      .replace(/\{need\}/g, String(f.need ?? ""))
      .replace(/\{left\}/g, String(f.left ?? ""))
      .replace(/\{balls\}/g, String(f.balls ?? ""))
      .replace(/\{n\}/g, String(f.n ?? ""))
      .replace(/\{r\}/g, String(f.r ?? ""))
      .toUpperCase();
  }
  const next = (lead + 1 + (rng.chance(0.5) ? 1 : 0)) % COMMENTATORS.length;
  const replies = CHAT_REPLIES[COMMENTATORS[next].id];
  const mood = chat.topic === "story" ? "story" : CHAT_TOPICS[chat.topic].mood;
  const reply = pickFresh(replies[chat.topic] ?? replies[mood], rng).replace(/\{prev\}/g, COMMENTATORS[lead].first);
  return [
    { who: lead, text },
    { who: next, text: reply },
  ];
}

/** How often a commentator reacts after the call of an ordinary ball (the pack suggests about one in seven). */
const REACTION_CHANCE = 0.15;

/** Which of a commentator's own reaction lines suit this ball, if any. */
function ownReaction(rec) {
  if (rec.wicket) return "wicket";
  // A drop on a no-ball or free hit wouldn't have been out, so no "dropped" lines then.
  if (rec.dropped) return rec.freeHit || rec.extra.type === "nb" ? null : "dropped";
  if (rec.boundary === 6) return "six";
  if (rec.boundary === 4) return "four";
  if (rec.beatBat) return "beaten";
  // A ball where nothing happened gets a quiet aside.
  if (rec.total === 0 && !rec.extra.type && !rec.padVerdict) return "quiet";
  return null;
}

/**
 * Who speaks after a ball, and what they say: { calls, picks }. `calls` is a
 * list of { who, text } in speaking order: the man on duty calls the ball (a
 * commentary pack line, or `plain`, the score bar's call, when the pack has
 * nothing for it), and a second voice may follow with the moment or a
 * reaction. `picks` are the pack lines used, for PackVoice.said() once on air.
 * `names` fills placeholders; `fits` says whether a line fits the box.
 */
export function boothCall(rec, plain, names, rng, pack, fits) {
  const duty = rec.over % COMMENTATORS.length;
  const random = () => rng.random();
  const ctx = packContext(rec, { b: names.batter, w: names.bowler });
  const fill = (text) =>
    text
      .replace(/\{b\}/g, names.batter)
      .replace(/\{w\}/g, names.bowler)
      .replace(/\{f\}/g, names.fielder || "THE FIELDER")
      .replace(/\{n\}/g, String(rec.moment?.n ?? ""))
      .replace(/\{k\}/g, NUMBER_WORDS[rec.moment?.k] ?? String(rec.moment?.k ?? ""))
      .replace(/\{duty\}/g, COMMENTATORS[duty].first)
      .toUpperCase();

  const primary = pack.choose("ball_calls", ctx, { random, relax: true, fits });
  const calls = [{ who: duty, text: (primary?.text ?? plain).toUpperCase() }];
  const picks = primary ? [primary] : [];

  // The second voice: one of the other two, either way round.
  const others = rng.chance(0.5) ? [(duty + 1) % 3, (duty + 2) % 3] : [(duty + 2) % 3, (duty + 1) % 3];
  const fromPack = (bank, voices) => {
    for (const who of voices) {
      const pick = pack.choose(bank, ctx, { speaker: COMMENTATORS[who].id, random, fits });
      if (pick) return { who, pick };
    }
    return null;
  };
  const second = (() => {
    const kind = rec.moment?.kind;
    // The moment: the pack's line for it, or the box's own for the moments the pack doesn't cover.
    if (kind && PACK_MOMENTS.has(kind)) {
      const said = fromPack("match_context", [...others, duty]);
      if (said) {
        picks.push(said.pick);
        return { who: said.who, text: said.pick.text.toUpperCase() };
      }
    } else if (kind && MOMENT_LINES[kind]) {
      return { who: others[0], text: fill(pickFresh(MOMENT_LINES[kind][COMMENTATORS[others[0]].id], rng)) };
    }
    // Lorry can't help himself on a wicket, and Tony has a line for sixes.
    if (rec.wicket && duty !== LORRY && rng.chance(LORRY_JUMPS_IN))
      return { who: LORRY, text: fill(pickFresh(COMMENTATORS[LORRY].jumpIn, rng)) };
    if (rec.boundary === 6 && rng.chance(GROG_SIX_SHARE)) return { who: GROG, text: COMMENTATORS[GROG].sixSpecial };
    // Now and then, a reaction: the pack's, or failing that the commentator's own.
    if (!rng.chance(REACTION_CHANCE)) return null;
    const said = fromPack("commentator_lines", others);
    if (said) {
      picks.push(said.pick);
      return { who: said.who, text: said.pick.text.toUpperCase() };
    }
    const own = ownReaction(rec);
    return own ? { who: others[0], text: fill(pickFresh(COMMENTATORS[others[0]].lines[own], rng)) } : null;
  })();
  if (second) calls.push(second);
  return { calls, picks };
}
