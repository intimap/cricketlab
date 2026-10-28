import { load, save } from "./storage.js";

// High-score tables. When the game runs as a published claude.ai artifact the
// tables live in the artifact's shared database, so everyone who opens it sees
// the same scores. Anywhere else (a local server, a saved file), or when the
// shared store refuses, they fall back to this browser's storage.
//
// Shared rows are one document each in the "scores" collection:
//   { board, name, rank, at, text, score }
// Callers check what comes back (anyone who can write the table can write anything).

const COLLECTION = "scores";
const LOCAL_KEY = "scores";
/** How many rows of a table are read back. */
const READ_LIMIT = 200;
/** How many entries per table this browser keeps when it can't share. */
const LOCAL_LIMIT = 100;

let dbPromise = null;

/** The shared store, or null when this view hasn't got one. */
function sharedDb() {
  if (!dbPromise) {
    const claude = typeof window !== "undefined" ? window.claude : undefined;
    dbPromise = claude?.use ? claude.use("db").catch(() => null) : Promise.resolve(null);
  }
  return dbPromise;
}

/** Set once the shared store has refused a write: keep this visit's scores on this device. */
let sharedReadOnly = false;

function localEntries() {
  const all = load(LOCAL_KEY, []);
  return Array.isArray(all) ? all : [];
}

function saveLocal(entry) {
  const all = localEntries();
  all.push(entry);
  // Keep the best of each table.
  const kept = [];
  const perBoard = {};
  for (const e of [...all].sort((a, b) => b.rank - a.rank || a.at - b.at)) {
    perBoard[e.board] = (perBoard[e.board] ?? 0) + 1;
    if (perBoard[e.board] <= LOCAL_LIMIT) kept.push(e);
  }
  save(LOCAL_KEY, kept);
}

/**
 * Add an entry to its table. Resolves { id, shared }: shared is false when it
 * could only be kept in this browser.
 */
export async function addScore(entry) {
  const id = `${entry.at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const row = { ...entry, id };
  const db = sharedReadOnly ? null : await sharedDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(id).set(row);
      return { id, shared: true };
    } catch (e) {
      if (e?.code === "unavailable") {
        try {
          await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
          await db.collection(COLLECTION).doc(id).set(row);
          return { id, shared: true };
        } catch {
          // Fall through to this browser.
        }
      } else {
        sharedReadOnly = true;
      }
    }
  }
  saveLocal(row);
  return { id, shared: false };
}

/**
 * Read a table: resolves { entries (raw rows, unsorted), shared }. Shared rows
 * and this browser's own rows are merged, so a score kept locally still shows.
 */
export async function readScores(board) {
  const local = localEntries().filter((e) => e.board === board);
  const db = await sharedDb();
  if (!db) return { entries: local, shared: false };
  try {
    const snap = await db.collection(COLLECTION).where("board", "==", board).orderBy("rank", "desc").limit(READ_LIMIT).get();
    const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const ids = new Set(rows.map((r) => r.id));
    return { entries: [...rows, ...local.filter((e) => !ids.has(e.id))], shared: true };
  } catch {
    return { entries: local, shared: false };
  }
}

/** Start looking for the shared store early, so the first table reads quickly. */
export function warmScores() {
  sharedDb();
}
