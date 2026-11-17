// The commentary in sentences (render/commentary-case.js): capitals where they belong, the length unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

globalThis.document ??= { createElement: () => ({ getContext: () => ({}) }), getElementById: () => null };
const { sentenceCase } = await import("../src/render/commentary-case.js");

test("sentences start with a capital; names, grounds, ends and teams keep theirs", () => {
  const cases = {
    "WOAKESLEY IN FROM THE MEMBERS END -- A GOOD AREA, FOURTH STUMP":
      "Woakesley in from the Members End -- a good area, fourth stump",
    "WHAT A DAY FOR CRICKET! GET THE HATS ON!": "What a day for cricket! Get the hats on!",
    "THAT'S OUT, LBW! ENGLAND ARE IN TROUBLE. AUSTRALIA WON'T MIND.":
      "That's out, lbw! England are in trouble. Australia won't mind.".replace("lbw", "LBW"),
    "A LOVELY DAY AT PARKLANDS OVAL.": "A lovely day at Parklands Oval.",
    "BAYSIDE OVAL. THE WATER JUST OVER THE FENCE.": "Bayside Oval. The water just over the fence.",
    "WELL, BILL, I THINK I'VE SEEN ENOUGH. 141 KM/H!": "Well, Bill, I think I've seen enough. 141 km/h!",
    "LA BONSHANE'S GONE AND O'BRIEN IS NEXT FOR ST KILDA": "La Bonshane's gone and O'Brien is next for St Kilda",
    "THE BALL WILL SWING AT THE END OF THE DAY": "The ball will swing at the end of the day",
    "NEW ZEALAND NEED 12. SOUTH AFRICA HAVE THE NEW BALL": "New Zealand need 12. South Africa have the new ball",
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(sentenceCase(from), to);
});

test("only the case changes, on every line in the game", () => {
  const dir = new URL("../src/sim/lines/", import.meta.url);
  let count = 0;
  const walk = (v) => {
    if (typeof v === "string") {
      const out = sentenceCase(v);
      assert.equal(out.toUpperCase(), v.toUpperCase());
      assert.equal(out.length, v.length);
      count++;
    } else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) walk(JSON.parse(readFileSync(new URL(f, dir), "utf8")));
  assert.ok(count > 1000, `${count} lines`);
});
