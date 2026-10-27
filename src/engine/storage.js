// Small persistent settings and progress, kept in this browser only. Storage
// can be missing or blocked (private windows, previews), so every access is
// guarded and the game simply forgets when it can't remember.

const PREFIX = "cricketlab:";

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Not remembered this time; nothing else to do.
  }
}
