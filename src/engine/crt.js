import { crtValues } from "./crt-settings.js";
export { crtEnabled, setCrt } from "./crt-settings.js";

/**
 * An old CRT television over the whole picture: the glass bowed out at the edges, a scanline through each
 * row of pixels, the red, green and blue stripes of the phosphor, a soft glow round bright things and darker
 * corners. One WebGL pass draws the frame buffer onto its own canvas; without WebGL the picture shows plain.
 * How much of each, or no CRT at all, is set on the menu's SCREEN page (engine/crt-settings.js).
 */

/**
 * Where a point on the curved glass shows the frame (both 0..1 across and down): the same bow as the shader,
 * so a tap lands on what's drawn under it.
 */
export function throughGlass(u, v) {
  const curve = crtValues().curve;
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const ox = Math.abs(y) / curve.x;
  const oy = Math.abs(x) / curve.y;
  return { u: (x + x * ox * ox) * 0.5 + 0.5, v: (y + y * oy * oy) * 0.5 + 0.5 };
}

const VERTEX = `
attribute vec2 corner;
varying vec2 uv;
void main() {
  uv = corner * 0.5 + 0.5;
  uv.y = 1.0 - uv.y;
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D frame;
uniform vec2 source;
uniform float time;
// The look (engine/crt-settings.js): how far the glass bows (bigger is flatter), how dark the scanlines, how
// strong the phosphor stripes, the glow, the guns out of register (pixels), the dark corners, the flicker and
// the brightness that makes up for it all.
uniform vec2 curve;
uniform float scanlines;
uniform float mask;
uniform float glowAmount;
uniform float fringe;
uniform float corners;
uniform float flicker;
uniform float brightness;
varying vec2 uv;

vec2 glass(vec2 p) {
  p = p * 2.0 - 1.0;
  vec2 bow = abs(p.yx) / curve;
  p = p + p * bow * bow;
  return p * 0.5 + 0.5;
}

vec3 tap(vec2 p) { return texture2D(frame, p).rgb; }

void main() {
  vec2 p = glass(uv);
  // Off the edge of the tube: black, with a soft fall-off at the rim.
  vec2 edge = smoothstep(0.0, 0.006, p) * smoothstep(0.0, 0.006, 1.0 - p);
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 px = 1.0 / source;
  // The three guns a touch out of register.
  vec3 col = vec3(tap(p + vec2(px.x * fringe, 0.0)).r, tap(p).g, tap(p - vec2(px.x * fringe, 0.0)).b);
  // Bright things bleed into their neighbours.
  vec3 glow = (tap(p + vec2(px.x, 0.0)) + tap(p - vec2(px.x, 0.0)) + tap(p + vec2(0.0, px.y)) + tap(p - vec2(0.0, px.y))) * 0.25;
  col = max(col, glow * min(0.98, 0.6 + 0.25 * glowAmount)) + glow * glow * 0.12 * glowAmount;
  // A scanline through every row of the game's pixels: bright in the middle, dark at the join.
  float row = fract(p.y * source.y) - 0.5;
  col *= 1.0 - scanlines * (row * row * 4.0);
  // The phosphor stripes, one pixel each across the screen.
  float m = mod(gl_FragCoord.x, 3.0);
  float dim = 1.0 - mask;
  col *= m < 1.0 ? vec3(1.0, dim, dim) : m < 2.0 ? vec3(dim, 1.0, dim) : vec3(dim, dim, 1.0);
  // Darker towards the corners, a little brighter overall to make up for the lines, and the faintest flicker.
  vec2 v = p * (1.0 - p);
  col *= pow(clamp(v.x * v.y * 18.0, 0.0, 1.0), corners) * brightness * (1.0 + flicker * sin(time * 47.0));
  gl_FragColor = vec4(col * edge.x * edge.y, 1.0);
}`;

function shader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

/** The CRT pass on `canvas`: { draw(frameCanvas, time) }, or null if WebGL isn't there. */
export function createCrt(canvas) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return null;
  try {
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, "corner");
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Nearest: the pixels stay pixels; the glow and the lines do the softening.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const source = gl.getUniformLocation(program, "source");
    const time = gl.getUniformLocation(program, "time");
    const at = (name) => gl.getUniformLocation(program, name);
    const look = {
      curve: at("curve"),
      scanlines: at("scanlines"),
      mask: at("mask"),
      glow: at("glowAmount"),
      fringe: at("fringe"),
      corners: at("corners"),
      flicker: at("flicker"),
      brightness: at("brightness"),
    };
    return {
      draw(frame, t) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
        gl.uniform2f(source, frame.width, frame.height);
        gl.uniform1f(time, t);
        const v = crtValues();
        gl.uniform2f(look.curve, v.curve.x, v.curve.y);
        for (const key of ["scanlines", "mask", "glow", "fringe", "corners", "flicker", "brightness"])
          gl.uniform1f(look[key], v[key]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
  } catch (err) {
    console.warn("CRT effect unavailable:", err);
    return null;
  }
}
