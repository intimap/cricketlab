import { RIG_DEPTH_RISE, BOOT_TOE, HEEL_ANKLE_RISE } from "./batter-skeleton.js";

const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};

/** Movement families share a base, but keep each shot's authored contact and placement. */
function style(name) {
  if (/sweep/i.test(name)) return {
    lead: "front", x: 3, z: 5, lift: 2, hip: 19, torso: 27, pivot: 18,
    sign: name === "reverseSweep" ? 1 : -1,
  };
  if (/ramp|scoop/i.test(name)) return { lead: "front", x: 1, z: 3, lift: 2, hip: 6, torso: 9, pivot: 12, sign: -1 };
  const back = /backFoot|cut|pull|hook/i.test(name);
  const touch = /glance|clipOff/i.test(name);
  if (back) return {
    lead: "back", x: -3, z: -9, lift: 4,
    hip: touch ? 10 : /cut/i.test(name) ? 14 : 25,
    torso: touch ? 15 : /cut/i.test(name) ? 21 : 33,
    pivot: /lateCut/i.test(name) ? 20 : 38, sign: -1,
  };
  const loft = /loft|slog/i.test(name);
  const x = /square/i.test(name) ? 6 : /cover/i.test(name) ? 5 : /onDrive/i.test(name) ? -3 : 2;
  return { lead: "front", x, z: touch ? 5 : loft ? 10 : 9, lift: touch ? 3 : 5,
    hip: touch ? 12 : loft ? 30 : 25, torso: touch ? 17 : loft ? 38 : 33,
    pivot: touch ? 27 : 48, sign: -1 };
}

function moveFoot(p, name, x, z, lift) {
  p[`${name}FootX`] += x;
  p[`${name}FootZ`] += z;
  p[`${name}FootY`] -= z * RIG_DEPTH_RISE;
  p[`${name}Lift`] += lift;
}

function carry(p, name, z) {
  p[`${name}Z`] += z;
  p[`${name}Y`] -= z * RIG_DEPTH_RISE;
}

/** Steps plant before contact; hips lead the torso through it, then the feet gather back to guard. */
export function addBatterFootwork(pose, clip, time, name) {
  if (clip.kind !== "attack" || time <= clip.start || time >= clip.end) return pose;
  const s = style(name);
  const lead = s.lead;
  const trailing = lead === "front" ? "back" : "front";
  const plantAt = Math.min(clip.plant[lead][0], -clip.downswing);
  const holdUntil = Math.max(clip.plant.front[1], clip.plant.back[1]);
  const step = smooth((time - clip.start) / (plantAt - clip.start));
  const recover = smooth((time - holdUntil) / (clip.end - holdUntil));
  const stay = 1 - recover;
  const hip = smooth(time / 0.15) * stay;
  const torso = smooth((time - 0.025) / 0.19) * stay;
  const stride = step * stay;
  const p = { ...pose };

  moveFoot(p, lead, s.x * stride, s.z * stride,
    s.lift * Math.sin(Math.PI * step) * stay + 2.5 * Math.sin(Math.PI * recover));
  // Weight travels through the head and chest before the pelvis settles over the lead foot.
  const headStep = smooth((time - clip.start) / (plantAt - clip.start - 0.025));
  const chestStep = smooth((time - clip.start) / (plantAt - clip.start - 0.012));
  carry(p, "head", s.z * 0.36 * headStep * stay);
  carry(p, "chest", s.z * 0.32 * chestStep * stay);
  carry(p, "pelvis", s.z * RIG_DEPTH_RISE * stride);
  p.pelvisX += s.x * 0.2 * stride;
  p.chestX += s.x * 0.28 * stride;
  p.headX += s.x * 0.32 * stride;
  p.hipTurn += s.sign * s.hip * hip;
  p.shoulderTurn += s.sign * s.torso * torso;

  // Toes stay put during the plant: the heel lifts and the boot turns about its toe.
  p[`${trailing}Heel`] += (lead === "front" ? 4.5 : 2.5) * hip;
  p[`${lead}ToeYaw`] = (lead === "front" ? 22 : -12) * stride - s.sign * 8 * hip;
  p[`${trailing}ToeYaw`] = -s.sign * s.pivot * hip;

  // A short, lifted recovery step only starts after both authored plant windows end.
  const gather = Math.sin(Math.PI * recover);
  moveFoot(p, trailing, (lead === "front" ? 2 : -2) * gather,
    (lead === "front" ? 7 : -5) * gather, 3 * gather);
  // Rotate the ankle around the ball of the foot, rather than sliding a planted toe.
  for (const foot of ["front", "back"]) {
    const yaw = p[`${foot}ToeYaw`] * Math.PI / 180;
    moveFoot(p, foot, BOOT_TOE * (1 - Math.cos(yaw)), -BOOT_TOE * Math.sin(yaw), p[`${foot}Heel`] * HEEL_ANKLE_RISE);
  }
  return p;
}
