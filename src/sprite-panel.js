// Test panel for the sprite batter (index.html's #sprite-panel): load a sprite-pack zip, see which
// shots it covers, set each shot's contact frame and the drawing size. The last zip loaded is kept
// in this browser (IndexedDB) so a reload doesn't lose it.

import {
  SLOTS,
  SLOT_NAMES,
  spriteSettings,
  saveSpriteSettings,
  spriteSlots,
  spriteSource,
  loadSpriteZip,
  loadStarter,
} from "./render/batter-sprites.js";

const DB = "cricketlab-sprites";

function idb(mode, fn) {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("zips");
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const tx = open.result.transaction("zips", mode);
        const req = fn(tx.objectStore("zips"));
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}
const keepZip = (zip) => idb("readwrite", (s) => (zip ? s.put(zip, "last") : s.delete("last")));
const keptZip = () => idb("readonly", (s) => s.get("last"));

export async function initSpritePanel(panel, starterSheet) {
  const $ = (sel) => panel.querySelector(sel);
  const status = $("[data-status]");
  const say = (text) => (status.textContent = text);

  function render() {
    const slots = spriteSlots();
    $("[data-source]").textContent = spriteSource();
    $("[data-slots]").innerHTML = SLOTS.map((slot) => {
      const s = slots[slot];
      const contact =
        s && (slot === "drive" || slot === "pull")
          ? ` <label>contact frame <input type="number" min="0" max="${s.frames.length - 1}" value="${spriteSettings.contact[slot]}" data-contact="${slot}"></label>`
          : "";
      return `<li><b>${SLOT_NAMES[slot]}</b> ${s ? `${s.frames.length} frame${s.frames.length > 1 ? "s" : ""} <span class="dim">(${s.name})</span>${contact}` : '<span class="dim">no frames: the rig plays it</span>'}</li>`;
    }).join("");
    for (const input of panel.querySelectorAll("[data-contact]")) {
      input.addEventListener("change", () => {
        const slot = input.dataset.contact;
        const n = slots[slot].frames.length;
        spriteSettings.contact[slot] = Math.max(0, Math.min(n - 1, Math.round(+input.value || 0)));
        input.value = spriteSettings.contact[slot];
        saveSpriteSettings();
      });
      // Typing a number here mustn't also play shots in the game.
      input.addEventListener("keydown", (e) => e.stopPropagation());
    }
    $("[data-on]").textContent = spriteSettings.on ? "Sprites: on" : "Sprites: off (rig only)";
    $("[data-scale]").textContent = spriteSettings.scale === "native" ? "Size: full 1×" : "Size: game size";
  }

  async function useZip(buf, name) {
    const { unused } = await loadSpriteZip(buf, name);
    render();
    say(unused.length ? `Not used (no shot name matched): ${unused.join(", ").replace(/_/g, " ")}` : "Loaded.");
  }

  loadStarter(starterSheet);
  const kept = await keptZip();
  if (kept) {
    try {
      await useZip(kept.buf, kept.name);
    } catch {
      loadStarter(starterSheet);
    }
  }
  render();

  $("[data-file]").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      await useZip(buf, file.name);
      keepZip({ buf, name: file.name });
    } catch (err) {
      say(`Couldn't read ${file.name}: ${err.message}`);
    }
    e.target.value = "";
    e.target.blur();
  });
  $("[data-starter]").addEventListener("click", (e) => {
    loadStarter(starterSheet);
    keepZip(null);
    render();
    say("Back to the starter frames.");
    e.target.blur();
  });
  $("[data-on]").addEventListener("click", (e) => {
    spriteSettings.on = !spriteSettings.on;
    saveSpriteSettings();
    render();
    e.target.blur();
  });
  $("[data-scale]").addEventListener("click", (e) => {
    spriteSettings.scale = spriteSettings.scale === "native" ? "game" : "native";
    saveSpriteSettings();
    render();
    e.target.blur();
  });
  $("[data-copy]").addEventListener("click", async (e) => {
    const slots = spriteSlots();
    const text = JSON.stringify(
      {
        source: spriteSource(),
        scale: spriteSettings.scale,
        shots: Object.fromEntries(
          Object.entries(slots).map(([k, s]) => [k, { name: s.name, frames: s.frames.length, contact: spriteSettings.contact[k] }]),
        ),
      },
      null,
      1,
    );
    try {
      await navigator.clipboard.writeText(text);
      say("Settings copied: paste them to Claude.");
    } catch {
      say(text);
    }
    e.target.blur();
  });
}
