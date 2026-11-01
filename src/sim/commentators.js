import { BoothEditor } from "./booth-editor.js";
export { boothChat, boothJoke } from "./booth-chat.js";

const editors = new WeakMap();

/** Legacy signature, backed by the same editor used by new matches. */
export function boothCall(rec, hpd, names, rng, owner, fits, context = {}) {
  let editor = owner?.booth;
  if (!editor && owner && typeof owner === "object") {
    editor = editors.get(owner);
    if (!editor) { editor = new BoothEditor(); editors.set(owner, editor); }
  }
  const result = (editor ?? new BoothEditor()).edit(rec, hpd, names, rng, fits, context);
  return { ...result, picks: [] };
}

/** Portrait identities; ball and contextual wording live in the booth line banks. */
export const COMMENTATORS = [
  { id: "bunnings", name: "RICHIE BUNNINGS", first: "RICHIE" },
  { id: "lorry", name: "BILL LORRY", first: "BILL" },
  { id: "grog", name: "TONY GROG", first: "TONY" },
];
