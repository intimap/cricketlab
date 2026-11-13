import { WIDTH, COLORS, fillRect, drawPanel, drawBar } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { clamp } from "../math.js";
import { hitsStumps } from "../sim/delivery.js";
import { projectClose } from "./camera.js";
import { drawBroadcastBanner, drawDisplayBanner } from "./hud.js";

/**
 * The DRS broadcast's beats (s into the review phases): the on-field call; REPLAY on screen, then the ball
 * tracking; its verdict; the end.
 */
export const ON_FIELD_TIME = 0.9;
export const REPLAY_TIME = 2;
export const TRACKING_TIME = REPLAY_TIME + 3.4;
export const REVIEW_END = REPLAY_TIME + 6.4;
/** A wicket or boundary's celebration holds this long (s) before it can be skipped. */
export const CELEBRATION_HOLD = 2;

/** Presentation only: the rules still resolve the review in match-decisions. */
export function reviewResult(cur) {
  const verdict = cur.tracking.verdict;
  const out = verdict === "out" ? true : verdict === "notOut" ? false : cur.onField;
  return { out, changed: out !== cur.onField };
}

const SAFE = "#66d890";

/** Why a ball that was hitting the stumps is still not out, for the verdict card. */
const SAVED_BY = {
  "PITCHING: OUTSIDE LEG": "PITCHED OUTSIDE LEG",
  "IMPACT: OUTSIDE OFF": "IMPACT OUTSIDE THE LINE",
};

export function drawMatchBroadcast(scene) {
  const cur = scene.cur;
  if (scene.phase === "decision") {
    drawBroadcastBanner(`ON-FIELD: ${cur.onField ? "OUT" : "NOT OUT"}`, cur.onField ? COLORS.red : SAFE, "", 1);
    const side = cur.onField ? "bat" : "bowl";
    const left = scene.inn.reviews[side];
    if (scene.phaseT >= ON_FIELD_TIME && side === (scene.human === "bowl" ? "bowl" : "bat") && left > 0) {
      const secs = scene.reviewTimeLeft;
      drawPanel(150, 165, 340, 57, "rgba(10,28,18,0.96)", COLORS.gold);
      drawText("R: REVIEW | SPACE: ACCEPT", WIDTH / 2, 175, { align: "center", color: COLORS.gold });
      drawText(`${left} REVIEWS LEFT   ${Math.ceil(secs)} SECONDS`, WIDTH / 2, 190, { align: "center", color: COLORS.cream });
      drawBar(162, 207, 316, 4, secs / 10, secs < 3 ? COLORS.red : COLORS.gold);
    }
  }
  if (scene.phase === "review") {
    if (scene.phaseT < REPLAY_TIME) drawBroadcastBanner("REPLAY", COLORS.gold, "BALL TRACKING", Math.min(1, scene.phaseT / 0.15));
    else if (scene.phaseT < TRACKING_TIME) drawReview(scene, scene.phaseT - REPLAY_TIME);
    else {
      const { out, changed } = reviewResult(cur);
      const sub =
        cur.tracking.verdict === "umpiresCall"
          ? "UMPIRE'S CALL - REVIEW RETAINED"
          : (!out && SAVED_BY[cur.tracking.reason]) || "THIRD UMPIRE";
      // The call first, in words; then the verdict, in the display font.
      if (scene.phaseT < TRACKING_TIME + 1.5)
        drawBroadcastBanner(changed ? "DECISION OVERTURNED" : "ORIGINAL DECISION STANDS", out ? COLORS.red : SAFE, sub, 1);
      else drawDisplayBanner(out ? "OUT" : "NOT OUT", out ? "out" : "notOut", sub, 1);
    }
  }
  const rec = cur?.done?.rec;
  if (scene.phase === "after" && (rec?.wicket || rec?.boundary)) {
    const batter = scene.inn.bat[rec.wicket ? rec.wicket.batter : rec.striker];
    // An LBW says so (in white); any other wicket is a WICKET! (red).
    const lbw = rec.wicket?.how === "lbw";
    const title = lbw ? "LBW!" : rec.wicket ? "WICKET!" : rec.boundary === 6 ? "SIX!" : "FOUR!";
    const palette = lbw ? "lbw" : rec.wicket ? "out" : rec.boundary === 6 ? "six" : "four";
    const how = rec.wicket
      ? (rec.wicket.how === "runout" ? "RUN OUT" : rec.wicket.caughtBehind ? "CAUGHT BEHIND" : rec.wicket.how.toUpperCase()) +
        "  -  "
      : "";
    drawDisplayBanner(
      title,
      palette,
      `${how}${batter.p.short.toUpperCase()} ${batter.runs} (${batter.balls})`,
      Math.min(1, scene.phaseT / 0.15),
      scene.phaseT >= CELEBRATION_HOLD,
    );
  }
}

function drawTrackingBoxes(lines, time) {
  drawText("BALL TRACKING", 510, 58, { align: "center", color: COLORS.gold });
  lines.forEach(([label, value], i) => {
    const ready = time >= 1 + i * 0.6;
    const safe = value.startsWith("OUTSIDE") || value === "MISSING" || value === "GOING OVER" || value === "IN LINE";
    const color = !ready ? COLORS.dim : value === "UMPIRE'S CALL" ? COLORS.gold : safe ? SAFE : COLORS.red;
    drawPanel(405, 73 + i * 43, 215, 37, "rgba(10,28,18,0.96)", color);
    drawText(label, 415, 79 + i * 43, { color: COLORS.dim });
    drawText(ready ? value : "CHECKING...", 512, 92 + i * 43, { align: "center", color });
  });
}

/** The ball-tracking replay, `t` seconds in. */
function drawReview(scene, t) {
  const cur = scene.cur;
  const res = cur.play.res;
  const d = cur.delivery;
  const k = clamp(t / 1.6);
  const end = d.samples.findIndex((s) => s.z < 0);
  const last = Math.floor((end < 0 ? d.samples.length : end) * k);
  const impact = res.start.pos;
  for (let i = 0; i < last; i += 3) {
    const s = d.samples[i];
    const p = projectClose(s.x, s.y, s.z);
    // Real path up to the pad, projected path after it.
    fillRect(p.x - 1, p.y - 1, 3, 3, s.z > impact.z ? "#7ec8ff" : "#ff8a7a");
  }
  if (d.pitchedAt && k > 0.5) {
    const p = projectClose(d.pitchedAt.x, 0, d.pitchedAt.z);
    fillRect(p.x - 4, p.y - 1, 9, 3, COLORS.white);
  }
  const lines = [
    ["PITCHING", res.lbwNote === "pitched outside leg" ? "OUTSIDE LEG" : "IN LINE"],
    // Outside off only saves him because he played a shot.
    ["IMPACT", res.lbwNote === "outside the line" ? "OUTSIDE (PLAYING A SHOT)" : "IN LINE"],
    [
      "WICKETS",
      cur.tracking.reason.startsWith("WICKETS: ") ? cur.tracking.reason.slice(9) : hitsStumps(d.samples) ? "HITTING" : "MISSING",
    ],
  ];
  drawTrackingBoxes(lines, t);
}
