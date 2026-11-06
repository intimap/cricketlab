import { makeTeam, look, bowler } from "../teams.js";

/** India: a stroke-filled top order, a dashing keeper, two spinning all-rounders and a world-class quick. */
export function india() {
  return makeTeam("INDIA", "IND", "#1a3f8f", "#f28c28", 404, [
    {
      name: "Rohit Sharmo",
      look: look(1.74, "tan", "black", "short", "full", 45, [], "stocky"),
      nick: "Hitman",
      role: "opener",
      flair: 0.2,
    },
    {
      name: "Yashasvi Jaiswel",
      hand: "left",
      look: look(1.74, "tan", "black", "short", "none", 64),
      nick: "Jaissy",
      role: "opener",
      flair: 0.15,
    },
    { name: "Shubman Gil", look: look(1.78, "olive", "black", "short", "stubble", 77), nick: "Shubh", role: "top", flair: 0.1 },
    { name: "Virat Kohly", look: look(1.75, "tan", "black", "short", "full", 18), nick: "King", role: "top", flair: 0.2 },
    {
      name: "Rishabh Pantt",
      hand: "left",
      look: look(1.7, "tan", "black", "short", "stubble", 17, [], "stocky"),
      nick: "Spidey",
      role: "keeper",
      keeper: true,
      flair: 0.3,
      // Heavy for his size, on a short handle.
      blade: { weight: 1.3, edges: 43, handle: "short" },
    },
    { name: "KL Rahool", look: look(1.8, "olive", "black", "short", "full", 1), nick: "Rahul", role: "middle" },
    {
      name: "Ravindra Jadeya",
      hand: "left",
      look: look(1.73, "tan", "black", "short", "full", 8),
      nick: "Jaddu",
      role: "allround",
      flair: 0.1,
      bowl: bowler("offspin", 0.78, { accuracy: 0.88, arm: "left" }),
    },
    {
      name: "Ravi Ashwan",
      look: look(1.86, "tan", "black", "short", "none", 99),
      nick: "Ash",
      role: "tail",
      bowl: bowler("offspin", 0.88, { accuracy: 0.86 }),
    },
    {
      name: "Jasprit Bumrow",
      look: look(1.78, "tan", "black", "short", "stubble", 93),
      nick: "Boom",
      role: "tail",
      bowl: bowler("fast", 0.95, { pace: 0.9, accuracy: 0.92 }),
    },
    {
      name: "Mohammed Siraaj",
      look: look(1.78, "brown", "black", "short", "full", 73),
      nick: "Miyan",
      role: "bunny",
      bowl: bowler("fast", 0.8, { pace: 0.88 }),
    },
    {
      name: "Mohammed Shamy",
      look: look(1.73, "tan", "black", "short", "full", 11, [], "stocky"),
      nick: "Lala",
      role: "bunny",
      bowl: bowler("swing", 0.86, { seam: 0.86 }),
    },
    { name: "Shreyas Iyar", look: look(1.75, "olive", "black", "short", "full", 41), nick: "Shrey", role: "middle", flair: 0.15 },
  ]);
}
