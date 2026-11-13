/**
 * The match memory's moments (sim/match-memory.js): their names (each is also the commentary situation its
 * lines are under, sim/situations.js), and each type's rules.
 */

export const MOMENT = {
  TURNING_POINT: "turningPoint",
  PARTNERSHIP_SWING: "partnershipSwing",
  DUEL_BEATEN: "duelBeaten",
  DUEL_DOMINANCE: "duelDominance",
  DUEL_REPEAT_DISMISSAL: "duelRepeatDismissal",
  DUEL_DOT_SQUEEZE: "duelDotSqueeze",
  LETOFF_COST: "letoffCost",
  CHASE_RRR_THRESHOLD: "chaseRrrThreshold",
  CHASE_CHECKPOINT: "chaseCheckpoint",
  CHASE_BOUNDARY_PER_OVER: "chaseBoundaryPerOver",
  PHASE_NEW_BALL: "phaseNewBall",
  PHASE_REVERSE: "phaseReverse",
  PHASE_TURN: "phaseTurn",
  PHASE_POWERPLAY_END: "phasePowerplayEnd",
  PHASE_LIGHT: "phaseLight",
  PHASE_LAST_OVER_BEFORE_BREAK: "phaseLastOverBeforeBreak",
};

/**
 * Each type's priority (the commentary's scale: a wicket's remark is 80, a milestone 100), its cooldown (balls
 * before another of the type), and how long it may wait to be said (balls; 0: now or never).
 */
export const MOMENT_RULES = {
  [MOMENT.TURNING_POINT]: { priority: 78, cooldown: 18, keep: 0 },
  [MOMENT.PARTNERSHIP_SWING]: { priority: 70, cooldown: 30, keep: 6 },
  [MOMENT.DUEL_BEATEN]: { priority: 62, cooldown: 12, keep: 3 },
  [MOMENT.DUEL_DOMINANCE]: { priority: 64, cooldown: 18, keep: 4 },
  [MOMENT.DUEL_REPEAT_DISMISSAL]: { priority: 92, cooldown: 0, keep: 0 },
  [MOMENT.DUEL_DOT_SQUEEZE]: { priority: 58, cooldown: 30, keep: 2 },
  [MOMENT.LETOFF_COST]: { priority: 76, cooldown: 18, keep: 6 },
  [MOMENT.CHASE_RRR_THRESHOLD]: { priority: 66, cooldown: 12, keep: 3 },
  [MOMENT.CHASE_CHECKPOINT]: { priority: 60, cooldown: 0, keep: 4 },
  [MOMENT.CHASE_BOUNDARY_PER_OVER]: { priority: 67, cooldown: 12, keep: 3 },
  [MOMENT.PHASE_NEW_BALL]: { priority: 68, cooldown: 0, keep: 6 },
  [MOMENT.PHASE_REVERSE]: { priority: 57, cooldown: 0, keep: 12 },
  [MOMENT.PHASE_TURN]: { priority: 55, cooldown: 0, keep: 12 },
  [MOMENT.PHASE_POWERPLAY_END]: { priority: 60, cooldown: 0, keep: 3 },
  [MOMENT.PHASE_LIGHT]: { priority: 52, cooldown: 0, keep: 12 },
  [MOMENT.PHASE_LAST_OVER_BEFORE_BREAK]: { priority: 56, cooldown: 0, keep: 5 },
};
