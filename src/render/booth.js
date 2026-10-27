import { COLORS, ctx, fillRect, fillEllipse, drawPanel } from "../engine/screen.js";
import { drawText, wrapText } from "../engine/text.js";
import { COMMENTATORS } from "../sim/commentators.js";
import { HUD_Y } from "./hud.js";

const BOX_W = 252;
const BOX_H = 52;
const BOX_X = 4;
const BOX_Y = HUD_Y - BOX_H - 2;
const SLIDE = 0.22;
/** Characters spoken per second; the mouth moves while the text is still coming. */
const TALK_RATE = 30;
const HOLD = 1.6;
const LINE_CHARS = 32;

// Each commentator's look in the 40x40 portrait.
const LOOKS = {
  bunnings: {
    bg: "#24425f",
    jacket: "#eee5cc",
    jacketShade: "#cbbf9f",
    shirt: "#ffffff",
    tie: "#7a1f24",
    skin: "#dfa47c",
    hair: "#dadad4",
    brow: "#b9b9b2",
  },
  lorry: {
    bg: "#4d2a26",
    jacket: "#1f5233",
    jacketShade: "#163c25",
    shirt: "#f4f0e2",
    tie: "#e8b931",
    skin: "#e8b08a",
    hair: "#2b2019",
    brow: "#2b2019",
  },
  grog: {
    bg: "#27414d",
    jacket: "#1f3672",
    jacketShade: "#172855",
    shirt: "#bcd7f0",
    tie: "#c8302e",
    skin: "#e2a983",
    hair: "#c9a65a",
    brow: "#a8873f",
    hat: "#e7d08e",
    band: "#1f3672",
  },
};

/** A 40x40 head-and-shoulders portrait; mouth 0 = closed, 1 = half, 2 = open. */
export function drawPortrait(id, x, y, mouth) {
  const L = LOOKS[id];
  const r = (rx, ry, w, h, c) => fillRect(x + rx, y + ry, w, h, c);
  const e = (cx, cy, rx, ry, c) => fillEllipse(x + cx, y + cy, rx, ry, c);
  const shade = "rgba(0,0,0,0.18)";
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, 40, 40);
  ctx.clip();
  r(0, 0, 40, 40, L.bg);
  r(0, 30, 40, 10, "rgba(0,0,0,0.15)");

  // Shoulders, shirt and tie.
  e(20, 42, 19, 11, L.jacket);
  e(27, 42, 11, 10, L.jacketShade);
  r(15, 31, 10, 9, L.shirt);
  r(19, 33, 3, 7, L.tie);
  r(18, 32, 5, 2, L.tie);
  r(13, 31, 3, 9, L.jacket);
  r(24, 31, 3, 9, L.jacketShade);

  // Neck and head.
  const tall = id === "grog" ? 1 : 0;
  r(16, 25, 8, 7, L.skin);
  r(16, 28, 8, 2, shade);
  e(11, 18, 1.5, 2.5, L.skin);
  e(29, 18, 1.5, 2.5, L.skin);
  e(20, 17, 9, 10 + tall, L.skin);
  e(25, 19, 4, 7, shade);

  // Hair (and Tony's hat).
  if (id === "bunnings") {
    // Silver, swept straight back.
    e(20, 9, 9, 4, L.hair);
    r(11, 9, 2, 7, L.hair);
    r(27, 9, 2, 7, L.hair);
    r(14, 7, 12, 1, "#f1f1ec");
  } else if (id === "lorry") {
    // Dark, slicked down, receding at the temples.
    e(20, 8, 8, 3, L.hair);
    r(11, 10, 2, 7, L.hair);
    r(27, 10, 2, 7, L.hair);
    r(16, 7, 8, 2, L.hair);
  } else {
    // Sandy hair under a panama.
    r(11, 10, 2, 8, L.hair);
    r(27, 10, 2, 8, L.hair);
    r(13, 1, 14, 7, L.hat);
    r(13, 6, 14, 2, L.band);
    r(7, 8, 26, 2, L.hat);
    r(7, 9, 26, 1, "#c7b06f");
  }

  // Brows, eyes, nose.
  const browY = id === "lorry" ? 13 : 14;
  r(14, browY, 5, 1, L.brow);
  r(22, browY, 5, 1, L.brow);
  r(15, 16, 3, 2, "#ffffff");
  r(23, 16, 3, 2, "#ffffff");
  r(16, 16, 2, 2, "#1d1d22");
  r(24, 16, 2, 2, "#1d1d22");
  if (id === "lorry") {
    r(18, 17, 4, 6, L.skin);
    r(21, 18, 2, 5, shade);
    r(18, 22, 5, 1, shade);
  } else {
    r(19, 18, 2, 4, shade);
    r(19, 21, 3, 1, shade);
  }

  // Mouth.
  const my = 24 + tall;
  if (mouth === 0) {
    r(17, my, 7, 1, "#7a3b30");
  } else if (mouth === 1) {
    r(17, my - 1, 7, 2, "#4a1a18");
    r(18, my - 1, 5, 1, "#f1ece0");
  } else {
    r(17, my - 1, 7, 4, "#4a1a18");
    r(18, my - 1, 5, 1, "#f1ece0");
    r(18, my + 2, 5, 1, "#b0474a");
  }
  ctx.restore();
}

/** How long a call stays up, in seconds, including the slides in and out. */
export function boothDuration(text) {
  return SLIDE + text.length / TALK_RATE + HOLD + SLIDE;
}

/** The commentary popup, bottom-left above the HUD. `call` = { who, text, t0 }. */
function drawCall(call, now) {
  const t = now - call.t0;
  const total = boothDuration(call.text);
  if (t < 0 || t > total) return;
  const slideIn = Math.min(1, t / SLIDE);
  const slideOut = Math.min(1, (total - t) / SLIDE);
  const ease = (k) => 1 - (1 - k) * (1 - k);
  const x = Math.round(BOX_X - (BOX_W + 8) * (1 - ease(Math.min(slideIn, slideOut))));
  const y = BOX_Y;
  const voice = COMMENTATORS[call.who];

  drawPanel(x, y, BOX_W, BOX_H, "#10241a");
  const spoken = Math.max(0, Math.floor((t - SLIDE) * TALK_RATE));
  const talking = spoken < call.text.length;
  // Jaw flaps irregularly while talking, closed once he's finished.
  const flap = Math.sin(t * 31) + Math.sin(t * 19.7);
  const mouth = !talking || t < SLIDE ? 0 : flap > 0.6 ? 2 : flap > -0.4 ? 1 : 0;
  drawPortrait(voice.id, x + 6, y + 6, mouth);

  drawText(voice.name, x + 52, y + 5, { color: COLORS.gold });
  // Wrap the whole line first so words don't jump about as they're revealed.
  let left = spoken;
  wrapText(call.text, LINE_CHARS)
    .slice(0, 4)
    .forEach((line, i) => {
      const shown = line.slice(0, Math.max(0, left));
      left -= line.length + 1;
      if (shown) drawText(shown, x + 52, y + 15 + i * 9, { color: COLORS.cream });
    });
}

/** Lay a list of { who, text } calls end to end from time `t0`. */
export function scheduleCalls(calls, t0) {
  let at = t0;
  return calls.map((c) => {
    const call = { ...c, t0: at };
    at += boothDuration(c.text);
    return call;
  });
}

/** Draw whichever of the scheduled calls is on air. */
export function drawBooth(calls, now) {
  for (const call of calls) drawCall(call, now);
}

/** Whether any call is on screen (the HUD commentary row stays blank meanwhile). */
export function boothShowing(calls, now) {
  return !!calls && calls.some((c) => now >= c.t0 && now - c.t0 <= boothDuration(c.text));
}
