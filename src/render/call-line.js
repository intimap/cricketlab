import { WIDTH, COLORS, fillRect } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/text.js";
import { COMMENTATORS } from "../sim/commentators.js";
import { LOOKS } from "./commentator-looks.js";

/**
 * The HUD's bottom line: the over's caller calling the ball as it happens (scenes/booth-beats.js), with his
 * little head and surname in front. `call` = { who, text, from, t0 }: `from` characters were already on
 * screen at time t0, and the rest type themselves out.
 */

const X = 4;
const HEAD = 10;
/** Characters a second: brisk enough to keep up with the ball. */
export const CALL_RATE = 60;

export const surnameOf = (who) => COMMENTATORS[who].name.split(" ").pop();
const textX = (who) => X + HEAD + 4 + textWidth(surnameOf(who)) + 6;
/** Room for the call itself, after the longest surname. */
const ROOM = WIDTH - 4 - Math.max(...COMMENTATORS.map((_, who) => textX(who)));

/** Does this call fit the line? */
export const fitsHud = (text) => textWidth(String(text).toUpperCase()) <= ROOM;

/** How much of the call is on screen at `now`. */
export const shownOf = (call, now) =>
  Math.min(call.text.length, (call.from ?? 0) + Math.max(0, Math.floor((now - call.t0) * CALL_RATE)));

/** A 10x10 head from the commentator's portrait colours; the mouth moves while he talks. */
function drawHead(id, x, y, talking, now) {
  const L = LOOKS[id];
  const r = (rx, ry, w, h, c) => fillRect(x + rx, y + ry, w, h, c);
  r(0, 0, HEAD, HEAD, L.bg);
  r(1, 8, 8, 2, L.jacket);
  r(4, 8, 2, 2, L.shirt);
  r(5, 9, 1, 1, L.tie);
  r(2, 2, 6, 6, L.skin);
  r(1, 3, 1, 3, L.skin);
  r(8, 3, 1, 3, L.skin);
  if (id === "grog") {
    r(1, 0, 8, 2, L.hat);
    r(2, 2, 6, 1, L.band);
  } else {
    r(2, 1, 6, 2, L.hair);
    if (id === "bunnings") (r(1, 2, 1, 2, L.hair), r(8, 2, 1, 2, L.hair));
  }
  r(3, 4, 1, 1, "#1d1d22");
  r(6, 4, 1, 1, "#1d1d22");
  const open = talking && Math.sin(now * 31) + Math.sin(now * 19.7) > 0;
  r(4, 6, 2, open ? 2 : 1, open ? "#4a1a18" : "#7a3b30");
}

/** Draw the call on the line at height y. */
export function drawCallLine(call, now, y) {
  const shown = shownOf(call, now);
  drawHead(COMMENTATORS[call.who].id, X, y - 2, shown < call.text.length, now);
  drawText(surnameOf(call.who), X + HEAD + 4, y, { color: COLORS.gold });
  drawText(call.text.slice(0, shown).toUpperCase(), textX(call.who), y, { color: COLORS.cream });
}
