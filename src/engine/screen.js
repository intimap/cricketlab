// The game draws into a fixed 640x360 offscreen canvas, which is scaled up
// (pixelated) onto the visible canvas once per frame.

export const WIDTH = 640;
export const HEIGHT = 360;

export const COLORS = {
  green: "#0f2a1c",
  cream: "#f4ecd0",
  gold: "#e8b931",
  gold2: "#b8862a",
  red: "#c8302e",
  white: "#ffffff",
  black: "#0a0a0a",
  grey: "#8a8f86",
  dim: "#9fb39b",
};

/** 2D context of the offscreen frame buffer. Every draw call goes here. */
export let ctx;
let buffer;
let screen;
let screenCtx;

export function initScreen(container) {
  buffer = document.createElement("canvas");
  buffer.width = WIDTH;
  buffer.height = HEIGHT;
  ctx = buffer.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  screen = document.createElement("canvas");
  screen.id = "screen";
  container.appendChild(screen);
  screenCtx = screen.getContext("2d");

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const availW = container.clientWidth || window.innerWidth;
    const availH = container.clientHeight || window.innerHeight;
    let scale = Math.min(availW / WIDTH, availH / HEIGHT);
    // Prefer a whole-device-pixel scale when it doesn't waste too much room.
    if (scale >= 1) {
      const snapped = Math.max(1, Math.floor(scale * dpr) / dpr);
      if (snapped >= scale * 0.85) scale = snapped;
    }
    const cssW = Math.round(WIDTH * scale);
    const cssH = Math.round(HEIGHT * scale);
    screen.style.width = cssW + "px";
    screen.style.height = cssH + "px";
    screen.width = Math.round(cssW * dpr);
    screen.height = Math.round(cssH * dpr);
    screenCtx.imageSmoothingEnabled = false;
  };
  window.addEventListener("resize", resize);
  resize();
  return screen;
}

/**
 * Run `draw` with every drawing call going to `target` (another 2D context) instead of the frame
 * buffer: for building a sprite in a scratch buffer first.
 */
export function drawInto(target, draw) {
  const frame = ctx;
  ctx = target;
  try {
    draw();
  } finally {
    ctx = frame;
  }
}

/** Copy the frame buffer to the visible canvas. */
export function present() {
  screenCtx.imageSmoothingEnabled = false;
  screenCtx.drawImage(buffer, 0, 0, screen.width, screen.height);
}

/** Convert a mouse event to frame-buffer coordinates. */
export function toGameCoords(event) {
  const rect = screen.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

export function fillRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function plot(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** Pixel line drawn as a run of size x size squares. */
export function drawLine(x0, y0, x1, y1, size, color) {
  ctx.fillStyle = color;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const half = Math.floor(size / 2);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    ctx.fillRect(x - half, y - half, size, size);
  }
}

export function fillCircle(cx, cy, radius, color) {
  ctx.fillStyle = color;
  const r = Math.max(0.5, radius);
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (half === 0 && Math.abs(dy) > r - 0.5) continue;
    ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

export function fillEllipse(cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const k = 1 - (dy * dy) / (ry * ry || 1);
    if (k < 0) continue;
    const half = Math.round(rx * Math.sqrt(k));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

/** Scanline fill of a polygon given as [{x, y}], snapped to the pixel grid. */
export function fillPolygon(points, color) {
  ctx.fillStyle = color;
  const ys = points.map((p) => p.y);
  const top = Math.round(Math.min(...ys));
  const bottom = Math.round(Math.max(...ys));
  for (let y = top; y < bottom; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a.y <= cy !== b.y <= cy) xs.push(a.x + ((cy - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.round(xs[i]);
      const x1 = Math.round(xs[i + 1]);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }
}

export function strokeEllipse(cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  const steps = Math.ceil((rx + ry) * 3);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}

/** Framed box: gold border, black inner line, filled body. */
export function drawPanel(x, y, w, h, fill = COLORS.green, border = COLORS.gold) {
  fillRect(x, y, w, h, border);
  fillRect(x + 1, y + 1, w - 2, h - 2, COLORS.black);
  fillRect(x + 2, y + 2, w - 4, h - 4, fill);
}

/** Horizontal meter filled to `value` (0..1). */
export function drawBar(x, y, w, h, value, color, background = "#203a2a") {
  fillRect(x, y, w, h, background);
  fillRect(x, y, Math.max(0, Math.min(1, value)) * w, h, color);
}
