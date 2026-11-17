import { TEAMS } from "../sim/team-list.js";
import { CLUBS, CLUB_NAMES } from "../sim/season-clubs.js";
import { COMMENTATORS } from "../sim/commentators.js";
import { GROUNDS } from "./grounds.js";

/**
 * The commentary set in sentences. Its lines are written (and matched, and tested) in capitals; this turns
 * one into ordinary upper and lower case as it's drawn: a capital to start each sentence, and on the names
 * of players, teams, clubs, grounds and their ends, the commentators, and a few words that are always
 * written large. Only letters' case changes, so a line keeps its length (it's typed out a letter at a time).
 */

/** Written in capitals whatever's round them. */
const ACRONYMS = ["LBW", "DRS", "TV", "T20", "ODI", "MCG", "SCG", "OK", "DJ", "KG", "BK", "DDS", "UK", "NZ", "SA", "WI", "SL"];
/** Proper words that aren't anyone's name here. */
const ALWAYS = [
  ..."MELBOURNE SYDNEY LONDON AUSTRALIAN ENGLISH INDIAN PAKISTANI KIWI KIWIS AUSSIE AUSSIES ASHES".split(" "),
  ..."SOUTH AFRICAN SRI LANKAN WEST INDIAN NEW ZEALANDER HIMALAYAS CHRISTMAS".split(" ").filter((w) => w.length > 5),
  ..."MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY SUNDAY".split(" "),
];
/** Nicknames and short names that are ordinary words more often than they're the player. */
const ORDINARY = new Set([
  "BOOM",
  "P",
  "CREEPY",
  "NUTTY",
  "SILVER",
  "THE",
  "OF",
  "END",
  "ST",
  "BOX",
  "HILL",
  "NEW",
  "LA",
  "DE",
  "BIG",
]);

/** A name in capitals as it's written: Woakesley, O'Brien, La Bonshane, St Kilda. */
function titled(name) {
  return name
    .toLowerCase()
    .replace(/(^|[\s\-(])([a-z])/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\b([A-Z])'([a-z])(?=[a-z]{2})/g, (_, a, b) => `${a}'${b.toUpperCase()}`);
}

let known = null;
/** Every name the commentary might say: single words, and names of several words (longest first). */
function names() {
  if (known) return known;
  const words = new Set(ALWAYS);
  const phrases = new Set(["SOUTH AFRICAN", "SRI LANKAN", "WEST INDIAN", "NEW ZEALANDER"]);
  const add = (name) => {
    const upper = name.toUpperCase().replace(/[()]/g, "").trim();
    if (!upper) return;
    if (upper.includes(" ")) phrases.add(upper);
    for (const w of upper.split(" ")) if (!ORDINARY.has(w) && !/^\d/.test(w)) words.add(w);
  };
  for (const make of [...Object.values(TEAMS), ...Object.values(CLUBS)]) {
    const team = make();
    add(team.name);
    for (const p of team.players) {
      // The commentary uses surnames and nicknames; first names are too often ordinary words (Will, Mark).
      add(p.short);
      if (p.nick) add(p.nick);
      phrases.add(p.name.toUpperCase());
    }
  }
  for (const name of Object.values(CLUB_NAMES)) {
    add(name);
    // The suburb without the nickname: St Kilda, Box Hill.
    const suburb = name.split(" ").slice(0, -1).join(" ");
    if (suburb.includes(" ")) phrases.add(suburb);
  }
  for (const g of Object.values(GROUNDS)) {
    add(g.name);
    // An end's own word is a name (Members, Randwick); "end" isn't, except as part of the whole.
    for (const end of g.ends ?? []) phrases.add(end.toUpperCase());
  }
  for (const c of COMMENTATORS) add(c.name);
  const acronyms = new Set([...ACRONYMS, ...Object.keys(TEAMS), ...Object.keys(CLUBS)]);
  const list = [...phrases]
    .sort((a, b) => b.length - a.length)
    .map((p) => [new RegExp(`\\b${p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), titled(p)]);
  known = { words, phrases: list, acronyms };
  return known;
}

/** A commentary line in ordinary upper and lower case (see the top of the file). */
export function sentenceCase(text) {
  // Asked for every frame while a line is up: the last few are kept.
  if (!done.has(text)) {
    if (done.size > 40) done.clear();
    done.set(text, recase(String(text)));
  }
  return done.get(text);
}
const done = new Map();

function recase(text) {
  const { words, phrases, acronyms } = names();
  let s = text.toLowerCase();
  s = s.replace(/[a-z0-9]+(?:'[a-z]+)*/g, (w) => {
    const upper = w.toUpperCase();
    if (acronyms.has(upper)) return upper;
    if (upper === "I" || /^I'(M|LL|VE|D)$/.test(upper)) return "I" + w.slice(1);
    // A name, or a name with 's after it.
    const bare = upper.endsWith("'S") && !words.has(upper) ? upper.slice(0, -2) : upper;
    return words.has(bare) ? titled(bare) + w.slice(bare.length) : w;
  });
  for (const [re, name] of phrases) s = s.replace(re, name);
  // A capital to start, and after each full stop, question or exclamation mark.
  return s.replace(/(^[^a-zA-Z0-9]*|[.!?]["')]*\s+["'(]*)([a-z])/g, (_, a, b) => a + b.toUpperCase());
}
