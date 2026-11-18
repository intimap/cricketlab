/**
 * A figure sprinting side-on (render/figures.js), facing right; mirrored to run left. Each limb is set by
 * its joint angles through the stride, as a runner moves: the thigh swings forward and back from the hip,
 * the knee folds hard just after the foot leaves the ground (heel up behind) and opens as the leg reaches
 * forward, and only ever bends one way. The arms pump against the legs with the elbows held bent. The
 * body leans into the run and rises off the ground between strides. Index 0 is the far side (drawn
 * first, behind the body), 1 the near side. Units are the figure's (48 tall, feet at 0).
 */

const THIGH = 11.6;
const SHIN = 11.6;
const UPPER_ARM = 9;
const FOREARM = 8.5;
const RAD = Math.PI / 180;
/** The thigh's swing either side of straight down, the knee's least and most bend, the upper arm's swing (degrees). */
const THIGH_SWING = 38;
const KNEE = { least: 8, most: 105 };
const ARM_SWING = 55;
/** The elbow's bend (degrees), kept through the swing. */
const ELBOW = 85;
/** How high (units) he gets off the ground between strides. */
const FLIGHT = 1.4;

/** A point `len` from `from` at `deg` degrees from straight down (positive: forward, to the right). */
const along = (from, deg, len) => ({ x: from.x + len * Math.sin(deg * RAD), y: from.y + len * Math.cos(deg * RAD) });

export function sprintPose(phase) {
  const a = phase * Math.PI * 2;
  const lean = 4;
  // The legs relative to the hips, then the whole body set down so the lower foot is on the ground.
  const legs = [0, 1].map((i) => {
    const b = a + i * Math.PI;
    const thigh = THIGH_SWING * Math.sin(b) + 6;
    // Most folded just after toe-off (the thigh starting forward), straightening as it reaches out.
    const fold = Math.max(0, Math.cos(b - 0.7));
    const knee = KNEE.least + (KNEE.most - KNEE.least) * fold * fold;
    const k = along({ x: 0, y: 0 }, thigh, THIGH);
    return { knee: k, foot: along(k, thigh - knee, SHIN) };
  });
  const lowest = Math.max(legs[0].foot.y, legs[1].foot.y);
  const pelvis = { x: lean * 0.35, y: -1 - lowest - FLIGHT * Math.max(0, Math.cos(2 * a)) };
  const top = pelvis.y - 19;
  const hips = [
    { x: pelvis.x - 0.8, y: pelvis.y },
    { x: pelvis.x + 0.8, y: pelvis.y },
  ];
  const knees = legs.map((l, i) => ({ x: hips[i].x + l.knee.x, y: hips[i].y + l.knee.y }));
  const feet = legs.map((l, i) => ({ x: hips[i].x + l.foot.x, y: hips[i].y + l.foot.y }));
  const shoulders = [
    { x: lean - 1.6, y: top + 2 },
    { x: lean + 1.6, y: top + 2 },
  ];
  // Each arm with the opposite leg: the upper arm swings, the forearm held bent forward from it.
  const elbows = [];
  const hands = [];
  for (const i of [0, 1]) {
    const swing = -ARM_SWING * Math.sin(a + i * Math.PI);
    elbows[i] = along(shoulders[i], swing, UPPER_ARM);
    hands[i] = along(elbows[i], swing + ELBOW, FOREARM);
  }
  return { lean, top, feet, hands, pelvis, hips, knees, shoulders, elbows, side: true };
}
