/**
 * Every image the game loads, by id. Grounds refer to their art by these ids
 * (see render/grounds.js). Keep to this exact `"id": new URL(...)` form:
 * tools/build-single.py rewrites it into inline imports for one-file builds.
 */
export const ASSET_URLS = {
  "ground-close": new URL("../assets/ground-close.png", import.meta.url),
  "ground-wide": new URL("../assets/ground-wide.png", import.meta.url),
  "close/sky": new URL("../assets/close/sky.png", import.meta.url),
  "close/clouds": new URL("../assets/close/clouds.png", import.meta.url),
  "close/treeline": new URL("../assets/close/treeline.png", import.meta.url),
  "close/stands": new URL("../assets/close/stands.png", import.meta.url),
  "close/fence-picket": new URL("../assets/close/fence-picket.png", import.meta.url),
  "close/fence-ads": new URL("../assets/close/fence-ads.png", import.meta.url),
  "wide/sky": new URL("../assets/wide/sky.png", import.meta.url),
  "wide/treeline": new URL("../assets/wide/treeline.png", import.meta.url),
  "wide/stands": new URL("../assets/wide/stands.png", import.meta.url),
  "wide/fence-picket": new URL("../assets/wide/fence-picket.png", import.meta.url),
  "wide/fence-ads": new URL("../assets/wide/fence-ads.png", import.meta.url),
  "wide/trees-left": new URL("../assets/wide/trees-left.png", import.meta.url),
  "wide/trees-right": new URL("../assets/wide/trees-right.png", import.meta.url),
  "theg/close/sky": new URL("../assets/theg/close/sky.png", import.meta.url),
  "theg/close/skyline": new URL("../assets/theg/close/skyline.png", import.meta.url),
  "theg/close/stands": new URL("../assets/theg/close/stands.png", import.meta.url),
  "theg/close/fence-ads": new URL("../assets/theg/close/fence-ads.png", import.meta.url),
  "theg/wide/sky": new URL("../assets/theg/wide/sky.png", import.meta.url),
  "theg/wide/skyline": new URL("../assets/theg/wide/skyline.png", import.meta.url),
  "theg/wide/stands": new URL("../assets/theg/wide/stands.png", import.meta.url),
  "theg/wide/fence-ads": new URL("../assets/theg/wide/fence-ads.png", import.meta.url),
};

/** Load them all: resolves to { id: HTMLImageElement }. */
export async function loadAssets(loadImage) {
  const entries = await Promise.all(Object.entries(ASSET_URLS).map(async ([id, url]) => [id, await loadImage(url)]));
  return Object.fromEntries(entries);
}
