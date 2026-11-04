import { makeTeam, look, bowler } from "../teams.js";

/** Sri Lanka: wristy strokemakers, a wily spin attack (left-arm, off and leg) and a left-arm quick with the new ball. */
export function sriLanka() {
  return makeTeam("SRI LANKA", "SL", "#1c2f7a", "#f4c430", 606, [
    {
      name: "Pathum Nisanka",
      look: look(1.78, "tan", "black", "short", "stubble", 8),
      nick: "Pathum",
      role: "opener",
      flair: 0.1,
    },
    {
      name: "Dimuth Karunaratna",
      hand: "left",
      look: look(1.75, "tan", "black", "short", "full", 16),
      nick: "Dimuth",
      role: "opener",
    },
    {
      name: "Kusal Mendiss",
      look: look(1.73, "brown", "black", "short", "full", 13),
      nick: "Kusal",
      role: "keeper",
      keeper: true,
      flair: 0.2,
    },
    { name: "Angelo Mathew", look: look(1.8, "tan", "black", "short", "full", 69), nick: "Angie", role: "middle" },
    {
      name: "Dinesh Chandimel",
      look: look(1.7, "brown", "black", "short", "full", 55),
      nick: "Chandi",
      role: "middle",
      flair: 0.1,
    },
    {
      name: "Kamindu Mendez",
      hand: "left",
      look: look(1.78, "olive", "black", "short", "none", 89),
      nick: "Kamindu",
      role: "allround",
      flair: 0.15,
      bowl: bowler("offspin", 0.5),
    },
    {
      name: "Dhananjaya de Silver",
      look: look(1.8, "tan", "black", "short", "full", 22),
      nick: "DDS",
      role: "allround",
      bowl: bowler("offspin", 0.58),
    },
    {
      name: "Wanindu Hasarunga",
      look: look(1.75, "tan", "black", "short", "full", 49),
      nick: "Wanindu",
      role: "tail",
      flair: 0.2,
      bowl: bowler("legspin", 0.85),
    },
    {
      name: "Prabath Jayasuria",
      look: look(1.8, "brown", "black", "short", "stubble", 25),
      nick: "Prabath",
      role: "tail",
      bowl: bowler("offspin", 0.8, { accuracy: 0.86, arm: "left" }),
    },
    {
      name: "Asitha Fernanda",
      look: look(1.83, "brown", "black", "short", "full", 95),
      nick: "Asitha",
      role: "bunny",
      bowl: bowler("fast", 0.75),
    },
    {
      name: "Dilshan Madushanko",
      look: look(1.85, "tan", "black", "short", "stubble", 98),
      nick: "Dilshan",
      role: "bunny",
      bowl: bowler("fast", 0.76, { swing: 0.75, arm: "left" }),
    },
    {
      name: "Charith Asalanka",
      hand: "left",
      look: look(1.83, "tan", "black", "short", "full", 72),
      nick: "Charith",
      role: "middle",
      flair: 0.15,
    },
  ]);
}
