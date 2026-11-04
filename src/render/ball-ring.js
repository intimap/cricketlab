import { fillRect } from "../engine/screen.js";

/**
 * A half ring round the ball in flight (scenes/ball-ring.js decides it): coloured by the length it's going to
 * (purple yorker, green full, gold good, red short), on the side it will move to; both sides, a touch fainter,
 * when it's going straight on. Two pixels thick with a dark edge, so it reads against the pitch and the crowd.
 */
export const RING_COLOURS = { purple: "#c07cff", green: "#7cd67c", gold: "#ffd84a", red: "#ff6a5a" };
const EDGE = "rgba(10,12,16,0.75)";
/** Pixels between the ball and the ring, and the ring's least radius (a distant ball is small). */
const GAP = 4;
const MIN_RADIUS = 7;

export function drawBallRing(x, y, radius, ring, fade = 1) {
  const colour = RING_COLOURS[ring.length] ?? RING_COLOURS.gold;
  const r = Math.max(MIN_RADIUS, radius + GAP);
  const alpha = fade * (ring.side === 0 ? 0.85 : 1);
  const paint = alpha < 1 ? withAlpha(colour, alpha) : colour;
  const edge = fade < 1 ? `rgba(10,12,16,${(0.75 * fade).toFixed(2)})` : EDGE;
  // The half facing `side` (right for +1), or the whole ring: its dark edge first, then the colour on it.
  const arc = (rad, paintWith) => {
    const steps = Math.max(16, Math.round(rad * 6));
    for (let i = 0; i <= steps; i++) {
      const a = ring.side === 0 ? (i / steps) * Math.PI * 2 : -Math.PI / 2 + (i / steps) * Math.PI;
      const dx = Math.cos(a) * rad * (ring.side === 0 ? 1 : ring.side);
      fillRect(Math.round(x + dx), Math.round(y + Math.sin(a) * rad), 1, 1, paintWith);
    }
  };
  arc(r - 1, edge);
  arc(r + 2, edge);
  arc(r, paint);
  arc(r + 1, paint);
  // A movement ring ends in two short ticks pointing the way it goes, so the side reads at a glance.
  if (ring.side !== 0) {
    for (const end of [-1, 1]) {
      const tipY = Math.round(y + end * (r + 0.5));
      fillRect(Math.round(x), tipY, 1, 1, paint);
      fillRect(Math.round(x - ring.side), tipY, 1, 1, paint);
    }
  }
}
const withAlpha = (hex, a) =>
  `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${Math.max(0, Math.min(1, a)).toFixed(2)})`;
