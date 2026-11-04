import { makeTeam, look, bowler } from "../teams.js";

/** Pakistan: an elegant top order round its captain, and fast bowlers of every kind, left-arm swing to raw pace. */
export function pakistan() {
  return makeTeam("PAKISTAN", "PAK", "#0b5d2a", "#f4f4f0", 505, [
    {
      name: "Saim Ayubb",
      hand: "left",
      look: look(1.8, "tan", "black", "short", "stubble", 88),
      nick: "Saim",
      role: "opener",
      flair: 0.2,
    },
    { name: "Abdullah Shafiq", look: look(1.78, "olive", "black", "short", "full", 52), nick: "Abdullah", role: "opener" },
    { name: "Babar Azim", look: look(1.8, "olive", "black", "short", "full", 56), nick: "Bobby", role: "top", flair: 0.15 },
    { name: "Shan Masud", hand: "left", look: look(1.85, "tan", "black", "short", "full", 94), nick: "Shan", role: "top" },
    { name: "Saud Shakil", hand: "left", look: look(1.72, "olive", "black", "short", "full", 76), nick: "Saud", role: "middle" },
    {
      name: "Mohammad Rizwaan",
      look: look(1.7, "tan", "black", "short", "full", 16),
      nick: "Rizzy",
      role: "keeper",
      keeper: true,
      flair: 0.1,
    },
    {
      name: "Agha Salmaan",
      look: look(1.78, "olive", "black", "short", "full", 74),
      nick: "Agha",
      role: "allround",
      bowl: bowler("offspin", 0.55),
    },
    {
      name: "Shaheen Afreedi",
      look: look(1.98, "light", "black", "short", "full", 10),
      nick: "Shaheen",
      role: "tail",
      bowl: bowler("fast", 0.9, { pace: 0.9, swing: 0.8, arm: "left" }),
    },
    {
      name: "Naseem Shaah",
      look: look(1.83, "olive", "black", "short", "none", 71),
      nick: "Naseem",
      role: "tail",
      bowl: bowler("fast", 0.84, { pace: 0.92 }),
    },
    {
      name: "Abrar Ahmed",
      look: look(1.75, "tan", "black", "short", "stubble", 40),
      nick: "Abrar",
      role: "bunny",
      bowl: bowler("legspin", 0.78),
    },
    {
      name: "Haris Rauff",
      look: look(1.8, "tan", "black", "short", "stubble", 97),
      nick: "Haris",
      role: "bunny",
      bowl: bowler("fast", 0.74, { pace: 0.93 }),
    },
    {
      name: "Fakhar Zamaan",
      hand: "left",
      look: look(1.78, "tan", "black", "short", "full", 39),
      nick: "Fakhar",
      role: "opener",
      flair: 0.3,
    },
  ]);
}
