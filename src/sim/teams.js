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
    };
  });
  return { name, abbr, colour, colour2, players: players.slice(0, 11), reserves: players.slice(11) };
}

export function australia() {
  return makeTeam("AUSTRALIA", "AUS", "#1f6b3a", "#f2c230", 101, [
    { name: "Osman Kawaga", nick: "Uzzy", role: "opener" },
    { name: "Trevor Hearn", nick: "Hearny", role: "opener", flair: 0.1 },
    { name: "Marcus La Bonshane", nick: "Bonny", role: "top", short: "La Bonshane" },
    {
      name: "Stan Smoth",
      nick: "Smudge",
      role: "top",
      bowl: bowler("legspin", 0.15, { spin: 0.55, accuracy: 0.55, stamina: 0.6 }),
    },
    { name: "Marty Renclaw", nick: "Renny", role: "middle" },
    { name: "Camden Greenwich", nick: "Greeny", role: "allround", flair: 0.1, bowl: bowler("medium", 0.55, { pace: 0.66 }) },
    { name: "Allan Corey", nick: "Corey", role: "keeper", keeper: true },
    { name: "Pete Crimmins", nick: "Crims", role: "tail", bowl: bowler("fast", 0.85, { pace: 0.88 }) },
    { name: "Jock Hazlenut", nick: "Nutty", role: "tail", bowl: bowler("swing", 0.85, { pace: 0.76, accuracy: 0.9 }) },
    { name: "Michael Stork", nick: "Storky", role: "tail", flair: 0.15, bowl: bowler("fast", 0.8, { pace: 0.93 }) },
    { name: "Nate Lewins", nick: "Lewo", role: "bunny", bowl: bowler("offspin", 0.8) },
    // Reserves
    {
      name: "Travis Headley",
      nick: "Heady",
      role: "middle",
      flair: 0.2,
      bowl: bowler("offspin", 0.1, { spin: 0.5, accuracy: 0.6 }),
    },
    { name: "Scott Bowland", nick: "Bolly", role: "bunny", bowl: bowler("swing", 0.75, { pace: 0.7 }) },
    { name: "Beau Websterly", nick: "Webby", role: "allround", bowl: bowler("medium", 0.5) },
    { name: "Josh Ingleson", nick: "Ingo", role: "keeper", flair: 0.15, keeper: true },
  ]);
}

export function england() {
  return makeTeam("ENGLAND", "ENG", "#1d2f6f", "#c8102e", 202, [
    { name: "Zach Crawley", nick: "Creepy", role: "opener", flair: 0.1 },
    { name: "Benny Dackett", nick: "Ducky", role: "opener", flair: 0.2 },
    { name: "Ollie Popes", nick: "Popey", role: "top" },
    { name: "Joey Rutt", nick: "Rutty", role: "top", bowl: bowler("offspin", 0.3, { spin: 0.6, accuracy: 0.72, stamina: 0.75 }) },
    { name: "Harry Brookes", nick: "Brooky", role: "middle", flair: 0.2 },
    {
      name: "Benny Stokeson",
      nick: "Stokesy",
      role: "allround",
      flair: 0.15,
      bowl: bowler("fast", 0.6, { pace: 0.8, stamina: 0.5 }),
    },
    { name: "Jamie Smithey", nick: "Smithy", role: "keeper", flair: 0.15, keeper: true },
    { name: "Chris Woakesley", nick: "Woaksey", role: "allround", bowl: bowler("swing", 0.7) },
    { name: "Gus Atkinsonne", nick: "Gussie", role: "tail", bowl: bowler("fast", 0.8, { pace: 0.88 }) },
    { name: "Joffrey Archard", nick: "Archie", role: "tail", bowl: bowler("fast", 0.85, { pace: 0.93 }) },
    { name: "Mark Woot", nick: "Woody", role: "bunny", bowl: bowler("fast", 0.75, { pace: 0.97, stamina: 0.5 }) },
    // Reserves
    { name: "Ollie Stoney", nick: "Stoney", role: "tail", bowl: bowler("fast", 0.7, { pace: 0.9 }) },
    { name: "Shoaib Bashley", nick: "Bash", role: "bunny", bowl: bowler("offspin", 0.7) },
    { name: "Jacob Betham", nick: "Beth", role: "allround", flair: 0.1, bowl: bowler("legspin", 0.45) },
    { name: "Brydon Carson", nick: "Carsey", role: "tail", bowl: bowler("fast", 0.7, { pace: 0.88 }) },
  ]);
}

export const isSpinner = (skills) => !!skills && (skills.style === "offspin" || skills.style === "legspin");

/** Release speed in m/s. */
export function bowlingSpeed(skills) {
  return isSpinner(skills) ? 21 + 4.5 * skills.pace : 29 + 12.5 * skills.pace;
}
