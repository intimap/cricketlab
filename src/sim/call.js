import { lengthName, lineName } from "./delivery.js";
import { shotArea } from "./describe.js";

/**
 * The plain call for the score bar: exactly what was bowled, what the batter
 * did with it and what came of it, with no colour. (The commentary box adds
 * the colour; see commentary.js and commentators.js.)
 */

// The delivery as it's called; the stock seam ball goes unnamed.
const DELIVERY = {
  seam: "",
  outswing: "outswinger",
  inswing: "inswinger",
  bouncer: "bouncer",
  yorker: "yorker",
  slower: "slower ball",
  cutter: "cutter",
  offspin: "off-break",
  legspin: "leg-break",
  armBall: "arm ball",
  googly: "googly",
};

// A shot that missed has no name from the bat (batting.js shotName), so call it by what was played.
const SHOT = {
  drive: "drive",
  cutpull: "back-foot shot",
  loft: "lofted drive",
  ramp: "ramp",
  sweep: "sweep",
  reverseSweep: "reverse sweep",
  defend: "defence",
};

const CONTACT = {
  middle: "middled",
  thinEdge: "outside edge",
  thickEdge: "thick outside edge",
  insideEdge: "inside edge",
  padPop: "inside edge onto the pad",
  topEdge: "top edge",
  bottomEdge: "bottom edge",
  gloved: "off the glove",
};

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const runs = (n) => (n === 0 ? "no run" : `${n} run${n === 1 ? "" : "s"}`);
const plain = (name) => (name?.startsWith("the ") ? name.slice(4) : (name ?? ""));

/**
 * "144 km/h outswinger, good length outside off". Short of room, the speed goes first (the speed gun
 * shows it), then the type.
 */
function deliveryPart(rec, delivery, spinner, short) {
  const type = short === 2 ? "" : (DELIVERY[rec.deliveryType] ?? "");
  const pitchZ = delivery.pitchedAt?.z ?? 0;
  const line = lineName(delivery.atCrease ? delivery.atCrease.x : delivery.intent.line);
  const what = [short ? "" : `${Math.round(rec.movement.kmh)} km/h`, type].filter(Boolean).join(" ");
  const where = `${lengthName(pitchZ, spinner)} ${line === "middle" ? "on middle" : line}`;
  return what ? `${what}, ${where}` : where;
}

/**
 * "Cover drive, middled, to deep cover" / "Drive, beaten" / "Left alone, hit on the pad (missing)";
 * without where it went when it's short of room.
 */
function shotPart(rec, short) {
  const pad = rec.padVerdict ? `, hit on the pad (${rec.padVerdict})` : "";
  if (rec.shot === "leave") return `Left alone${pad}`;
  const shot = capitalise(rec.shotName || SHOT[rec.shot] || "shot");
  if (rec.contact === "none") {
    if (rec.missReason === "early" || rec.missReason === "late") return `${shot}, ${rec.missReason} and missed${pad}`;
    return pad || rec.wicket?.how === "bowled" ? `${shot}, missed${pad}` : `${shot}, beaten`;
  }
  // A block is just played; a catch says where it went by the fielder.
  const parts = [shot];
  if (rec.shot !== "defend" || rec.contact !== "middle") parts.push(CONTACT[rec.contact] ?? "off the bat");
  if (rec.exit && rec.shot !== "defend" && rec.wicket?.how !== "caught" && !short)
    parts.push(shotArea(rec.exit, rec.runsBat >= 2 || rec.boundary > 0).words[0]);
  return parts.join(", ") + pad;
}

/** "2 runs." / "FOUR." / "OUT, caught at cover." / "Wide, 1 run." */
function resultPart(rec) {
  const w = rec.wicket;
  if (w) {
    const how =
      w.how === "caught"
        ? w.caughtBehind
          ? "caught behind"
          : w.fielder === "the bowler"
            ? "caught and bowled"
            : `caught at ${plain(w.fielder)}`
        : w.how === "runout"
          ? `run out${w.fielder ? ` (${plain(w.fielder)})` : ""}`
          : w.how === "lbw"
            ? "LBW"
            : w.how;
    return `OUT, ${how}.`;
  }
  const dropped = rec.dropped ? `dropped at ${plain(rec.dropped)}, ` : "";
  const extra = rec.extra;
  let result;
  if (extra.type === "wd") result = `wide, ${runs(extra.runs)}`;
  else if (extra.type === "b") result = `${extra.runs} bye${extra.runs === 1 ? "" : "s"}`;
  else if (extra.type === "lb") result = `${extra.runs} leg bye${extra.runs === 1 ? "" : "s"}`;
  else if (rec.boundary === 6) result = "SIX";
  else if (rec.boundary === 4) result = "FOUR";
  else result = runs(rec.runsBat);
  if (extra.type === "nb") result = `no ball, ${rec.boundary ? result : runs(rec.runsBat)} off the bat`;
  return dropped + result + ".";
}

/** Characters the score bar has room for. */
export const CALL_MAX = 104;

/** The score bar's call for a finished ball record, trimmed to fit. */
export function plainCall(rec, delivery, spinner) {
  const free = rec.freeHit ? "Free hit: " : "";
  const call = (shortShot, shortBall) =>
    `${free}${capitalise(deliveryPart(rec, delivery, spinner, shortBall))}. ${shotPart(rec, shortShot)}: ${resultPart(rec)}`;
  for (const [shortShot, shortBall] of [
    [false, 0],
    [true, 0],
    [true, 1],
  ]) {
    const text = call(shortShot, shortBall);
    if (text.length <= CALL_MAX) return text;
  }
  return call(true, 2);
}
