import { BROADCAST_STORIES } from "./broadcast-context.js";
import { getOverSummary } from "./commentary-narrative.js";
import { safeBoothCalls } from "./booth-policy.js";

export const CHAT_TOPICS = {
  overSummary: { mood: "recap" },
  fieldPlan: BROADCAST_STORIES.fieldPlan,
  nervousNineties: BROADCAST_STORIES.nervousNineties,
};

// Match the renderer's four rows without importing browser/render code into simulation.
const fitsPanel = (text) => {
  let rows = 1,
    width = 0;
  for (const word of text.split(/\s+/)) {
    if (word.length > 32) return false;
    if (width && width + 1 + word.length > 32) {
      rows++;
      width = 0;
    }
    width += (width ? 1 : 0) + word.length;
  }
  return rows <= 4;
};

/** Keep sentences together where possible; never discard score or figures to fit. */
function fitCalls(text, who, fits) {
  const calls = [];
  let line = "";
  const flush = () => {
    if (line) calls.push({ who, text: line, topic: "overSummary" });
    line = "";
  };
  for (const sentence of text.toUpperCase().split(/(?<=[.!?])\s+/)) {
    if (fits(sentence)) {
      const next = line ? `${line} ${sentence}` : sentence;
      if (!fits(next)) flush();
      line = line ? `${line} ${sentence}` : sentence;
    } else {
      flush();
      for (const word of sentence.split(/\s+/)) {
        if (line && !fits(`${line} ${word}`)) flush();
        line = line ? `${line} ${word}` : word;
      }
      flush();
    }
  }
  flush();
  return safeBoothCalls(calls, "", fits);
}

/** The outgoing commentator resets the score before the change of ends. */
export function boothChat(comm, inn, rng, { fits = fitsPanel, hpd = "" } = {}) {
  const snapshot = comm?.narrative?.lastOver;
  if (!snapshot || snapshot.number !== (inn?.overNo ?? 0) - 1 || inn.legal % 6 !== 0) return [];
  const key = `over:${snapshot.number}`;
  if (comm.chatMemory.has(key)) return [];
  const calls = safeBoothCalls(fitCalls(getOverSummary(inn, snapshot), snapshot.number % 3, fits), hpd, fits);
  if (calls.length) comm.chatMemory.add(key);
  return calls;
}

/** Legacy callers may still supply a joke as [commentator id, text] pairs. */
export function boothJoke(joke) {
  if (!Array.isArray(joke)) return [];
  const ids = ["bunnings", "lorry", "grog"];
  return safeBoothCalls(
    joke.map(([id, text]) => ({ who: ids.indexOf(id), text })),
    "",
  );
}
