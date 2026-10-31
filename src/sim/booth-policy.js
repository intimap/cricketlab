/** Compare finished lines, including names, without punctuation or case differences. */
export const boothWords = text => String(text ?? "").toUpperCase().replace(/['\u2019]/g, "")
  .replace(/[^A-Z0-9]+/g, " ").trim();

export function repeatsHpd(text, hpd) {
  const a = boothWords(text);
  const b = boothWords(hpd);
  if (!a || !b) return false;
  if (a === b) return true;
  // Also reject a copied descriptive sentence wrapped in an extra remark.
  const paddedA = ` ${a} `;
  const paddedB = ` ${b} `;
  return (a.split(" ").length >= 5 && paddedB.includes(paddedA)) ||
    (b.split(" ").length >= 5 && paddedA.includes(paddedB));
}

/** Every route into the booth passes this gate; no fallback is exempt. */
export function safeBoothCalls(calls, hpd, fits = () => true) {
  const seen = new Set();
  return calls.filter(call => {
    const key = boothWords(call.text);
    if (!key || !Number.isInteger(call.who) || call.who < 0 || call.who > 2 ||
        /\{[^}]*\}|\b(?:undefined|NaN)\b/i.test(call.text) || !fits(call.text) ||
        repeatsHpd(call.text, hpd) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
