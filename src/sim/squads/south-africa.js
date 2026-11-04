import { makeTeam, look, bowler } from "../teams.js";

/** South Africa: a fast attack led by real pace, a giant left-armer's bounce, and a canny spinner. */
export function southAfrica() {
  return makeTeam("SOUTH AFRICA", "SA", "#0b6b3a", "#f2b81c", 404, [
    {
      name: "Aidan Markham",
      look: look(1.83, "fair", "brown", "short", "stubble", 4),
      nick: "Marky",
      role: "opener",
      flair: 0.1,
      bowl: bowler("offspin", 0.35),
    },
    {
      name: "Tony de Zorz",
      hand: "left",
      look: look(1.78, "fair", "darkBrown", "short", "none", 47),
      nick: "Zorzy",
      role: "opener",
      short: "de Zorz",
    },
    {
      name: "Ryan Rickeltan",
      hand: "left",
      look: look(1.8, "fair", "brown", "short", "stubble", 17),
      nick: "Ricks",
      role: "top",
      flair: 0.1,
    },
    {
      name: "Temba Bavumo",
      look: look(1.62, "dark", "black", "buzz", "full", 11, [], "stocky"),
      nick: "Temba",
      role: "top",
      flair: 0.05,
    },
    {
      name: "Tristan Stubs",
      look: look(1.88, "fair", "lightBrown", "short", "none", 20),
      nick: "Stubbsy",
      role: "middle",
      flair: 0.2,
    },
    { name: "David Beddingham", look: look(1.8, "fair", "brown", "short", "full", 31), nick: "Bedders", role: "middle" },
    {
      name: "Kyle Verreyn",
      look: look(1.75, "fair", "brown", "short", "stubble", 13),
      nick: "Verry",
      role: "keeper",
      keeper: true,
      flair: 0.1,
    },
    {
      name: "Marco Janssen",
      hand: "left",
      look: look(2.06, "fair", "sandy", "short", "stubble", 70, [], "slim"),
      nick: "Marco",
      role: "allround",
      flair: 0.15,
      bowl: bowler("fast", 0.82, { pace: 0.86, seam: 0.88 }),
    },
    {
      name: "Keshav Maharajh",
      look: look(1.67, "brown", "black", "short", "full", 16),
      nick: "Kesh",
      role: "tail",
      bowl: bowler("offspin", 0.8, { accuracy: 0.84 }),
    },
    {
      name: "Kagiso Rabado",
      look: look(1.85, "dark", "black", "buzz", "stubble", 25),
      nick: "KG",
      role: "tail",
      bowl: bowler("fast", 0.9, { pace: 0.94 }),
    },
    {
      name: "Lungi Ngidy",
      look: look(1.93, "dark", "black", "buzz", "none", 22, [], "stocky"),
      nick: "Lungi",
      role: "bunny",
      bowl: bowler("fast", 0.78),
    },
    {
      name: "Anrich Nortjie",
      look: look(1.88, "fair", "brown", "short", "full", 20, ["sunglasses"]),
      nick: "Nortjie",
      role: "bunny",
      bowl: bowler("fast", 0.78, { pace: 0.98 }),
    },
  ]);
}
