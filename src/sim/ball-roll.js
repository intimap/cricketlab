import { clamp } from "../math.js";
import { GRAVITY } from "./geometry.js";

/** Advance a free ball (in the air or along the ground) by dt. */
export function stepBall(b, dt, outfield) {
  b.vel.y -= GRAVITY * dt;
  if (b.pos.y > 0.01) {
    const drag = 1 - 0.0063 * Math.hypot(b.vel.x, b.vel.y, b.vel.z) * dt;
    b.vel.x *= drag;
    b.vel.y *= drag;
    b.vel.z *= drag;
  }
  b.pos.x += b.vel.x * dt;
  b.pos.y += b.vel.y * dt;
  b.pos.z += b.vel.z * dt;
  if (b.pos.y <= 0) {
    b.pos.y = 0;
    if (b.vel.y < -1.6) {
      // Bounce: steeper landings keep less of their pace.
      const ground = Math.hypot(b.vel.x, b.vel.z) || 1;
      const keep = clamp(0.95 - 0.55 * (-b.vel.y / ground), 0.45, 0.94);
      b.vel.y = -b.vel.y * 0.3;
      b.vel.x *= keep;
      b.vel.z *= keep;
      b.bounced = true;
    } else {
      // Rolling: friction slows it, more on a slow outfield.
      b.vel.y = 0;
      b.bounced = true;
      const speed = Math.hypot(b.vel.x, b.vel.z);
      if (speed > 0) {
        const next = Math.max(0, speed - (2 * outfield + 0.25 * speed) * dt);
        b.vel.x *= next / speed;
        b.vel.z *= next / speed;
      }
    }
  }
}
