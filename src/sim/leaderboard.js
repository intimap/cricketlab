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
 * Tests rank the same way, with wins by an innings above everything (the bigger margin first), draws
 * between ties and losses, and innings defeats at the bottom.
 * Equal entries keep the order they were set in (the earlier one stays above).
 * Each kind of game has its own table, its "board" (see boardFor).
 */

export const NAME_MAX = 15;
/** Characters a name may use: what the pixel font draws. */
export const NAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-'!&";

/** Table names (boardFor) and entry ids, as anything that stores scores accepts them. */
export const BOARD_PATTERN = /^(match-\d{1,2}|classic-[A-Za-z0-9]{1,24}|test)$/;
export const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

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
  if (cfg.format === "test") return "test";
  return null;
}

/** The rank key: higher is better. Wickets and balls stay within their own band. */
function rankOf(won, kind, margin, ballsLeft) {
  const balls = Math.min(999, Math.max(0, ballsLeft));
  if (kind === "tie") return 3_000_000;
  if (kind === "draw") return 2_500_000;
  if (kind === "innings") return won ? 6_000_000 + margin : 500_000 - margin;
  if (won) return kind === "wkts" ? 5_000_000 + margin * 1000 + balls : 4_000_000 + margin;
  return kind === "runs" ? 2_000_000 - margin : 1_000_000 - margin * 1000 - balls;
}

/**
 * The player's result from a finished match (match.result is set):
 * { won, kind ("wkts" | "runs" | "tie"), margin, ballsLeft, rank, text, score }.
 */
export function resultEntry(match) {
  if (match.clock) return testEntry(match);
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
      : `${won ? "WON" : "LOST"} BY ${plural(margin, kind === "wkts" ? "WICKET" : "RUN")}` +
        (kind === "wkts" && ballsLeft > 0 ? ` (${plural(ballsLeft, "BALL")} LEFT)` : "");
  // Both sides, batting first first. A classic chase has no first innings: its target stands in.
  const total = (i) => `${i.batTeam.abbr} ${i.runs}${i.wkts === 10 ? "" : `/${i.wkts}`}`;
  const first = match.innings.length > 1 ? total(match.innings[0]) : `${inn.bowlTeam.abbr} ${inn.target - 1}`;
  const score = inn.target === null ? total(inn) : `${first}  ${total(inn)}`;
  return { won, kind, margin, ballsLeft, rank: rankOf(won, kind, margin, ballsLeft), text, score };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "S"}`;

/** A Test's entry: as resultEntry, from the player's side (match.humanTeam). */
function testEntry(match) {
  const r = match.result;
  const won = r.winner === match.humanTeam;
  const { kind, margin } = r;
  const ballsLeft = kind === "wkts" ? match.inn.ballsLeft : 0;
  const by = { innings: `AN INNINGS AND ${plural(margin, "RUN")}`, wkts: plural(margin, "WICKET"), runs: plural(margin, "RUN") };
  const text = kind === "draw" ? "MATCH DRAWN" : kind === "tie" ? "MATCH TIED" : `${won ? "WON" : "LOST"} BY ${by[kind]}`;
  // Each side's innings, batting first first; just the totals if that won't fit.
  const teams = [...new Set(match.innings.map((i) => i.batTeam))];
  const of = (team) => match.innings.filter((i) => i.batTeam === team);
  let score = teams
    .map(
      (t) =>
        `${t.abbr} ${of(t)
          .map((i) => i.runs)
          .join("&")}`,
    )
    .join(" ");
  if (score.length > 22) score = teams.map((t) => `${t.abbr} ${of(t).reduce((n, i) => n + i.runs, 0)}`).join(" ");
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
  const id = typeof raw.id === "string" && ID_PATTERN.test(raw.id) ? raw.id : null;
  return { board: raw.board, name, rank, at, text: short(raw.text, 36), score: short(raw.score, 22), id };
}

function cleanText(s) {
  return [...String(s ?? "").toUpperCase()].filter((ch) => NAME_CHARS.includes(ch) || "()/".includes(ch)).join("");
}
