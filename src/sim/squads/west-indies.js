import { makeTeam, look, bowler } from "../teams.js";

/**
 * The West Indies: a grafting opener and an elegant keeper at the top, left-handed power in the middle, a
 * towering all-rounder, a left-arm spinner, and three quicks: one who swings it, two who are simply fast.
 */
export function westIndies() {
  return makeTeam("WEST INDIES", "WI", "#7b1b30", "#f2b51c", 707, [
    {
      name: "Kraig Braithwhite",
      look: look(1.75, "dark", "black", "buzz", "stubble", 75),
      nick: "Braith",
      role: "opener",
    },
    {
      name: "Brandon Kinge",
      look: look(1.8, "dark", "black", "short", "none", 53),
      nick: "BK",
      role: "opener",
      flair: 0.25,
    },
    {
      name: "Shai Hoap",
      look: look(1.77, "dark", "black", "buzz", "stubble", 4),
      nick: "Shai",
      role: "keeper",
      keeper: true,
      flair: 0.1,
    },
    {
      name: "Nicholas Poorun",
      hand: "left",
      look: look(1.73, "brown", "black", "short", "full", 29),
      nick: "Nicky P",
      role: "middle",
      flair: 0.35,
      blade: { weight: 1.33, edges: 44, handle: "short" },
    },
    {
      name: "Shimron Hetmeyer",
      hand: "left",
      look: look(1.7, "dark", "black", "curly", "stubble", 18, ["sunglasses"]),
      nick: "Hetty",
      role: "middle",
      flair: 0.3,
    },
    {
      name: "Roston Chace",
      look: look(1.78, "dark", "black", "buzz", "full", 14),
      nick: "Chasey",
      role: "allround",
      bowl: bowler("offspin", 0.62),
    },
    {
      name: "Jason Holda",
      look: look(2.01, "dark", "black", "buzz", "full", 98, [], "slim"),
      nick: "Big Jase",
      role: "allround",
      bowl: bowler("medium", 0.8, { accuracy: 0.86 }),
    },
    {
      name: "Gudakesh Motey",
      look: look(1.75, "tan", "black", "short", "stubble", 72),
      nick: "Motey",
      role: "tail",
      bowl: bowler("offspin", 0.72, { arm: "left" }),
    },
    {
      name: "Alzarri Josephs",
      look: look(1.91, "dark", "black", "short", "none", 7, [], "slim"),
      nick: "Alzarri",
      role: "tail",
      bowl: bowler("fast", 0.8),
    },
    {
      name: "Kemar Roache",
      look: look(1.8, "dark", "black", "buzz", "stubble", 39, [], "stocky"),
      nick: "Roachy",
      role: "bunny",
      bowl: bowler("swing", 0.78, { accuracy: 0.84 }),
    },
    {
      name: "Shamar Jozef",
      look: look(1.83, "dark", "black", "short", "none", 85),
      nick: "Shamar",
      role: "bunny",
      bowl: bowler("fast", 0.84, { pace: 0.94 }),
    },
  ]);
}
