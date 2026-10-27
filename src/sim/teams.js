import { clamp } from "../math.js";
import { Rng } from "./rng.js";
import { pickWeakness } from "./plans.js";

// Average batting skill by role; individual ratings are drawn around it.
const ROLE_BASE = { opener: 0.74, top: 0.78, middle: 0.72, keeper: 0.62, allround: 0.58, tail: 0.36, bunny: 0.22 };

function battingSkills(rng, role, flair = 0) {
  const base = ROLE_BASE[role];
  const skill = (bonus = 0, sd = 0.07) => clamp(rng.normal(base + bonus, sd), 0.08, 0.97);
  const aggression = role === "opener" ? 0.38 : role === "tail" || role === "bunny" ? 0.6 : 0.5;
  return {
    timing: skill(0.02),
    technique: skill(role === "opener" ? 0.05 : 0),
    defence: skill(role === "opener" ? 0.06 : 0),
    aggression: clamp(rng.normal(aggression + flair, 0.1), 0.1, 0.95),
    power: clamp(rng.normal(0.55 + flair * 0.6, 0.12), 0.2, 0.95),
    footwork: skill(),
    vsPace: skill(),
    vsSpin: skill(),
    temperament: skill(0, 0.1),
    concentration: skill(0, 0.1),
    running: clamp(rng.normal(0.55, 0.15), 0.15, 0.95),
  };
}

function fieldingSkills(rng, keeper = false) {
  const skill = (mean = 0.6, sd = 0.12) => clamp(rng.normal(mean, sd), 0.15, 0.97);
  return {
    catching: skill(keeper ? 0.82 : 0.66),
    speed: skill(0.6),
    reflexes: skill(keeper ? 0.8 : 0.6),
    throwAcc: skill(0.62),
    arm: skill(0.6),
    keeping: keeper ? skill(0.8, 0.06) : 0.2,
  };
}

const BOWLING_STYLES = {
  fast: {
    pace: 0.88,
    accuracy: 0.68,
    swing: 0.45,
    seam: 0.82,
    spin: 0,
    stamina: 0.62,
    recovery: 0.55,
    consistency: 0.65,
    resilience: 0.7,
    repertoire: ["seam", "outswing", "inswing", "bouncer", "yorker", "slower"],
  },
  swing: {
    pace: 0.7,
    accuracy: 0.78,
    swing: 0.88,
    seam: 0.62,
    spin: 0,
    stamina: 0.72,
    recovery: 0.65,
    consistency: 0.72,
    resilience: 0.65,
    repertoire: ["outswing", "inswing", "seam", "yorker", "slower"],
  },
  medium: {
    pace: 0.5,
    accuracy: 0.8,
    swing: 0.55,
    seam: 0.66,
    spin: 0,
    stamina: 0.85,
    recovery: 0.75,
    consistency: 0.78,
    resilience: 0.6,
    repertoire: ["seam", "outswing", "inswing", "cutter", "slower"],
  },
  offspin: {
    pace: 0.4,
    accuracy: 0.82,
    swing: 0.05,
    seam: 0.2,
    spin: 0.75,
    stamina: 0.92,
    recovery: 0.85,
    consistency: 0.75,
    resilience: 0.65,
    repertoire: ["offspin", "armBall", "seam"],
  },
  legspin: {
    pace: 0.38,
    accuracy: 0.68,
    swing: 0.05,
    seam: 0.15,
    spin: 0.88,
    stamina: 0.88,
    recovery: 0.8,
    consistency: 0.6,
    resilience: 0.7,
    repertoire: ["legspin", "googly", "seam"],
  },
};

/** Skin tones and hair colours for player looks (render colours, kept here with the squads). */
const SKIN = {
  fair: "#efc3a0",
  light: "#e2ab85",
  olive: "#c99068",
  tan: "#b37a52",
  brown: "#8d5a3b",
  dark: "#5e3a24",
};
const HAIR = {
  black: "#1c1714",
  darkBrown: "#33241a",
  brown: "#5a3d26",
  lightBrown: "#82603f",
  sandy: "#c4a062",
  ginger: "#b05a2c",
  grey: "#9a958c",
};

/**
 * How a player looks on screen: height (m), skin tone, hair colour and style
 * (short, buzz, curly, long, bald), facial hair (none, stubble, moustache,
 * full) and shirt number.
 */
function look(height, skin, hair, hairStyle, beard, number) {
  return { height, skin: SKIN[skin], hair: HAIR[hair], hairStyle, beard, number };
}

const DEFAULT_LOOK = look(1.82, "light", "brown", "short", "none", 0);

/** Bowling skills from a style template, scaled by `quality` (0..1) and then overridden. */
function bowler(style, quality, overrides = {}) {
  const s = { style, ...BOWLING_STYLES[style], ...overrides };
  const scale = (v) => clamp(v * (0.85 + 0.3 * quality), 0.05, 0.98);
  return { ...s, accuracy: scale(s.accuracy), swing: scale(s.swing), seam: scale(s.seam), spin: scale(s.spin) };
}

function makeTeam(name, abbr, colour, colour2, seed, roster) {
  const rng = new Rng(seed);
  // Weaknesses come from their own stream so they don't disturb the ratings.
  const quirks = new Rng(seed * 31 + 7);
  const players = roster.map((p) => {
    const words = p.name.split(" ");
    return {
      name: p.name,
      short: p.short ?? words[words.length - 1],
      nick: p.nick,
      bat: battingSkills(rng, p.role, p.flair),
      bowl: p.bowl,
      field: fieldingSkills(rng, p.keeper),
      keeper: p.keeper,
      weakness: pickWeakness(p.role, quirks),
      look: p.look ?? DEFAULT_LOOK,
    };
  });
  return { name, abbr, colour, colour2, players: players.slice(0, 11), reserves: players.slice(11) };
}

export function australia() {
  return makeTeam("AUSTRALIA", "AUS", "#1f6b3a", "#f2c230", 101, [
    { name: "Osman Kawaga", look: look(1.77, "tan", "black", "short", "full", 1), nick: "Uzzy", role: "opener" },
    { name: "Trevor Hearn", look: look(1.83, "light", "brown", "short", "none", 23), nick: "Hearny", role: "opener", flair: 0.1 },
    {
      name: "Marcus La Bonshane",
      look: look(1.78, "light", "darkBrown", "short", "stubble", 33),
      nick: "Bonny",
      role: "top",
      short: "La Bonshane",
    },
    {
      name: "Stan Smoth",
      look: look(1.74, "light", "darkBrown", "short", "none", 49),
      nick: "Smudge",
      role: "top",
      bowl: bowler("legspin", 0.15, { spin: 0.55, accuracy: 0.55, stamina: 0.6 }),
    },
    { name: "Marty Renclaw", look: look(1.93, "fair", "lightBrown", "short", "none", 77), nick: "Renny", role: "middle" },
    {
      name: "Camden Greenwich",
      look: look(1.98, "fair", "lightBrown", "short", "none", 25),
      nick: "Greeny",
      role: "allround",
      flair: 0.1,
      bowl: bowler("medium", 0.55, { pace: 0.66 }),
    },
    { name: "Allan Corey", look: look(1.78, "light", "brown", "short", "full", 4), nick: "Corey", role: "keeper", keeper: true },
    {
      name: "Pete Crimmins",
      look: look(1.92, "light", "darkBrown", "short", "stubble", 30),
      nick: "Crims",
      role: "tail",
      bowl: bowler("fast", 0.85, { pace: 0.88 }),
    },
    {
      name: "Jock Hazlenut",
      look: look(1.96, "fair", "brown", "buzz", "stubble", 38),
      nick: "Nutty",
      role: "tail",
      bowl: bowler("swing", 0.85, { pace: 0.76, accuracy: 0.9 }),
    },
    {
      name: "Michael Stork",
      look: look(1.97, "fair", "sandy", "short", "none", 56),
      nick: "Storky",
      role: "tail",
      flair: 0.15,
      bowl: bowler("fast", 0.8, { pace: 0.93 }),
    },
    {
      name: "Nate Lewins",
      look: look(1.81, "fair", "brown", "bald", "stubble", 67),
      nick: "Lewo",
      role: "bunny",
      bowl: bowler("offspin", 0.8),
    },
    // Reserves
    {
      name: "Travis Headley",
      look: look(1.79, "fair", "ginger", "short", "moustache", 62),
      nick: "Heady",
      role: "middle",
      flair: 0.2,
      bowl: bowler("offspin", 0.1, { spin: 0.5, accuracy: 0.6 }),
    },
    {
      name: "Scott Bowland",
      look: look(1.88, "brown", "black", "short", "stubble", 18),
      nick: "Bolly",
      role: "bunny",
      bowl: bowler("swing", 0.75, { pace: 0.7 }),
    },
    {
      name: "Beau Websterly",
      look: look(2.0, "fair", "brown", "short", "full", 32),
      nick: "Webby",
      role: "allround",
      bowl: bowler("medium", 0.5),
    },
    {
      name: "Josh Ingleson",
      look: look(1.75, "light", "brown", "short", "full", 48),
      nick: "Ingo",
      role: "keeper",
      flair: 0.15,
      keeper: true,
    },
  ]);
}

export function england() {
  return makeTeam("ENGLAND", "ENG", "#1d2f6f", "#c8102e", 202, [
    {
      name: "Zach Crawley",
      look: look(1.96, "fair", "lightBrown", "short", "none", 16),
      nick: "Creepy",
      role: "opener",
      flair: 0.1,
    },
    {
      name: "Benny Dackett",
      look: look(1.7, "fair", "brown", "short", "stubble", 17),
      nick: "Ducky",
      role: "opener",
      flair: 0.2,
    },
    { name: "Ollie Popes", look: look(1.75, "light", "darkBrown", "short", "none", 80), nick: "Popey", role: "top" },
    {
      name: "Joey Rutt",
      look: look(1.83, "fair", "brown", "short", "none", 66),
      nick: "Rutty",
      role: "top",
      bowl: bowler("offspin", 0.3, { spin: 0.6, accuracy: 0.72, stamina: 0.75 }),
    },
    {
      name: "Harry Brookes",
      look: look(1.83, "light", "brown", "short", "none", 88),
      nick: "Brooky",
      role: "middle",
      flair: 0.2,
    },
    {
      name: "Benny Stokeson",
      look: look(1.85, "fair", "ginger", "short", "full", 55),
      nick: "Stokesy",
      role: "allround",
      flair: 0.15,
      bowl: bowler("fast", 0.6, { pace: 0.8, stamina: 0.5 }),
    },
    {
      name: "Jamie Smithey",
      look: look(1.8, "fair", "brown", "short", "none", 59),
      nick: "Smithy",
      role: "keeper",
      flair: 0.15,
      keeper: true,
    },
    {
      name: "Chris Woakesley",
      look: look(1.85, "fair", "brown", "short", "stubble", 19),
      nick: "Woaksey",
      role: "allround",
      bowl: bowler("swing", 0.7),
    },
    {
      name: "Gus Atkinsonne",
      look: look(1.88, "light", "darkBrown", "curly", "none", 37),
      nick: "Gussie",
      role: "tail",
      bowl: bowler("fast", 0.8, { pace: 0.88 }),
    },
    {
      name: "Joffrey Archard",
      look: look(1.88, "dark", "black", "buzz", "stubble", 22),
      nick: "Archie",
      role: "tail",
      bowl: bowler("fast", 0.85, { pace: 0.93 }),
    },
    {
      name: "Mark Woot",
      look: look(1.78, "fair", "brown", "bald", "full", 33),
      nick: "Woody",
      role: "bunny",
      bowl: bowler("fast", 0.75, { pace: 0.97, stamina: 0.5 }),
    },
    // Reserves
    {
      name: "Ollie Stoney",
      look: look(1.88, "fair", "brown", "short", "full", 24),
      nick: "Stoney",
      role: "tail",
      bowl: bowler("fast", 0.7, { pace: 0.9 }),
    },
    {
      name: "Shoaib Bashley",
      look: look(1.93, "brown", "black", "short", "full", 61),
      nick: "Bash",
      role: "bunny",
      bowl: bowler("offspin", 0.7),
    },
    {
      name: "Jacob Betham",
      look: look(1.88, "fair", "sandy", "short", "none", 34),
      nick: "Beth",
      role: "allround",
      flair: 0.1,
      bowl: bowler("legspin", 0.45),
    },
    {
      name: "Brydon Carson",
      look: look(1.9, "fair", "brown", "long", "stubble", 92),
      nick: "Carsey",
      role: "tail",
      bowl: bowler("fast", 0.7, { pace: 0.88 }),
    },
  ]);
}

export const isSpinner = (skills) => !!skills && (skills.style === "offspin" || skills.style === "legspin");

/** Release speed in m/s. */
export function bowlingSpeed(skills) {
  return isSpinner(skills) ? 21 + 4.5 * skills.pace : 29 + 12.5 * skills.pace;
}
