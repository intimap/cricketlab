import { lengthName, lineName } from "./delivery.js";

/**
 * What the box notices as the bowler runs in (TODO: commentary): a pattern built up over the over so far
 * (bouncers, the same variation again and again, a length or line hammered), a field change for this ball,
 * or a weakness the bowlers have read. It reads only the balls already bowled, never the one in his hand,
 * so a guess about what's coming is right only by chance.
 */

/** Variations worth naming when they come again and again, as they're said in the plural. */
const PLURAL = {
  outswing: "OUTSWINGERS",
  inswing: "INSWINGERS",
  bouncer: "BOUNCERS",
  yorker: "YORKERS",
  slower: "SLOWER BALLS",
  cutter: "CUTTERS",
  googly: "GOOGLIES",
  armBall: "ARM BALLS",
};

/** A ball as the over's memory keeps it. */
export function loggedBall(rec, spinner) {
  return {
    type: rec.deliveryType,
    length: lengthName(rec.pitched?.z ?? 5, spinner),
    line: rec.seenBall?.line ?? lineName(0),
  };
}

const lastThree = (log, test) => log.length >= 3 && log.slice(-3).every(test);

/** The read for the next ball: { topic: "runupRead", case, facts } or null. */
export function runupRead(log, { fieldChanged = false, weakness = null } = {}) {
  const read = (kase, facts = {}) => ({ topic: "runupRead", case: kase, facts });
  if (fieldChanged) return read("fieldChange");
  const bouncers = log.filter((b) => b.type === "bouncer").length;
  if (bouncers >= 2) return read("bouncers", { n: bouncers });
  const type = log[log.length - 1]?.type;
  if (PLURAL[type] && lastThree(log, (b) => b.type === type)) return read("same", { types: PLURAL[type] });
  if (weakness) return read("weakness", { how: weakness });
  if (lastThree(log, (b) => ["full toss", "yorker", "full"].includes(b.length))) return read("full");
  if (lastThree(log, (b) => ["back of a length", "short"].includes(b.length))) return read("short");
  if (lastThree(log, (b) => b.line === "off" || b.line === "wide")) return read("offside");
  return null;
}
