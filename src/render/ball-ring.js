import { fillRect } from "../engine/screen.js";

/**
 * A half ring round the ball in flight (scenes/ball-ring.js decides it): coloured by the length it's going to
 * (purple yorker, green full, gold good, red short), on the side it will move to; both sides, fainter, when
 * it's going straight on. Pixel dots on a circle a few pixels out from the ball.
 */
export const RING_COLOURS = { purple: "#c07cff", green: "#7cd67c", gold: "#ffd84a", red: "#ff6a5a" };

export function drawBallRing(x, y, radius, ring, fade = 1) {
  const colour = RING_COLOURS[ring.length] ?? RING_COLOURS.gold;
  const r = Math.max(5, radius + 3);
  const steps = Math.max(12, Math.round(r * 4));
  // Straight on: the whole ring, a little fainter.
  const alpha = fade * (ring.side === 0 ? 0.75 : 1);
  const paint = alpha < 1 ? withAlpha(colour, alpha) : colour;
  for (let i = 0; i <= steps; i++) {
    // The half facing `side` (right for +1), or the whole ring.
    const a = ring.side === 0 ? (i / steps) * Math.PI * 2 : -Math.PI / 2 + (i / steps) * Math.PI;
    const dx = Math.cos(a) * r * (ring.side === 0 ? 1 : ring.side);
    fillRect(Math.round(x + dx), Math.round(y + Math.sin(a) * r), 1, 1, paint);
  }
}

const withAlpha = (hex, a) =>
  `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${Math.max(0, Math.min(1, a)).toFixed(2)})`;
