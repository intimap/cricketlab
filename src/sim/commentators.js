import { CHAT_TOPICS, CHAT_REPLIES } from "./booth-chat.js";
export { editBoothCall as boothCall } from "./booth-editor.js";

/**
 * The commentary box: three voices who take turns at the microphone, an over
 * each. booth-editor.js combines a call on every ball with optional contextual analysis;
 * the original voice data and chat helpers remain available to existing callers.
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

/** How often the legacy between-over chat helper is used. */
const CHAT_CHANCE = 0.7;

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
