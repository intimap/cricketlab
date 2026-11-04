import { COLORS } from "../engine/screen.js";
import { LIGHTS } from "../render/light.js";
import { weatherLight } from "../render/weather-look.js";
import { startLook } from "./effects-auto.js";
import { turnLight } from "../render/venue/venue-light.js";
import { bowlingEnd } from "./venue-view.js";

/**
 * The light through the day in the match scene. The menu's TIME is when play starts; a Test moves on a
 * time each session (lunch, tea), back to the start each morning, and a limited-overs game of 20 overs or
 * more plays its first innings in the starting light, the chase in the next and its second half in the one
 * after. The nets and Classic Matches keep the time chosen. The day's weather is laid over it
 * (render/weather-look.js), darker while rain has stopped play.
 */

export const TIMES = ["midday", "afternoon", "evening", "night"];
/** Limited-overs games shorter than this are over before the light changes. */
const LIGHT_CHANGES_FROM = 20;

const startOf = (light) => Math.max(0, TIMES.indexOf(light));

/** How many times on from the start (0, 1 or 2) it is now. */
function stepOf(scene) {
  const { match, cfg } = scene;
  if (match.clock) return match.clock.session;
  if (scene.nets || cfg.format !== "match" || cfg.overs < LIGHT_CHANGES_FROM) return 0;
  const inn = match.inn;
  if (match.innings.length < 2) return 0;
  return inn.legal < (inn.oversLimit * 6) / 2 ? 1 : 2;
}

/** The time of day now (a light.js id). */
export function timeNow(scene) {
  return TIMES[Math.min(TIMES.length - 1, startOf(scene.cfg.light) + stepOf(scene))];
}

/** The time play finishes in, for a game starting at `light` (the menu's line, and the Test's pink ball). */
export function endTime(cfg) {
  const changes = cfg.format === "test" || (cfg.format === "match" && cfg.overs >= LIGHT_CHANGES_FROM);
  return TIMES[Math.min(TIMES.length - 1, startOf(cfg.light) + (changes ? 2 : 0))];
}

/** The ball: a Test's red one, pink if it goes on under lights; a white one otherwise (render/sprites.js). */
export function ballKindFor(cfg) {
  if (cfg.format !== "test") return "white";
  return endTime(cfg) === "night" ? "pink" : "red";
}

/** Is rain falling on screen: play stopped for it, or the morning's report of a delayed start? */
export function raining(scene) {
  if (scene.phase === "rain") return true;
  const match = scene.match;
  return scene.phase === "forecast" && !!(match.clock ? match.clock.lostToday : match.oversLost);
}

/**
 * Bring the light up to date: the time, the weather and the rain. The ground is rebuilt only when one of
 * them has changed (a few times a day).
 */
export function updateLight(scene) {
  const time = timeNow(scene);
  const weather = scene.match.weather?.id ?? "sunny";
  const wet = raining(scene);
  // A ground built from a map keeps its sun when the ends change, so the players' shadows turn round.
  const end = scene.ground?.venue ? bowlingEnd(scene) : 0;
  const key = `${time}:${weather}:${wet}:${end}`;
  if (key === scene.lightKey) return;
  const before = scene.lightTime;
  scene.lightKey = key;
  scene.lightTime = time;
  scene.lightBase = weatherLight(LIGHTS[time] ?? LIGHTS.midday, weather, wet);
  scene.baseLight = turnLight(scene.lightBase, end);
  scene.light = startLook(scene.baseLight);
  if (scene.groundArt) scene.buildGround();
  if (before && before !== time && time === "night") scene.flash("FLOODLIGHTS ON", COLORS.gold);
}
