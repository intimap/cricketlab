import { WIDTH, HEIGHT, COLORS, initScreen, present, toGameCoords, fillRect } from "./engine/screen.js";
import { drawText } from "./engine/text.js";
import { initInput, keys, endFrame } from "./engine/input.js";
import { initTouch } from "./engine/touch.js";
import { unlockAudio, toggleMute } from "./engine/audio.js";
import { loadAssets } from "./assets.js";
import { Menu } from "./scenes/menu.js";
import { MatchScene } from "./scenes/match.js";
import { ScoreboardScene } from "./scenes/scoreboard.js";
import { warmScores } from "./engine/scores.js";
import { initSpritePanel } from "./sprite-panel.js";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/**
 * Cut the striker's stumps out of the close-view background so they can be
 * drawn again over the batter. Keeps the three stumps and bails, drops the grass.
 */
function cutOutStumps(background) {
  const sx = 296;
  const sy = 270;
  const w = 48;
  const h = 70;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  c.drawImage(background, sx, sy, w, h, 0, 0, w, h);
  const img = c.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    const row = Math.floor(i / 4 / w);
    const col = (i / 4) % w;
    const grass = g > r + 6 && g > b;
    const stump = (col >= 3 && col <= 13) || (col >= 18 && col <= 27) || (col >= 34 && col <= 43);
    const bails = row < 10 && col >= 3 && col <= 43;
    if (grass || (!stump && !bails) || row > 63) img.data[i + 3] = 0;
  }
  c.putImageData(img, 0, 0);
  return canvas;
}

class Game {
  scene = null;
  images = null;
  menu = null;

  async boot(container) {
    const screen = initScreen(container);
    initInput(screen, toGameCoords, unlockAudio);
    const touch = initTouch();
    fillRect(0, 0, WIDTH, HEIGHT, COLORS.green);
    drawText("LOADING...", WIDTH / 2, HEIGHT / 2, { align: "center" });
    present();

    const assets = await loadAssets(loadImage);
    const close = assets["ground-close"];
    this.images = { ...assets, close, wide: assets["ground-wide"], stumps: cutOutStumps(close) };
    this.menu = new Menu(this);
    warmScores();
    this.scene = this.menu;
    // Sprite test: the panel under the game, and straight into the nets with the bat.
    const panel = document.getElementById("sprite-panel");
    if (panel) await initSpritePanel(panel, assets["sprites/test-batter"]);
    if (document.body.dataset.start === "nets") this.startMatch({ ...this.menu.cfg, format: "nets", mode: "bat" });

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (keys.pressed("KeyM")) toggleMute();
      this.scene.update(dt);
      touch(this.scene.touchMode);
      this.scene.draw();
      present();
      endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  startMatch(cfg) {
    this.scene = new MatchScene(this, cfg);
  }

  showScores(cfg) {
    this.scene = new ScoreboardScene(this, cfg);
  }

  toMenu() {
    this.scene = this.menu;
  }
}

new Game().boot(document.getElementById("game"));
