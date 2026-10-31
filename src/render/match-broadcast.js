import { WIDTH, COLORS, fillRect, drawPanel, drawBar } from "../engine/screen.js";
import { drawText } from "../engine/text.js";
import { clamp } from "../math.js";
import { hitsStumps } from "../sim/delivery.js";
import { projectClose } from "./camera.js";
import { drawBroadcastBanner } from "./hud.js";
import { ON_FIELD_TIME, TRACKING_TIME, reviewResult } from "../scenes/match-broadcast.js";

const SAFE = "#66d890";

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
    if (scene.phaseT < TRACKING_TIME) drawReview(scene);
    else {
      const { out, changed } = reviewResult(cur);
      const title = scene.phaseT < TRACKING_TIME + 1.5
        ? changed ? "DECISION OVERTURNED" : "ORIGINAL DECISION STANDS"
        : out ? "OUT" : "NOT OUT";
      drawBroadcastBanner(title, out ? COLORS.red : SAFE,
        cur.tracking.verdict === "umpiresCall" ? "UMPIRE'S CALL - REVIEW RETAINED" : "THIRD UMPIRE", 1);
    }
  }
  const rec = cur?.done?.rec;
  if (scene.phase === "after" && (rec?.wicket || rec?.boundary)) {
    const batter = scene.inn.bat[rec.wicket ? rec.wicket.batter : rec.striker];
    const title = rec.wicket ? "WICKET!" : rec.boundary === 6 ? "SIX!" : "FOUR!";
    const how = rec.wicket ? (rec.wicket.how === "runout" ? "RUN OUT" : rec.wicket.caughtBehind ? "CAUGHT BEHIND" : rec.wicket.how.toUpperCase()) + "  -  " : "";
    drawBroadcastBanner(title, rec.wicket ? COLORS.red : COLORS.gold,
      `${how}${batter.p.short.toUpperCase()} ${batter.runs} (${batter.balls})`, Math.min(1, scene.phaseT / 0.15), true);
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

function drawReview(scene) {
  const cur = scene.cur;
  const res = cur.play.res;
  const d = cur.delivery;
  const k = clamp(scene.phaseT / 1.6);
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
    ["IMPACT", res.lbwNote === "outside the line" ? "OUTSIDE OFF" : "IN LINE"],
    [
      "WICKETS",
      cur.tracking.reason.startsWith("WICKETS: ") ? cur.tracking.reason.slice(9) : hitsStumps(d.samples) ? "HITTING" : "MISSING",
    ],
  ];
  drawTrackingBoxes(lines, scene.phaseT);
}
