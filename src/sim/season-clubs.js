import { makeTeam, look, bowler } from "./teams.js";
import { Rng } from "./rng.js";

/**
 * The season's clubs: eight made-up Melbourne club sides, each named for a real suburb with a nickname of
 * its own (none is a real club). Their players are made up too, drawn from name lists by each club's seed, so
 * a club is the same squad every time it's built. Each is a function that builds the squad, like
 * sim/team-list.js's teams.
 */

const FIRST = [
  "Jack",
  "Tom",
  "Liam",
  "Sam",
  "Ben",
  "Josh",
  "Matt",
  "Nick",
  "Dan",
  "Luke",
  "Ryan",
  "Callum",
  "Harry",
  "Mitch",
  "Ollie",
  "Zac",
  "Jai",
  "Will",
  "Lachie",
  "Cooper",
  "Hamish",
  "Angus",
  "Rory",
  "Kai",
  "Ethan",
  "Raj",
  "Arjun",
  "Dev",
  "Nikhil",
  "Imran",
  "Hassan",
  "Theo",
  "Nico",
  "Marco",
  "Luca",
  "Tariq",
  "Kieran",
  "Aiden",
  "Jordan",
  "Brody",
];
const LAST = [
  "Hollis",
  "Carver",
  "Bramble",
  "Whitford",
  "Dunmore",
  "Kettle",
  "Ashby",
  "Linden",
  "Fairweather",
  "Quill",
  "Rowe",
  "Pemberton",
  "Stokely",
  "Garrick",
  "Mallory",
  "Tindall",
  "Barlow",
  "Crosby",
  "Ellery",
  "Fenwick",
  "Gideon",
  "Harwood",
  "Ingram",
  "Jessop",
  "Kinsella",
  "Larkin",
  "Marchetti",
  "Nayar",
  "Okafor",
  "Patel",
  "Quinlan",
  "Rasheed",
  "Sinclair",
  "Thorne",
  "Underwood",
  "Vance",
  "Wexley",
  "Yardley",
  "Zappa",
  "Costa",
  "Doyle",
  "Ferraro",
  "Grady",
  "Haddad",
  "Iyer",
  "Kowalski",
  "Lucas",
  "Mendez",
  "Nguyen",
  "O'Brien",
  "Petrakis",
  "Romano",
  "Shah",
  "Tran",
];
const SKINS = ["fair", "light", "light", "olive", "tan", "brown", "dark"];
const HAIRS = ["black", "darkBrown", "brown", "lightBrown", "sandy", "ginger"];
const STYLES = ["short", "short", "buzz", "curly", "long"];
const BEARDS = ["none", "none", "stubble", "full", "moustache"];
const BUILDS = ["slim", "average", "average", "stocky"];

/** A side's shape: role and bowling for each of the eleven, in batting order. */
const SHAPE = [
  { role: "opener" },
  { role: "opener" },
  { role: "top" },
  { role: "middle" },
  { role: "keeper", keeper: true },
  { role: "allround", bowl: ["medium", "offspin", "legspin"] },
  { role: "allround", bowl: ["medium", "swing", "offspin"] },
  { role: "tail", bowl: ["offspin", "legspin", "medium"] },
  { role: "tail", bowl: ["fast", "swing", "medium"] },
  { role: "bunny", bowl: ["fast", "swing"] },
  { role: "bunny", bowl: ["fast", "medium"] },
];

/**
 * Club pace: their fastest about 115-125 km/h, a swing bowler 110-120, a medium-pacer 100-112, the
 * spinners a little slower than the internationals'. Varied by player, but not from the roster's dice,
 * so the squads (names and all) stay as they were.
 */
const CLUB_KMH = { fast: [115, 125], swing: [110, 120], medium: [100, 112] };
const clubVary = (seed, i) => ((seed * 31 + i * 17) % 100) / 100;

/** The eleven of a club, from its seed. Club cricketers: a little below the internationals. */
function roster(seed) {
  const rng = new Rng(seed);
  const pick = (list) => list[Math.floor(rng.next() * list.length)];
  const used = new Set();
  return SHAPE.map((slot, i) => {
    let name;
    do name = `${pick(FIRST)} ${pick(LAST)}`;
    while (used.has(name.split(" ")[1]));
    used.add(name.split(" ")[1]);
    const style = slot.bowl ? pick(slot.bowl) : null;
    const left = rng.next() < 0.25;
    return {
      name,
      hand: left ? "left" : "right",
      look: look(
        1.68 + rng.next() * 0.26,
        pick(SKINS),
        pick(HAIRS),
        pick(STYLES),
        pick(BEARDS),
        1 + i * 3 + Math.floor(rng.next() * 3),
        [],
        pick(BUILDS),
      ),
      role: slot.role,
      keeper: slot.keeper,
      flair: Math.round(rng.next() * 30) / 100,
      bowl: style
        ? bowler(style, 0.45 + rng.next() * 0.35, {
            ...(style === "offspin" && rng.next() < 0.3 ? { arm: "left" } : {}),
            ...(CLUB_KMH[style]
              ? { kmh: CLUB_KMH[style][0] + (CLUB_KMH[style][1] - CLUB_KMH[style][0]) * clubVary(seed, i) }
              : { pace: 0.1 + 0.15 * clubVary(seed, i) }),
          })
        : undefined,
    };
  });
}

/** [id, name, abbreviation, colour, second colour, seed]. */
const CLUB_LIST = [
  ["BRK", "BRUNSWICK LARRIKINS", "BRK", "#2b2b2b", "#e8e1cf", 501],
  ["STK", "ST KILDA SANDPIPERS", "STK", "#1e5fa8", "#f2d16b", 502],
  ["FTY", "FOOTSCRAY FOUNDRY", "FTY", "#8a2e1c", "#d9a441", 503],
  ["CAM", "CAMBERWELL KOOKABURRAS", "CAM", "#2f6b3a", "#c9b27c", 504],
  ["BOX", "BOX HILL IRONBARKS", "BOX", "#5b3a29", "#9fc4a8", 505],
  ["FRK", "FRANKSTON STINGRAYS", "FRK", "#126b77", "#f08a4b", 506],
  ["WIL", "WILLIAMSTOWN WHARFIES", "WIL", "#23345c", "#e04f3a", 507],
  ["DAN", "DANDENONG REDGUMS", "DAN", "#9b2335", "#efe3c2", 508],
];

/** Every club, by id: each a function that builds its squad. */
export const CLUBS = Object.fromEntries(
  CLUB_LIST.map(([id, name, abbr, colour, colour2, seed]) => [
    id,
    () => makeTeam(name, abbr, colour, colour2, seed, roster(seed)),
  ]),
);
export const CLUB_IDS = Object.keys(CLUBS);
/** A club's name without building it. */
export const CLUB_NAMES = Object.fromEntries(CLUB_LIST.map(([id, name]) => [id, name]));
