import { fillRect, drawPanel } from "../engine/screen.js";

/** The weather icon's size in pixels at scale 1 (sim/weather.js ids). */
export const ICON = { w: 16, h: 12 };

const SUN = "#ffd84a";
const SUN_HOT = "#ff9a2e";
const CLOUD = "#e8ece6";
const CLOUD_SHADE = "#a9b3ad";
const RAIN_CLOUD = "#8c98a2";
const RAIN_SHADE = "#5f6b76";
const DROP = "#6cb6ff";
const HAZE = "#f2e6c0";

/** A pixel weather icon (sunny, overcast, humid, hot, rain) with its top left at x, y, `px` screen pixels a dot. */
export function drawWeatherIcon(id, x, y, px = 1) {
  const dot = (dx, dy, w, h, colour) => fillRect(x + dx * px, y + dy * px, w * px, h * px, colour);
  if (id === "sunny" || id === "hot") {
    const hot = id === "hot";
    sun(dot, 8, 6, hot ? SUN_HOT : SUN, hot ? 3 : 2);
    if (hot) {
      // Heat shimmer under it.
      dot(2, 11, 3, 1, SUN_HOT);
      dot(7, 11, 3, 1, SUN_HOT);
      dot(12, 11, 3, 1, SUN_HOT);
    }
    return;
  }
  if (id === "humid") {
    sun(dot, 10, 4, SUN, 2);
    // Haze across the sun.
    for (const row of [6, 9]) dot(1, row, 14, 1, HAZE);
    dot(3, 11, 10, 1, HAZE);
    return;
  }
  const rain = id === "rain";
  cloud(dot, rain ? RAIN_CLOUD : CLOUD, rain ? RAIN_SHADE : CLOUD_SHADE);
  if (rain) {
    for (const [dx, dy] of [
      [3, 9],
      [7, 10],
      [11, 9],
      [5, 11],
      [9, 11],
    ])
      dot(dx, dy, 1, 1, DROP);
  }
}

/** The same icon on a small dark tile, so it reads over the ground (the HUD's, beside the score box). */
export function drawWeatherTile(id, x, y) {
  drawPanel(x, y, ICON.w + 6, ICON.h + 6, "rgba(10,28,18,0.85)", "#8a6d1f");
  drawWeatherIcon(id, x + 3, y + 3);
}

function sun(dot, cx, cy, colour, r) {
  dot(cx - r, cy - r + 1, 2 * r, 2 * r - 2, colour);
  dot(cx - r + 1, cy - r, 2 * r - 2, 2 * r, colour);
  // Rays.
  dot(cx - 1, cy - r - 2, 1, 1, colour);
  dot(cx - 1, cy + r + 1, 1, 1, colour);
  dot(cx - r - 2, cy - 1, 1, 1, colour);
  dot(cx + r + 1, cy - 1, 1, 1, colour);
  dot(cx - r - 1, cy - r - 1, 1, 1, colour);
  dot(cx + r, cy - r - 1, 1, 1, colour);
  dot(cx - r - 1, cy + r, 1, 1, colour);
  dot(cx + r, cy + r, 1, 1, colour);
}

function cloud(dot, colour, shade) {
  dot(4, 2, 5, 2, colour);
  dot(9, 3, 4, 2, colour);
  dot(2, 4, 12, 3, colour);
  dot(1, 5, 14, 2, colour);
  dot(1, 7, 14, 1, shade);
}
