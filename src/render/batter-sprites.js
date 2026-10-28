// Sprite batter (test): pre-drawn frames for the close view from behind, in place of the jointed
// rig for the shots that have them. Anything without frames falls back to the rig.
//
// Frames come from a sprite-pack zip (a metadata.json, rotations/<dir>.png and
// animations/<name>/<dir>/frame_NNN.png) or from the starter strip bundled with the game. Only the
// "north" direction is used: the batter seen from behind. Animations are sorted into shot slots by
// their names: "leave", "cover drive" / "drive", "pull"; a "stance" / "idle" animation (or the
// north rotation) is the stance.
//
// Timing: frames up to the slot's contact frame are spread from when he starts the shot (backlift)
// to when the sim says the bat arrives; the rest play out over the follow-through.

import { load, save } from "../engine/storage.js";

export const SLOTS = ["stance", "leave", "drive", "pull"];
export const SLOT_NAMES = { stance: "Stance", leave: "Leave", drive: "Cover drive", pull: "Pull" };
const SLOT_WORDS = [
  ["leave", /leave|leaving/i],
  ["pull", /pull|hook/i],
  ["drive", /drive/i],
  ["stance", /stance|idle|guard/i],
];
/** Seconds a leave takes to play out, and the follow-through after contact. */
export const LEAVE_TIME = 0.5;
export const FOLLOW_TIME = 0.45;

/** The loaded frames: slot -> { name, frames: [canvas], anchor: {x, y}, body } */
const set = {};
/** Per-slot settings (contact frame), plus on/off and scale, remembered in this browser. */
export const spriteSettings = { on: true, scale: "game", contact: { drive: 4, pull: 4 }, ...load("spriteTest", {}) };
export const saveSpriteSettings = () => save("spriteTest", spriteSettings);
let source = "";

export const spriteSlot = (slot) => (spriteSettings.on ? (set[slot] ?? null) : null);
export const spriteSource = () => source;
export const spriteSlots = () => set;

/** The feet: the middle of the opaque pixels along the bottom of the figure, from a frame. */
function feetOf(canvas) {
  const c = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const px = c.getImageData(0, 0, w, h).data;
  const solid = (x, y) => px[(y * w + x) * 4 + 3] > 40;
  let bottom = -1;
  let top = -1;
  for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (solid(x, y)) bottom = y;
  for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (solid(x, y)) top = y;
  let sum = 0;
  let n = 0;
  for (let y = Math.max(0, bottom - 5); y <= bottom; y++)
    for (let x = 0; x < w; x++)
      if (solid(x, y)) {
        sum += x;
        n++;
      }
  return { x: n ? Math.round(sum / n) : w / 2, y: bottom + 1, body: bottom - top + 1 };
}

const toCanvas = (img, sx = 0, sy = 0, w = img.width, h = img.height) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return c;
};

/** One slot from its frames; the anchor comes from the first frame so the steps he takes show. */
function setSlot(slot, name, frames) {
  const feet = feetOf(frames[0]);
  set[slot] = { name, frames, anchor: { x: feet.x, y: feet.y }, body: feet.body };
}

/** The starter frames bundled with the game: the north stance and a front-foot step as the drive. */
export function loadStarter(sheet) {
  for (const k of Object.keys(set)) delete set[k];
  setSlot("stance", "starter: north rotation", [toCanvas(sheet, 0, 0, 128, 128)]);
  const drive = [];
  for (let i = 0; i < 9; i++) drive.push(toCanvas(sheet, 128 + i * 172, 0, 172, 172));
  setSlot("drive", "starter: step onto the front foot", drive);
  source = "Starter frames";
}

// ---------- Reading a zip (stored or deflated entries), with the browser's own decompressor ----------
async function unzip(buf) {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const files = new Map();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = new Uint8Array(buf, start, size);
    files.set(name, async () => {
      if (method === 0) return new Blob([raw]);
      if (method !== 8) throw new Error(`${name}: unsupported compression`);
      return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
    });
  }
  return files;
}

const blobImage = (blob) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bad image"));
    img.src = URL.createObjectURL(blob);
  });

/**
 * Load a sprite-pack zip. Returns the list of what went where: [{ slot, name }] plus anything left
 * over that matched no slot. North frames only.
 */
export async function loadSpriteZip(buf, fileName = "zip") {
  const files = await unzip(buf);
  const anims = new Map();
  let rotation = null;
  for (const name of files.keys()) {
    const parts = name.split("/");
    const at = parts.indexOf("animations");
    if (at >= 0 && parts[at + 2] === "north" && /\.png$/i.test(name)) {
      const anim = parts[at + 1];
      if (!anims.has(anim)) anims.set(anim, []);
      anims.get(anim).push(name);
    }
    if (/rotations\/north\.png$/i.test(name)) rotation = name;
  }
  const found = {};
  const unused = [];
  for (const [anim, names] of anims) {
    const slot = SLOT_WORDS.find(([, re]) => re.test(anim))?.[0];
    if (!slot || found[slot]) {
      unused.push(anim);
      continue;
    }
    names.sort();
    found[slot] = { anim, names };
  }
  if (!found.stance && rotation) found.stance = { anim: "north rotation", names: [rotation] };
  if (!Object.keys(found).length) throw new Error("no north-facing frames found");
  for (const k of Object.keys(set)) delete set[k];
  for (const [slot, { anim, names }] of Object.entries(found)) {
    const frames = [];
    for (const n of names) frames.push(toCanvas(await blobImage(await files.get(n)())));
    setSlot(slot, anim.replace(/_/g, " "), frames);
    if (spriteSettings.contact[slot] === undefined || spriteSettings.contact[slot] >= frames.length)
      spriteSettings.contact[slot] = Math.floor(frames.length / 2);
  }
  source = fileName;
  return { unused };
}

/**
 * Which frame of a slot to show at ball time t for a shot that starts at `from` and meets the
 * ball at `contactAt` (s). A leave has no contact: it plays out over LEAVE_TIME.
 */
export function frameAt(slot, t, from, contactAt) {
  const s = set[slot];
  const n = s.frames.length;
  if (slot === "stance") return s.frames[0];
  if (slot === "leave") return s.frames[Math.min(n - 1, Math.max(0, Math.floor(((t - from) / LEAVE_TIME) * n)))];
  const c = Math.min(n - 1, spriteSettings.contact[slot] ?? Math.floor(n / 2));
  let i;
  if (t < contactAt) i = Math.floor(((t - from) / Math.max(0.02, contactAt - from)) * c);
  else i = c + Math.floor(((t - contactAt) / FOLLOW_TIME) * (n - 1 - c));
  return s.frames[Math.min(n - 1, Math.max(0, i))];
}
