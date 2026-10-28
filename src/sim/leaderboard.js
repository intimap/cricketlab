/**
 * High-score entries for finished matches, and how they rank.
 *
 * Every match or Classic Match ends with the player winning or losing by a
 * margin. The ranking:
 *   1. wins by wickets (the player chased it down): more wickets in hand
 *      first, then more balls to spare;
 *   2. wins by runs (the player defended a total): the bigger margin first;
 *   3. ties;
 *   4. losses by runs (the player fell short in a chase): the narrowest first;
 *   5. losses by wickets (the player's total was chased): the fewest wickets
 *      and balls to spare first.
 * Equal entries keep the order they were set in (the earlier one stays above).
 * Each kind of game has its own table, its "board" (see boardFor).
 */

export const NAME_MAX = 15;
/** Characters a name may use: what the pixel font draws. */
export const NAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-'!&";

/** Uppercase, drop anything the font can't draw, at most NAME_MAX characters. */
export function cleanName(text) {
  return [...String(text ?? "").toUpperCase()]
    .filter((ch) => NAME_CHARS.includes(ch))
    .join("")
    .slice(0, NAME_MAX);
}

/** Which table a game's results go in, or null if it has none (nets, a single spell). */
export function boardFor(cfg) {
  if (cfg.format === "match") return `match-${cfg.overs}`;
  if (cfg.format === "classic") return `classic-${cfg.classic}`;
  return null;
}

/** The rank key: higher is better. Wickets and balls stay within their own band. */
function rankOf(won, kind, margin, ballsLeft) {
  const balls = Math.min(999, Math.max(0, ballsLeft));
  if (kind === "tie") return 3_000_000;
  if (won) return kind === "wkts" ? 5_000_000 + margin * 1000 + balls : 4_000_000 + margin;
  return kind === "runs" ? 2_000_000 - margin : 1_000_000 - margin * 1000 - balls;
}

/**
 * The player's result from a finished match (match.result is set):
 * { won, kind ("wkts" | "runs" | "tie"), margin, ballsLeft, rank, text, score }.
 */
export function resultEntry(match) {
  const inn = match.inn;
  const chasing = match.human === "bat";
  const ballsLeft = inn.ballsLeft;
  let won;
  let kind;
  let margin;
  if (inn.chaseWon) {
    won = chasing;
    kind = "wkts";
    margin = 10 - inn.wkts;
  } else {
    margin = inn.target - 1 - inn.runs;
    won = !chasing;
    kind = margin === 0 ? "tie" : "runs";
  }
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "S"}`;
  const text =
    kind === "tie"
      ? "MATCH TIED"
      : `${won ? "WON" : "LOST"} BY ${plural(margin, kind === "wkts" ? "WKT" : "RUN")}` +
        (kind === "wkts" && ballsLeft > 0 ? ` (${plural(ballsLeft, "BALL")} LEFT)` : "");
  const score = `${inn.batTeam.abbr} ${inn.runs}/${inn.wkts}`;
  return { won, kind, margin, ballsLeft, rank: rankOf(won, kind, margin, ballsLeft), text, score };
}

/** Best first; equal ranks keep the order they were set in. */
export function sortEntries(entries) {
  return [...entries].sort((a, b) => b.rank - a.rank || a.at - b.at);
}

/**
 * Check an entry read back from storage (shared data is untrusted):
 * returns a clean copy, or null if it isn't one.
 */
export function validEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = cleanName(raw.name);
  const rank = Number(raw.rank);
  const at = Number(raw.at);
  if (!name || !Number.isFinite(rank) || !Number.isFinite(at) || typeof raw.board !== "string") return null;
  const short = (s, n) => cleanText(s).slice(0, n);
  return { board: raw.board, name, rank, at, text: short(raw.text, 30), score: short(raw.score, 16), id: raw.id };
}

function cleanText(s) {
  return [...String(s ?? "").toUpperCase()].filter((ch) => NAME_CHARS.includes(ch) || "()/".includes(ch)).join("");
}
