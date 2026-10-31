import { BOOTH_DOT_LINES, GLOVE_LINES } from "./booth-dot-lines.js";
import { BOOTH_SCORING_LINES, WINNING_EXTRA_LINES } from "./booth-scoring-lines.js";
import { BOOTH_WICKET_LINES } from "./booth-wicket-lines.js";
import { PackVoice, packContext } from "./pack-voice.js";
import { shotArea } from "./describe.js";
import { boothWords, safeBoothCalls } from "./booth-policy.js";

export const BOOTH_BALL_LINES = {
  ...BOOTH_DOT_LINES, ...BOOTH_SCORING_LINES, ...BOOTH_WICKET_LINES,
  glove: GLOVE_LINES, winningExtra: WINNING_EXTRA_LINES,
};
const NUMBERS = ["NO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
const number = n => NUMBERS[n] ?? String(n);

/** Classify the actual outcome before choosing any colourful wording. */
export function ballCallCategory(rec) {
  if (rec.wicket) return Object.hasOwn(BOOTH_WICKET_LINES, rec.wicket.how) ? rec.wicket.how : "wicket";
  const extra = rec.extra?.type;
  const boundary = rec.boundary && rec.runsBat === rec.boundary;
  if (extra && rec.moment?.kind === "winningRuns") return "winningExtra";
  if (extra === "wd") return "wide";
  if (extra === "nb") return boundary ? "noBallBoundary" : "noBall";
  if (extra === "b") return "byes";
  if (extra === "lb") return "legByes";
  if (rec.dropped && !rec.freeHit) return "drop";
  if (rec.contact === "gloved") return "glove";
  const edge = rec.contact && !["none", "middle"].includes(rec.contact);
  if (boundary) return edge ? "edgeBoundary" : rec.boundary === 6 ? "six" : "four";
  if (edge) return rec.total > 0 ? "edgeRuns" : "edgeDot";
  if (["toe", "splice"].includes(rec.impact?.region) && rec.contact === "middle")
    return rec.total > 0 ? "offCentreRuns" : "offCentreDot";
  if (rec.total > 0) return ({ 1: "single", 2: "two", 3: "three" })[rec.total] ?? "runs";
  if (rec.padVerdict) return "pad";
  if (rec.beatBat) return "beaten";
  if (rec.shot === "leave" && rec.contact === "none") return "leave";
  if (rec.contact === "none") return "miss";
  if (rec.shot === "defend") return "defend";
  return rec.quality >= 0.7 ? "stopped" : "miscue";
}

/** Every ball gets a primary call; recent wording is relaxed only when the finite pool is exhausted. */
export class BoothCaller {
  pack = new PackVoice();
  lastSaid = new Map();
  ball = 0;

  call(rec, hpd, names, rng, fits = () => true) {
    this.ball++;
    this.pack.tick();
    const who = rec.over % 3;
    const category = ballCallCategory(rec);
    const total = rec.total ?? 0;
    const areas = rec.exit && Number.isFinite(rec.exit.x) && Number.isFinite(rec.exit.z) &&
      Math.hypot(rec.exit.x, rec.exit.z) > 0 ? shotArea(rec.exit, !!rec.boundary || total >= 2).words : [];
    const facts = {
      b: names.batter || "THE BATTER", w: names.bowler || "THE BOWLER",
      n: number(total), boundary: number(rec.boundary),
      event: rec.extra?.type === "nb" && rec.boundary && rec.runsBat === rec.boundary
        ? `A NO-BALL AND ${number(rec.boundary)} OFF THE BAT`
        : ({ wd: "A WIDE", nb: "A NO-BALL", b: "BYES", lb: "LEG-BYES" })[rec.extra?.type],
      shot: rec.shotName || null,
      where: areas.length ? areas[Math.min(areas.length - 1, Math.floor(rng.random() * areas.length))] : null,
      contact: ({ thinEdge: "THIN OUTSIDE EDGE", thickEdge: "THICK OUTSIDE EDGE", insideEdge: "INSIDE EDGE",
        topEdge: "TOP EDGE", bottomEdge: "BOTTOM EDGE", padPop: "BAT-PAD DEFLECTION" })[rec.contact] ?? null,
      result: total === 0 ? "NO RUN" : total === 1 ? "ONE RUN" : `${number(total)} RUNS`,
      part: rec.impact?.region === "toe" ? "TOE" : "SPLICE",
      dismissal: rec.wicket?.how?.toUpperCase() ?? "OUT",
      extra: rec.extra?.type === "nb" ? " A NO-BALL AS WELL." : rec.extra?.type === "wd" ? " A WIDE AS WELL." : "",
    };
    const render = line => line.replace(/\{([^}]+)\}/g, (_, key) => facts[key] ?? `{${key}}`).toUpperCase()
      .replace(/\bONE BYES\b/g, "ONE BYE").replace(/\bONE LEG-BYES\b/g, "ONE LEG-BYE");
    const allowed = text => safeBoothCalls([{ who, text }], hpd, fits).length > 0;
    const candidates = BOOTH_BALL_LINES[category][who].map(render).filter(allowed).map(text => ({ text }));
    // The established bank supplies additional specific calls (movement, shot families, edges).
    const legacySafe = !["winningExtra", "offCentreDot", "offCentreRuns"].includes(category);
    const pick = !legacySafe ? null : this.pack.choose("ball_calls", packContext(rec, { b: facts.b, w: facts.w }), {
      random: () => rng.random(), relax: true,
      fits: text => allowed(text) && this.ball - (this.lastSaid.get(boothWords(text)) ?? -Infinity) > 24,
    });
    if (pick && allowed(pick.text)) candidates.push({ text: pick.text.toUpperCase(), pick });
    let pool = candidates.filter(c => this.ball - (this.lastSaid.get(boothWords(c.text)) ?? -Infinity) > 24);
    if (!pool.length && candidates.length) {
      const oldest = Math.min(...candidates.map(c => this.lastSaid.get(boothWords(c.text)) ?? -Infinity));
      pool = candidates.filter(c => (this.lastSaid.get(boothWords(c.text)) ?? -Infinity) === oldest);
    }
    // These are new factual sentences, never a copy of the HPD. Normally the authored pool suffices.
    if (!pool.length) pool = [
      `${facts.b}: ${facts.result} FROM THE DELIVERY.${facts.extra}`,
      `THE DELIVERY IS COMPLETE. ${facts.result}.${facts.extra}`,
    ].filter(allowed).map(text => ({ text }));
    if (!pool.length) return null;
    const choice = pool[Math.min(pool.length - 1, Math.floor(rng.random() * pool.length))];
    this.lastSaid.set(boothWords(choice.text), this.ball);
    if (choice.pick) this.pack.said(choice.pick);
    return { who, text: choice.text, topic: "ballCall", category };
  }
}
