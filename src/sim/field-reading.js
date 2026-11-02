/**
 * What a field says about the plan, as a commentator reads it: slips hunting the edge, bat-pad
 * catchers, boundary riders waiting for the pull, the ring saving singles. Reads the actual placings
 * (custom fields too) by name and distance from the striker; no dice.
 */

/** Beyond this (m) a fielder is out on the boundary; inside it, in the ring. */
const DEEP = 45;
const RING = 32;

const WORDS = ["NO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"];
const count = (n) => WORDS[n] ?? String(n);

/**
 * The most telling thing about the field `placements` ([{ name, pos }]) for a bowler of `style`:
 * { text, key } (key: what it noticed, so the same reading isn't repeated), or null.
 */
export function readField(placements, style) {
  const spin = style === "offspin" || style === "legspin";
  const named = (re) => placements.filter((p) => re.test(p.name));
  const far = (p) => Math.hypot(p.pos.x, p.pos.z) > DEEP;
  const slips = named(/(^|\s)slip/).filter((p) => !/leg slip/.test(p.name)).length;
  const gully = named(/gully/).length > 0;
  const batPad = named(/short leg|silly/).length;
  const legSlip = named(/leg slip/).length > 0;
  const deep = placements.filter(far);
  // The leg side is negative x for the right-hander.
  const deepLeg = deep.filter((p) => p.pos.x < -8 && p.pos.z > -20).length;
  const fineUp = named(/fine leg/).some((p) => Math.hypot(p.pos.x, p.pos.z) < RING);

  if (slips >= 3)
    return { key: `slips${slips}`, text: `${count(slips)} SLIPS${gully ? " AND A GULLY" : ""} -- THEY'RE HUNTING THE EDGE.` };
  if (batPad && spin)
    return {
      key: "batPad",
      text: `${batPad > 1 ? "SHORT LEG AND SILLY POINT" : "A BAT-PAD CATCHER"} IN -- WAITING FOR THE BAT-PAD CATCH.`,
    };
  if (legSlip) return { key: "legSlip", text: "A LEG SLIP IN -- THE PLAN IS SOMETHING DOWN THE LEG SIDE." };
  if (deepLeg >= 2 && !spin)
    return { key: "hookTrap", text: "TWO OUT ON THE LEG SIDE -- THEY'RE EXPECTING THE PULL. SHORT BALL INCOMING." };
  if (deep.length >= 4)
    return { key: "spread", text: `${count(deep.length)} ON THE FENCE -- THEY'RE DEFENDING NOW, SAVING BOUNDARIES.` };
  if (!deep.length && !slips) return { key: "ring", text: "EVERYONE IN THE RING -- THEY'RE SAVING THE SINGLE." };
  if (fineUp) return { key: "fineUp", text: "FINE LEG IS UP -- CUTTING OFF THE SINGLE. HE'LL HAVE TO ROTATE THE OTHER WAY." };
  if (slips === 2) return { key: "slips2", text: `TWO SLIPS${gully ? " AND A GULLY" : ""} -- STILL LOOKING FOR THE EDGE.` };
  if (slips === 1) return { key: "slips1", text: "JUST THE ONE SLIP NOW -- A MORE BALANCED FIELD." };
  return null;
}
