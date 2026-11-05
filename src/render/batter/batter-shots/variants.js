// Strokes built on an existing clip (stream 4's matrix): the same timing, with the body, feet or hands moved
// where the stroke differs. Each change is merged into the named phases of the source; phases it doesn't name
// stay as they were, so the stroke still leaves and returns to the stance as its source does.

/** A copy of clip `source` named `name`, with `changes` ({ phase: pose values }) merged in. */
function derive(clip, source, name, changes, options = {}) {
  const frames = source.frames.map((f) => [f.time, f.phase, { ...f.pose, ...(changes[f.phase] ?? {}) }, f.ease]);
  const carried = { kind: source.kind, group: source.group, ...(source.event ? { event: source.event } : {}) };
  return clip(name, source.downswing, source.plant, frames, { ...carried, ...options });
}

/** The front stride of a drive, for strokes played forward. */
const FRONT_STRIDE = { frontFootX: 12, frontFootY: -13, backFootX: -8, backFootY: -2, pelvisX: 2, chestX: 5, headX: 7 };

export function extendVariantShots({ clip, clips }) {
  const out = {};

  // The upper cut: up above the shoulder, the hands go high and the open face steers it over the slips.
  const high = (py, angle) => ({ py, angle, chestX: -1, headX: 0, headY: -86 });
  out.upperCut = derive(clip, clips.cut, "Upper cut", {
    Load: { py: -68, angle: 70 },
    Contact: high(-72, 100),
    "Cut through": high(-78, 116),
    Finish: high(-82, 126),
    Hold: high(-82, 126),
  });

  // The front-foot pull: the pull's swing, from a stride forward (the weight going through it).
  const forward = { ...FRONT_STRIDE, backLift: 0 };
  out.frontFootPull = derive(clip, clips.pull, "Front-foot pull", {
    "Load back": { ...forward, frontLift: 3 },
    Plant: forward,
    Coil: forward,
    Contact: { ...forward, chestX: 4, headX: 6 },
    "Rotate through": forward,
    Finish: forward,
    Hold: forward,
    Unwind: forward,
  });

  // The slog-sweep: the sweep's knee, then the bat swung up and over midwicket.
  out.slogSweep = derive(clip, clips.sweep, "Slog-sweep", {
    "Sweep through": { px: -4, py: -50, angle: 222 },
    Finish: { px: -10, py: -70, angle: 196 },
    Hold: { px: -10, py: -70, angle: 196 },
  });

  // The switch hit: the reverse sweep's swap of the hands, standing taller and swung up over point.
  const taller = { pelvisY: -31, chestY: -58, headY: -71, crouch: 12, frontFootX: 15 };
  out.switchHit = derive(clip, clips.reverseSweep, "Switch hit", {
    Plant: taller,
    "Set the bat": taller,
    Contact: { ...taller, py: -38 },
    "Sweep through": { ...taller, py: -52, angle: 128 },
    Finish: { ...taller, py: -72, angle: 160 },
    Hold: { ...taller, py: -72, angle: 160 },
  });

  // The smother: a long stride right to the pitch of it, low, the bat angled down over the ball.
  const smother = { frontFootX: 16, frontFootY: -15, pelvisX: 4, pelvisY: -40, chestX: 11, chestY: -66, headX: 14, headY: -78 };
  out.smother = derive(clip, clips.forwardDefence, "Smother", {
    "Short stride": { frontFootX: 13, frontFootY: -14 },
    Plant: { ...smother, px: 18, py: -35, angle: -3 },
    Contact: { ...smother, px: 18, py: -34, angle: -4 },
    Absorb: { ...smother, px: 17, py: -34, angle: -6 },
    Hold: { ...smother, px: 17, py: -34, angle: -6 },
  });

  // The jab: no stride, just the hands pushing the bat down at it from the crease.
  const crease = { frontFootX: 7, frontFootY: -10, backFootX: -8, backFootY: -2, pelvisX: 0, chestX: 4, headX: 5 };
  out.jab = derive(clip, clips.backFootDefence, "Jab", {
    "Move back": { ...crease, py: -45, angle: 18 },
    Plant: { ...crease, px: 13, py: -42, angle: 6 },
    Contact: { ...crease, px: 14, py: -41, angle: 2 },
    Absorb: { ...crease, px: 13, py: -41, angle: 0 },
    Hold: { ...crease, px: 13, py: -41, angle: 0 },
    Recover: { ...crease, px: 12, py: -43, angle: 9 },
  });

  // The fend: up on his toes going back, the hands high in front of the chest, leaning away from it.
  const tall = { chestX: -2, headX: -2, headY: -87 };
  out.fend = derive(clip, clips.backFootDefence, "Fend", {
    "Move back": { ...tall, py: -56, angle: 16 },
    Plant: { ...tall, px: 13, py: -66, angle: 10 },
    Contact: { ...tall, px: 13, py: -70, angle: 8 },
    Absorb: { ...tall, px: 12, py: -69, angle: 5 },
    Hold: { ...tall, px: 12, py: -69, angle: 5 },
  });

  // The sway: the bat lifted away as in a leave, and the body leaning back out of the ball's path.
  const away = { pelvisX: -2, chestX: -5, headX: -8, headY: -83, backFootX: -11, backFootY: 0 };
  out.sway = derive(clip, clips.leave, "Sway", {
    "Lift away": { ...away, chestX: -3, headX: -5 },
    "Ball passage": away,
    "Watch through": away,
  });

  // The duck: down under it, the head tucked and the bat held low out of the way.
  const down = { crouch: 18, pelvisY: -29, chestX: 6, chestY: -52, headX: 9, headY: -62, px: 8, py: -36, angle: 120 };
  out.duck = derive(clip, clips.leave, "Duck", {
    "Lift away": { crouch: 10, pelvisY: -36, chestY: -62, headY: -73, headX: 6, px: 8, py: -48, angle: 110 },
    "Ball passage": down,
    "Watch through": down,
    "Lower the bat": { crouch: 6, pelvisY: -39, chestY: -66, headY: -78, px: 10, py: -48, angle: 92 },
  });
  return out;
}
