/** Compare finished lines, including names, without punctuation or case differences. */
export const boothWords = (text) =>
  String(text ?? "")
    .toUpperCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

export function repeatsHpd(text, hpd) {
  const a = boothWords(text);
  const b = boothWords(hpd);
  if (!a || !b) return false;
  if (a === b) return true;
  // Also reject a copied descriptive sentence wrapped in an extra remark.
  const paddedA = ` ${a} `;
  const paddedB = ` ${b} `;
  return (a.split(" ").length >= 5 && paddedB.includes(paddedA)) || (b.split(" ").length >= 5 && paddedA.includes(paddedB));
}

/** Every route into the booth passes this gate; no fallback is exempt. */
export function safeBoothCalls(calls, hpd, fits = () => true) {
  const seen = new Set();
  return calls.filter((call) => {
    const key = boothWords(call.text);
    if (
      !key ||
      !Number.isInteger(call.who) ||
      call.who < 0 ||
      call.who > 2 ||
      /\{[^}]*\}|\b(?:undefined|NaN)\b/i.test(call.text) ||
      !fits(call.text) ||
      repeatsHpd(call.text, hpd) ||
      seen.has(key)
    )
      return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fill a line's {placeholders} from `facts` (a missing one stays as {key}, which the gate rejects), with
 * "a" made "an" before a filled word starting with a vowel ("AN OFF DRIVE", "AN UPPER CUT").
 */
export function fillLine(text, facts) {
  return String(text)
    .replace(/\b([Aa]) \{(\w+)\}/g, (all, a, key) => (/^[AEIOUaeiou]/.test(String(facts[key] ?? "")) ? `${a}n {${key}}` : all))
    .replace(/\{([^{}]+)\}/g, (_, key) => (facts[key] === null || facts[key] === undefined ? `{${key}}` : String(facts[key])));
}
