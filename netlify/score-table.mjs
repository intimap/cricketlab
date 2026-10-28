// The shared high-score tables behind /api/scores on the Netlify site.
//
// Each table ("board", e.g. match-10) is one JSON document: its best entries,
// best first. Writes are conditional on the document not having changed since
// it was read, so two players saving at once can't wipe out each other's
// score; a write that loses the race reads again and retries.
//
// Kept apart from the function itself (functions/scores.mjs) so it runs
// against any store with getWithMetadata/setJSON, such as a test's.
import { BOARD_PATTERN, validEntry, sortEntries } from "../src/sim/leaderboard.js";

/** Entries kept per table. */
export const TABLE_SIZE = 200;
/** A score entry is small; anything bigger isn't one. */
const MAX_BODY = 2048;
/** The rank keys resultEntry() makes lie in this range. */
const MAX_RANK = 6_000_000;
const WRITE_ATTEMPTS = 12;
/** A write that loses the race waits a random moment (growing each time) before trying again. */
const backoff = (attempt) => new Promise((r) => setTimeout(r, Math.random() * Math.min(400, 20 * 2 ** attempt)));

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function readTable(store, board) {
  const found = await store.getWithMetadata(board, { type: "json" });
  const entries = Array.isArray(found?.data) ? found.data : [];
  return { entries: entries.map(validEntry).filter(Boolean), etag: found?.etag ?? null };
}

/** Add an entry to its table, keeping the best TABLE_SIZE. Resolves the table as written. */
async function addEntry(store, entry) {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const { entries, etag } = await readTable(store, entry.board);
    const table = sortEntries([...entries.filter((e) => e.id !== entry.id), entry]).slice(0, TABLE_SIZE);
    const written = await store.setJSON(entry.board, table, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (written.modified) return table;
    await backoff(attempt);
  }
  throw new Error("busy");
}

/** Check a posted score; returns a clean entry stamped with the server's clock, or null. */
function postedEntry(raw) {
  const entry = validEntry({ ...raw, at: Date.now() });
  if (!entry || !BOARD_PATTERN.test(entry.board) || !entry.id) return null;
  if (!Number.isInteger(entry.rank) || entry.rank < 0 || entry.rank > MAX_RANK) return null;
  return entry;
}

/**
 *   GET  /api/scores?board=match-10   -> { entries }   best first
 *   POST /api/scores  { board, name, rank, text, score, id }  -> { entries }
 */
export function makeScoreApi(getStore) {
  return async (req) => {
    const store = getStore();
    if (req.method === "GET") {
      const board = new URL(req.url).searchParams.get("board") ?? "";
      if (!BOARD_PATTERN.test(board)) return json({ error: "unknown board" }, 400);
      return json({ entries: (await readTable(store, board)).entries });
    }
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: "too big" }, 413);
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return json({ error: "not json" }, 400);
    }
    const entry = postedEntry(raw);
    if (!entry) return json({ error: "not a score" }, 400);
    try {
      return json({ entries: await addEntry(store, entry) });
    } catch {
      return json({ error: "busy, try again" }, 503);
    }
  };
}
