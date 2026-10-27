import { clamp } from "../math.js";

export const PITCH_TYPES = {
  green: {
    id: "green",
    name: "GREEN TOP",
    blurb: "Grass on it. Seam and swing early, pace and carry.",
    pace: 1.06,
    bounce: 1.12,
    seam: 1.55,
    swingAir: 1.2,
    turn: 0.45,
    variability: 0.04,
    lowChance: 0.01,
    highChance: 0.02,
    abrasion: 0.75,
    wearRate: 0.6,
    outfield: 1.08,
  },
  dust: {
    id: "dust",
    name: "DUST BOWL",
    blurb: "Slow, low and turning. Spinners will be licking their lips.",
    pace: 0.88,
    bounce: 0.86,
    seam: 0.6,
    swingAir: 0.85,
    turn: 2,
    variability: 0.06,
    lowChance: 0.05,
    highChance: 0.02,
    abrasion: 1.5,
    wearRate: 1.4,
    outfield: 0.95,
  },
  cracked: {
    id: "cracked",
    name: "CRACKED",
    blurb: "Hard and cracked. Some keep low, some take off.",
    pace: 1,
    bounce: 1,
    seam: 1,
    swingAir: 1,
    turn: 1,
    variability: 0.12,
    lowChance: 0.06,
    highChance: 0.045,
    abrasion: 1.2,
    wearRate: 1,
    outfield: 1,
  },
};

/** A pitch wears as overs are bowled: more turn and uneven bounce, less pace and seam. */
export class Pitch {
  wear = 0;

  constructor(type) {
    this.type = type;
  }

  addOvers(overs) {
    this.wear = clamp(this.wear + overs * 0.0022 * this.type.wearRate);
  }

  get turn() {
    return this.type.turn * (1 + 0.9 * this.wear);
  }
  get variability() {
    return this.type.variability + 0.12 * this.wear;
  }
  get lowChance() {
    return this.type.lowChance + 0.06 * this.wear;
  }
  get highChance() {
    return this.type.highChance + 0.03 * this.wear;
  }
  get bounce() {
    return this.type.bounce * (1 - 0.12 * this.wear);
  }
  get pace() {
    return this.type.pace * (1 - 0.08 * this.wear);
  }
  get seam() {
    return this.type.seam * (1 - 0.35 * this.wear);
  }
}

/**
 * The match ball. It loses hardness and shine with overs (faster on an
 * abrasive pitch, and every time it hits the boundary fence) and eventually
 * roughens enough to reverse swing.
 */
export class Ball {
  overs = 0;
  boundaryHits = 0;
  number = 1;

  constructor(abrasion) {
    this.abrasion = abrasion;
  }

  age(balls = 1) {
    this.overs += balls / 6;
  }
  hitFence() {
    this.boundaryHits++;
  }
  renew() {
    this.overs = 0;
    this.boundaryHits = 0;
    this.number++;
  }

  get wornOvers() {
    return this.overs * this.abrasion + this.boundaryHits * 0.6;
  }
  get hardness() {
    return clamp(1 - 0.0068 * this.wornOvers, 0.38, 1);
  }
  get shine() {
    return Math.pow(clamp(1 - this.wornOvers / 32), 0.8);
  }
  get rough() {
    return clamp((this.wornOvers - 14) / 46);
  }
  get swing() {
    return this.shine * (0.45 + 0.55 * this.hardness);
  }
  get reverse() {
    return clamp((this.rough - 0.4) / 0.4) * (1 - this.shine);
  }
  get seam() {
    return 0.3 + 0.7 * Math.pow(this.hardness, 1.3);
  }
  get grip() {
    return 0.75 + 0.4 * this.rough;
  }
  get bounceFactor() {
    return 0.9 + 0.1 * this.hardness;
  }
  /** How much of the bowler's pace comes off the bat. */
  get batPace() {
    return 0.84 + 0.16 * this.hardness;
  }
  get label() {
    if (this.overs < 0.01) return "BRAND NEW";
    if (this.reverse > 0.3) return "REVERSING";
    if (this.shine > 0.6) return "SHINY";
    if (this.hardness < 0.6) return "OLD & SOFT";
    return "SCUFFED";
  }
}
