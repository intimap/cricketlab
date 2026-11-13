import { Rng } from "./rng.js";
import { OverSummary } from "./over-summary.js";
import { BoothEditor } from "./booth-editor.js";
import { createNarrative, trackBall, getOverSummary } from "./commentary-narrative.js";

export { LINES, COLOUR_LINES } from "./broadcast-context.js";
export { pickChirp, pickSledges } from "./field-chatter.js";

/** Compatibility facade: one narrative and one active booth per match. */
export class Commentary extends OverSummary {
  narrative = createNarrative();
  booth = new BoothEditor();
  chatMemory = new Set();
  innings = null;

  constructor(rng = new Rng(1)) {
    super(rng);
  }

  beginInnings(inn) {
    this.innings = inn;
    this.narrative = createNarrative();
    this.chatMemory.clear();
  }

  // Accept both remember(rec, inn) and the original remember(rec, batter, bowler).
  remember(rec, batterOrInnings, bowler, inn = this.innings) {
    if (Array.isArray(batterOrInnings?.bat)) inn = batterOrInnings;
    if (!inn) {
      inn = this.compatibilityInnings ??= { bat: [], bowl: [], pitch: {}, legal: 0 };
      inn.bat[rec.striker] = batterOrInnings;
      inn.bowl[rec.bowler] = bowler;
      inn.legal = (rec.over ?? 0) * 6 + (rec.legal ? (rec.ball ?? 0) : (rec.ball ?? 1) - 1);
    }
    if (this.innings !== inn) this.beginInnings(inn);
    return trackBall(this.narrative, rec, inn);
  }

  /**
   * The match memory's moments for the ball about to be called (sim/match-memory.js): the box weighs them with
   * everything else it could say (a wicket's or a boundary's call still comes first).
   */
  onMoments(moments) {
    // A moment the box couldn't say last ball (it was recapping the over) is offered again with this one's.
    this.booth.moments = [...this.booth.carried, ...(moments ?? [])];
    this.booth.carried = [];
  }

  overSummary(inn, over) {
    return getOverSummary(inn, over) || super.overSummary(inn);
  }
}
