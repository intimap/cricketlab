import { load, save } from "./storage.js";

// High-score tables, kept in the first of these that works:
//   1. a claude.ai artifact's shared database (when the game is published as one);
//   2. the site's own score service, /api/scores (on Netlify: netlify/functions/scores.mjs);
//   3. this browser's storage, so scores are at least remembered on this device.
// Either shared store means everyone playing the same copy sees the same tables.
//
// Artifact rows are one document each in the "scores" collection:
//   { board, name, rank, at, text, score, id }
// Callers check what comes back (anyone who can write a table can write anything).

const COLLECTION = "scores";
const LOCAL_KEY = "scores";
const API = "api/scores";
/** How many rows of a table are read back. */
const READ_LIMIT = 200;
/** How many entries per table this browser keeps when it can't share. */
const LOCAL_LIMIT = 100;

let dbPromise = null;

/** The artifact's shared database, or null when this view hasn't got one. */
function sharedDb() {
  if (!dbPromise) {
    const claude = typeof window !== "undefined" ? window.claude : undefined;
    dbPromise = claude?.use ? claude.use("db").catch(() => null) : Promise.resolve(null);
  }
  return dbPromise;
}

/** Set once a shared store has refused a write: keep this visit's scores on this device. */
let sharedReadOnly = false;
/** Set once the site has shown it has no score service (a plain file server, a saved copy). */
let noApi = typeof location === "undefined" || !location.protocol.startsWith("http");

/** Call the site's score service; resolves its entries, or null if there's no service to ask. */
async function callApi(init, query = "") {
  if (noApi) return null;
  let res;
  try {
    res = await fetch(API + query, init);
  } catch {
    return null;
  }
  // No such service here (a 404 page, or not JSON at all): stop asking.
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    noApi = true;
    return null;
  }
  const body = await res.json().catch(() => null);
  return res.ok && Array.isArray(body?.entries) ? body.entries : null;
}

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

async function addToDb(db, row) {
  try {
    await db.collection(COLLECTION).doc(row.id).set(row);
    return true;
  } catch (e) {
    if (e?.code !== "unavailable") {
      sharedReadOnly = true;
      return false;
    }
  }
  try {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    await db.collection(COLLECTION).doc(row.id).set(row);
    return true;
  } catch {
    return false;
  }
}

/**
 * Add an entry to its table. Resolves { id, shared }: shared is false when it
 * could only be kept in this browser.
 */
export async function addScore(entry) {
  const id = `${entry.at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const row = { ...entry, id };
  if (!sharedReadOnly) {
    const db = await sharedDb();
    if (db ? await addToDb(db, row) : await callApi(postInit(row))) return { id, shared: true };
  }
  saveLocal(row);
  return { id, shared: false };
}

const postInit = (row) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(row) });

/** A table from whichever shared store there is: its rows, or null without one. */
async function sharedEntries(board) {
  const db = await sharedDb();
  if (!db) return callApi({}, `?board=${encodeURIComponent(board)}`);
  try {
    const snap = await db.collection(COLLECTION).where("board", "==", board).orderBy("rank", "desc").limit(READ_LIMIT).get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch {
    return null;
  }
}

/**
 * Read a table: resolves { entries (raw rows, unsorted), shared }. Shared rows
 * and this browser's own rows are merged, so a score kept locally still shows.
 */
export async function readScores(board) {
  const local = localEntries().filter((e) => e.board === board);
  const rows = await sharedEntries(board);
  if (!rows) return { entries: local, shared: false };
  const ids = new Set(rows.map((r) => r.id));
  return { entries: [...rows, ...local.filter((e) => !ids.has(e.id))], shared: true };
}

/** Start looking for the shared store early, so the first table reads quickly. */
export function warmScores() {
  sharedDb();
}
