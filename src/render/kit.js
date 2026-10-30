import { ctx, fillEllipse } from "../engine/screen.js";

/**
 * What every player is drawn with: kit colours, a player's own looks (skin, hair, beard, height),
 * facial hair, and the shared drawing helpers (mirroring for the front view, sun-stretched shadows).
 */

export const BAT_FACE = "#e6cc92";
export const BAT_EDGE = "#b8955a";
export const PAD = "#fbfbf6";
export const PAD_SHADE = "#c9c9c0";
export const BOOT = "#3a3a3a";
export const HAIR = "#3b2a1e";

/** Draw something mirrored left-to-right about screen column x (front view <-> back view). */
export function mirrored(x, draw) {
  const cx = Math.round(x);
  ctx.save();
  ctx.translate(cx * 2, 0);
  ctx.scale(-1, 1);
  flipped = !flipped;
  draw();
  flipped = !flipped;
  ctx.restore();
}
let flipped = false;

/** How far shadows are drawn out by a low sun (light.js); 1 is round, straight underneath. */
let shadowStretch = 1;
export function setShadowStretch(stretch) {
  shadowStretch = stretch;
}

/** A shadow on the ground round (x, y): drawn out long, towards the camera and to the right, when the sun is low. */
export function groundShadow(x, y, rx, ry, alpha) {
  const s = shadowStretch;
  // Mirrored figures still cast to the screen's right.
  const lean = (s - 1) * rx * 0.75 * (flipped ? -1 : 1);
  fillEllipse(x + lean, y + (s - 1) * ry * 0.4, rx * s, ry, `rgba(0,0,0,${alpha})`);
}

/** A player's own kit: the team's, with his skin, hair, beard, shirt number and height (see teams.js looks). */
export function playerKit(teamKit, player) {
  const look = player?.look ?? {};
  return {
    ...teamKit,
    skin: look.skin ?? teamKit.skin,
    hair: look.hair ?? HAIR,
    hairStyle: look.hairStyle ?? "short",
    beard: look.beard ?? "none",
    number: look.number ?? 0,
    extras: look.extras ?? [],
    height: look.height ?? 1.82,
  };
}

/** Test whites with team-coloured cap and accents. */
export function makeKit(cap, cap2, skin = "#d8a27a") {
  return { cap, cap2, shirt: "#f7f2e2", shade: "#cdc4a5", pants: "#eee6cf", skin };
}

export function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 50);
  const g = Math.min(255, ((n >> 8) & 255) + 50);
  const b = Math.min(255, (n & 255) + 50);
  return `rgb(${r},${g},${b})`;
}

export function darken(hex, amount = 40) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - amount);
  const g = Math.max(0, ((n >> 8) & 255) - amount);
  const b = Math.max(0, (n & 255) - amount);
  return `rgb(${r},${g},${b})`;
}

/**
 * Stubble, moustache or beard on a face seen from the front. `h` is the head
 * centre on screen, `k` the figure's pixels per unit; under a helmet only the
 * chin shows.
 */
export function drawFacialHair(kit, head, h, k, helmet, rect) {
  const beard = kit.beard ?? "none";
  const hair = kit.hair ?? HAIR;
  if (beard === "full") fillEllipse(h.x, h.y + (helmet ? 4.6 : 3) * k, 3.6 * k, (helmet ? 1.2 : 2) * k, hair);
  else if (beard === "stubble")
    fillEllipse(h.x, h.y + (helmet ? 4.6 : 3.2) * k, 3.2 * k, (helmet ? 0.9 : 1.6) * k, "rgba(40,28,20,0.35)");
  if (!helmet && (beard === "moustache" || beard === "full")) rect(head.x - 1.8, head.y + 1.5, 3.6, 0.9, hair);
}
