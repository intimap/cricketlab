import { makeTeam, look, bowler } from "../teams.js";

/** New Zealand: patient openers, a classy top order, and a tall, skiddy seam attack. */
export function newZealand() {
  return makeTeam("NEW ZEALAND", "NZ", "#141414", "#b8bcc2", 303, [
    {
      name: "Tom Lathem",
      hand: "left",
      look: look(1.75, "fair", "brown", "short", "stubble", 48),
      nick: "Lath",
      role: "opener",
      flair: 0.05,
    },
    {
      name: "Devlin Conroy",
      hand: "left",
      look: look(1.83, "light", "brown", "short", "full", 88),
      nick: "Conny",
      role: "opener",
    },
    {
      name: "Kane Willamsen",
      look: look(1.73, "light", "darkBrown", "short", "full", 22),
      nick: "Kane",
      role: "top",
      flair: 0.2,
    },
    {
      name: "Rachin Ravindran",
      hand: "left",
      look: look(1.78, "olive", "black", "short", "none", 8),
      nick: "Rach",
      role: "top",
      flair: 0.15,
      bowl: bowler("offspin", 0.45, { accuracy: 0.7 }),
    },
    {
      name: "Darryl Mitchum",
      look: look(1.92, "fair", "sandy", "short", "full", 75, [], "stocky"),
      nick: "Mitch",
      role: "middle",
      flair: 0.1,
    },
    {
      name: "Glen Phillipson",
      look: look(1.8, "light", "brown", "short", "stubble", 23, ["sunglasses"]),
      nick: "Phillo",
      role: "allround",
      flair: 0.2,
      bowl: bowler("offspin", 0.55),
    },
    {
      name: "Tom Blundel",
      look: look(1.78, "fair", "brown", "short", "stubble", 66),
      nick: "Blunders",
      role: "keeper",
      keeper: true,
    },
    {
      name: "Mitch Santna",
      hand: "left",
      look: look(1.82, "fair", "lightBrown", "short", "full", 74),
      nick: "Santa",
      role: "allround",
      bowl: bowler("offspin", 0.65, { accuracy: 0.8 }),
    },
    {
      name: "Tim Southey",
      look: look(1.92, "fair", "sandy", "short", "full", 38, ["zinc"]),
      nick: "Southy",
      role: "tail",
      bowl: bowler("swing", 0.8),
    },
    {
      name: "Matt Henri",
      look: look(1.84, "fair", "brown", "short", "stubble", 21),
      nick: "Henners",
      role: "tail",
      bowl: bowler("fast", 0.82),
    },
    {
      name: "Kyle Jameison",
      look: look(2.03, "fair", "brown", "short", "full", 64, [], "slim"),
      nick: "Jamo",
      role: "bunny",
      bowl: bowler("fast", 0.78, { pace: 0.84, seam: 0.9 }),
    },
    {
      name: "Will O'Rourk",
      look: look(1.93, "fair", "lightBrown", "short", "none", 82, [], "slim"),
      nick: "Rourky",
      role: "bunny",
      bowl: bowler("fast", 0.7, { pace: 0.92 }),
    },
  ]);
}
