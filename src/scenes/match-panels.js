import { selectedWicketSide } from "./bowling-side.js";
import { drawSetupPanel } from "../render/bowling-setup.js";
import { drawBatterMeters, meterAnchors } from "../render/batter-meters.js";
import { WEAKNESS_NAMES } from "../sim/scouting.js";
import { WIDTH, COLORS, fillRect, drawPanel, drawBar } from "../engine/screen.js";
import { drawText, wrapText } from "../engine/text.js";
import { clamp } from "../math.js";
import { CREASE } from "../sim/geometry.js";
import { movementParts, DELIVERY_NAMES } from "../sim/delivery.js";
import { PRESET_LABELS } from "../sim/field.js";
import { closeFromBowlerEnd, projectWide } from "../render/camera.js";
import { playerKit } from "../render/sprites.js";
import { drawTimingMeter, drawFloat } from "../render/feedback.js";
import { floatAge, timingFade } from "./match-feedback.js";
import { STRIKER_X, footworkOf } from "./batter-pose.js";
import { METER_TRACK_FROM, meterPos, noBallPos } from "../sim/runup.js";
import { HUD_Y, staminaColor, drawScorecard } from "../render/hud.js";
import { strikerPlace } from "./match-striker.js";
import { drawWeatherReport, drawRainReport } from "../render/weather-report.js";
import { declareAdvice } from "./match-test.js";
import { gradeTap } from "../sim/rhythm.js";
import { overReview } from "../sim/over-review.js";
import { drawOverSummary } from "../render/over-summary.js";

/**
 * The match's panels over the picture: the bowling setup and choice of bowler, the speed gun, the
 * batter's eye and pressure panel, the coach's card in the nets, the release meter and the arcade
 * feedback (timing meter, floating words). Drawing only; scenes/match-view.js calls drawPanels.
 */

const PANEL_TEXT = { align: "center", outline: "rgba(0,0,0,0.7)" };
/** Is the wide view on screen (rather than the close one)? DRS and appeals always use the close view. */
export function showingWide(scene) {
  const tracking = scene.phase === "review" || scene.phase === "appeal" || scene.phase === "decision";
  return (scene.view === "wide" || scene.phase === "fieldEdit") && !tracking;
}

/** The speed gun's tallest (speed plus two lines of movement), in the bottom right corner above the score bar. */
export const SPEED_GUN_MAX_H = 42;
// --- Prompts and panels over either view. ---

export function drawPanels(scene) {
  const inn = scene.inn;
  if (scene.phase === "setup") drawSetupPanel(scene, selectedWicketSide(scene));

  if (scene.phase === "ready" && scene.human === "bat") {
    if (Math.floor(scene.now * 2) % 2 === 0) {
      drawText("PRESS SPACE TO FACE UP", WIDTH / 2, 6, { ...PANEL_TEXT, color: COLORS.gold, scale: 2 });
    }
    drawText("ESC = MENU & INSTRUCTIONS", WIDTH / 2, 24, { ...PANEL_TEXT, color: COLORS.dim });
    if (declareAdvice(scene)) {
      drawText("THE DRESSING ROOM SAYS DECLARE: PRESS C TWICE", WIDTH / 2, 36, { ...PANEL_TEXT, color: COLORS.gold });
    }
  }
  if (scene.phase === "forecast" && scene.report) drawWeatherReport(scene.report, scene.now);
  if (scene.phase === "rain" && scene.rainReport) drawRainReport(scene.rainReport, scene.now);
  if (scene.phase === "overEnd" && scene.human === "bowl" && inn.lastOverPitches.length) {
    const dots = inn.lastOverPitches;
    const review = overReview(dots);
    const wkts = review.wickets ? `, ${review.wickets} WICKET${review.wickets > 1 ? "S" : ""}` : "";
    const title = `OVER ${inn.overNo}: ${review.runs} RUN${review.runs === 1 ? "" : "S"}${wkts}`;
    drawOverSummary({ title, dots, line: review.line, facing: scene.screenTurn }, scene.now);
  }

  if (scene.phase === "flight" && scene.human === "bat" && scene.cur?.contactDone && scene.cur.play) {
    const live = scene.cur.play.live;
    const dir = scene.runDirection(live);
    if (dir !== null && !live.wicket && !live.boundary) {
      const running = live.runners[0].target !== null;
      const text = running ? (dir === 1 ? "UP: GET BACK" : "DOWN: GET BACK") : dir === 1 ? "UP: RUN" : "DOWN: RUN";
      drawText(text, WIDTH / 2, 6, { ...PANEL_TEXT, color: running ? COLORS.cream : COLORS.gold, scale: 2 });
    }
  }

  if (scene.phase === "runup" && scene.human === "bowl" && scene.cur && scene.cur.tRun < 0.6) {
    drawText("SPACE ON HIS LAST TWO STRIDES, THEN AT THE DELIVERY STRIDE  -  HOLD LEFT/RIGHT FOR AFTERTOUCH", WIDTH / 2, 6, {
      ...PANEL_TEXT,
      color: COLORS.gold,
    });
  }
  // Release meter: the marker runs towards the delivery stride; hit the gold zone.
  if (scene.human === "bowl" && scene.cur && (scene.phase === "runup" || (scene.phase === "flight" && scene.phaseT < 0.9))) {
    drawReleaseMeter(scene);
  }

  // Appeals and reviews.
  const cur = scene.cur;
  const res = cur?.play?.res;
  const blink = Math.floor(scene.now * 3) % 2 === 0;
  if (scene.human === "bowl" && scene.phase === "flight" && cur?.contactDone && res?.padHit && !cur.appealed && blink) {
    drawText("H: APPEAL!", WIDTH / 2, 6, { ...PANEL_TEXT, color: COLORS.gold, scale: 2 });
  }
  if (scene.phase === "appeal" && blink) drawText("H: APPEAL!", WIDTH / 2, 6, { ...PANEL_TEXT, color: COLORS.gold, scale: 2 });

  if (scene.phase === "chooseBowler") {
    drawPanel(150, 60, 340, 40 + inn.bowl.length * 22);
    const title = inn.midOver ? `FINISH OVER ${inn.overNo + 1}: CHOOSE A BOWLER` : `OVER ${inn.overNo + 1}: CHOOSE YOUR BOWLER`;
    drawText(title, WIDTH / 2, 68, { align: "center", color: COLORS.gold });
    inn.bowl.forEach((b, i) => {
      const y = 84 + i * 22;
      const available = inn.canBowl(i);
      if (i === scene.selBowler) fillRect(156, y - 3, 328, 20, "#24563a");
      drawText(`${i + 1}. ${b.p.name.toUpperCase()}`, 162, y, { color: available ? COLORS.cream : COLORS.grey });
      drawText(`${b.p.bowl.style.toUpperCase()}  ${inn.bowlerOvers(b)}-${b.maidens}-${b.runs}-${b.wkts}`, 162, y + 9, {
        color: COLORS.dim,
      });
      drawBar(400, y + 2, 60, 5, b.stamina, staminaColor(b.stamina));
      if (b.suspended) drawText("TAKEN OFF", 400, y + 10, { color: COLORS.red });
      else if (!available) drawText("BOWLED LAST OVER", 400, y + 10, { color: COLORS.grey });
      else if (b.bouncerWarnings) drawText("WARNED: BOUNCERS", 400, y + 10, { color: COLORS.gold });
      else if (b.spell >= 5) drawText(`SPELL ${b.spell} OV`, 400, y + 10, { color: COLORS.dim });
    });
    drawText(`ARROWS/1-${inn.bowl.length} + ENTER.  STAMINA RECOVERS WHEN RESTED.`, WIDTH / 2, 92 + inn.bowl.length * 22, {
      align: "center",
      color: COLORS.dim,
    });
  }

  if (scene.phase === "simSummary") {
    drawPanel(70, 40, 500, 250);
    drawText("SIMULATION", WIDTH / 2, 48, { align: "center", color: COLORS.gold, scale: 2 });
    const lines = scene.simLines.slice(-18);
    if (!lines.length) drawText("QUIET PASSAGE OF PLAY. NOTHING TO REPORT.", 82, 74, { color: COLORS.cream });
    lines.forEach((line, i) =>
      drawText(line.length > 80 ? line.slice(0, 80) : line, 82, 70 + i * 11, {
        color: line.includes("OUT") ? COLORS.red : line.includes("!") ? COLORS.gold : COLORS.cream,
      }),
    );
    drawText(`${inn.batTeam.abbr} ${inn.runs}/${inn.wkts} (${inn.oversText} OV)  BALL: ${inn.ball.label}`, WIDTH / 2, 272, {
      align: "center",
      color: COLORS.white,
    });
    drawText("SPACE TO CONTINUE", WIDTH / 2, 282, { align: "center", color: COLORS.dim });
  }

  if (scene.phase === "fieldEdit") {
    drawPanel(4, 4, 250, 34, "#0d2318");
    drawText(scene.human === "bowl" ? "DRAG FIELDERS WITH THE MOUSE.  F = PRESET" : "THE OPPOSITION FIELD", 10, 10, {
      color: COLORS.gold,
    });
    drawText(`FIELD: ${inn.customField ? "CUSTOM" : PRESET_LABELS[inn.preset]}   V/ENTER = DONE`, 10, 22, {
      color: COLORS.cream,
    });
  }

  if (scene.feedback && (scene.phase === "after" || scene.phase === "return")) drawCoachCard(scene);
  if (!scene.nets && SPEED_GUN_PHASES.has(scene.phase)) drawSpeedGun(scene);
  if (METER_PHASES.has(scene.phase)) drawBatterPanel(scene);
  if (scene.phase === "pause") scene.pauseMenu.draw(inn, scene.closeEnd);

  if (scene.phase === "inningsEnd") {
    const ending = scene.ending;
    drawScorecard(inn, 20, 18, 600, 290, ending.title);
    drawText(ending.sub, WIDTH / 2, 284, { align: "center", color: COLORS.cream });
    if (ending.followOn) drawFollowOnChoice(scene.followOn.enforce, 296);
    else {
      const prompt = ending.prompt ?? (scene.hasScoreboard ? "ENTER = HIGH SCORES" : "ENTER = MENU");
      drawText(prompt, WIDTH / 2, 296, { align: "center", color: COLORS.gold });
    }
  }
}

/** The player's follow-on call (a Test): the chosen option bright, arrows to change it. */
function drawFollowOnChoice(enforce, y) {
  drawText(enforce ? "> ENFORCE THE FOLLOW-ON <" : "ENFORCE THE FOLLOW-ON", WIDTH / 2 - 8, y, {
    align: "right",
    color: enforce ? COLORS.gold : COLORS.dim,
  });
  drawText(enforce ? "BAT AGAIN" : "> BAT AGAIN <", WIDTH / 2 + 8, y, { color: enforce ? COLORS.dim : COLORS.gold });
}

const SPEED_GUN_PHASES = new Set(["flight", "after", "return", "appeal", "decision"]);

/** Broadcast-style speed gun: pace as it's bowled, then the movement once it has passed the bat. */
function drawSpeedGun(scene) {
  const d = scene.cur?.delivery;
  if (!d) return;
  const played = scene.cur.contactDone || scene.cur.t > 1.2;
  const parts = played ? movementParts(d) : [];
  const shown = played ? (parts.length ? parts : ["STRAIGHT ON"]) : [];
  // Batting, what he bowled, once it's been played (it isn't on the score bar before).
  if (played && scene.human === "bat") shown.unshift(DELIVERY_NAMES[scene.cur.intent.type] ?? "");
  const w = 108;
  const h = 24 + shown.length * 9;
  const x = WIDTH - w - 4;
  const y = HUD_Y - h - 3;
  drawPanel(x, y, w, h, "rgba(10,28,18,0.88)", COLORS.gold2);
  drawText(`${Math.round(d.speed * 3.6)} KM/H`, x + w / 2, y + 5, { align: "center", color: COLORS.gold, scale: 2 });
  shown.forEach((line, i) => drawText(line, x + w / 2, y + 21 + i * 9, { align: "center", color: COLORS.cream }));
}

const METER_PHASES = new Set(["ready", "runup", "flight", "after", "return", "appeal", "decision", "review"]);

/** The shared meter panel returns once the run-up has begun. */
function drawBatterPanel(scene) {
  const striker = scene.inn.bat[scene.inn.striker];
  const eye = striker.eye;
  // Bowling at him: the weakness he's given away (sim/scouting.js), as a reminder where to bowl.
  const tag = scene.human === "bowl" && striker.weaknessShown ? (WEAKNESS_NAMES[striker.p.weakness]?.tag ?? "") : "";
  drawBatterMeters({
    tag,
    eye,
    pressure: scene.inn.pressure,
    eyeShown: scene.juice.shown.eye ?? eye,
    pressureShown: scene.juice.shown.pressure ?? scene.inn.pressure,
    now: scene.now,
    top: 4,
  });
}

/** Nets: the coach's verdict on the last ball. */
function drawCoachCard(scene) {
  const fb = scene.feedback;
  const lines = fb.lines.flatMap((l) => wrapText(l, 62));
  const h = 34 + lines.length * 10;
  const x = 110;
  const y = 34;
  const accent = fb.grade === "good" ? "#7cd67c" : fb.grade === "poor" ? COLORS.red : COLORS.gold;
  drawPanel(x, y, 420, h, "rgba(10,28,18,0.92)", accent);
  const tally = scene.netsTally;
  drawText(`COACH  -  ${fb.title}`, x + 8, y + 6, { color: accent });
  drawText(`BALL ${tally.balls}   GOOD ${tally.good}`, x + 412, y + 6, { color: COLORS.dim, align: "right" });
  lines.forEach((line, i) =>
    drawText(line, x + 8, y + 19 + i * 10, { color: line.startsWith("COACH:") ? COLORS.gold : COLORS.cream }),
  );
  if (scene.phase === "after" && scene.phaseT > 0.6) {
    drawText("SPACE = NEXT BALL", x + 210, y + h - 9, { align: "center", color: COLORS.dim });
  }
}

/** Bar showing the run-up against the release window, and where the last release landed. */
const RELEASE_GOLD = "#ffe066";
const TIMING_METER = { x: 440, y: 268 };

/**
 * The arcade feedback (scenes/match-feedback.js): words floating off the striker and the HUD's eye and
 * pressure bars, and the player's timing meter beside the striker.
 */
export function drawFeedback(scene) {
  const fb = scene.juice;
  const anchors = METER_PHASES.has(scene.phase) ? meterAnchors() : {};
  if (fb.floats.some((f) => f.anchor === "striker")) {
    if (showingWide(scene)) {
      const p = projectWide(STRIKER_X, 2, CREASE);
      anchors.striker = { x: p.x, y: p.y - 6 };
    } else {
      const kit = playerKit(scene.kitBat, scene.inn.bat[scene.inn.striker].p);
      const place = strikerPlace(scene, kit, closeFromBowlerEnd(), footworkOf(scene, scene.cur, scene.cur ? scene.clock() : 0));
      anchors.striker = { x: place.x, y: place.y - 112 * place.scale };
    }
  }
  for (const f of fb.floats) {
    const at = anchors[f.anchor];
    if (at) drawFloat(f.text, at.x, at.y, f.color, floatAge(f, scene.now));
  }
  // On the open grass to the off side of the striker, clear of the stumps and the panels.
  if (fb.timing) drawTimingMeter(TIMING_METER.x, TIMING_METER.y, fb.timing.timing, timingFade(fb, scene.now));
}

function drawReleaseMeter(scene) {
  const cur = scene.cur;
  const r = cur.runup;
  const from = METER_TRACK_FROM;
  const to = 1 + 0.3 / r.dur;
  const x0 = 200;
  const w = 240;
  const y = 22;
  const toX = (pos) => x0 + ((pos - from) / (to - from)) * w;
  fillRect(x0 - 1, y - 1, w + 2, 8, COLORS.black);
  fillRect(x0, y, w, 6, "#203a2a");
  // Too late: no-ball territory.
  fillRect(toX(noBallPos(r)), y, toX(to) - toX(noBallPos(r)), 6, COLORS.red);
  // The gold zone, bright with a crisp dark edge either side so it reads against the bar.
  const half = r.zone / r.dur;
  const zoneL = Math.round(toX(1 - half));
  const zoneW = Math.max(3, Math.round(toX(1 + half)) - zoneL);
  fillRect(zoneL - 1, y - 1, zoneW + 2, 8, COLORS.black);
  fillRect(zoneL, y, zoneW, 6, RELEASE_GOLD);
  // The two beats before the release: a notch each, lit by how well it was tapped.
  for (const b of cur.beats ?? []) {
    if (b.given) continue;
    const bx = Math.round(toX(meterPos(r, b.at)));
    const q = b.error === null ? null : gradeTap(b.error, cur.intent.effort);
    const colour =
      q === null ? (b.missed ? COLORS.red : COLORS.cream) : q > 0.95 ? RELEASE_GOLD : q > 0 ? COLORS.cream : COLORS.red;
    fillRect(bx - 2, y - 2, 5, 10, COLORS.black);
    fillRect(bx - 1, y - 1, 3, 8, colour);
  }
  const at = cur.delivery ? cur.releaseMark : meterPos(r, cur.tRun);
  fillRect(clamp(toX(at), x0, x0 + w) - 1, y - 3, 3, 12, COLORS.white);
  // Aftertouch, shown the way it was pushed on screen.
  const touch = (cur.aftertouch ?? 0) * scene.screenTurn;
  if (touch) {
    const mid = x0 + w / 2;
    fillRect(touch > 0 ? mid : mid + touch * 60, y + 10, Math.abs(touch) * 60, 3, COLORS.gold);
    drawText(scene.spinner ? "EXTRA SPIN" : "EXTRA SWING", mid, y + 15, { ...PANEL_TEXT, color: COLORS.gold });
  }
}
