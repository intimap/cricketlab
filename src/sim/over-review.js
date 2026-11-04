/**
 * One line on how an over went, for the player bowling it: from where each ball pitched and what came of it,
 * and how the batter read them (sim/innings.js notes each ball's dot). The first that fits is said.
 */

const LINES = [
  [(o) => o.wicketAfterChange, "THE CHANGE-UP DID IT: THE WICKET CAME FROM THE BALL HE DIDN'T SEE COMING."],
  [(o) => o.wickets > 0, "A WICKET. KEEP ASKING THE SAME QUESTION OF THE NEW MAN?"],
  [(o) => o.lined >= 2 && o.runs >= 6, "HE LINED UP THE REPEATS. MIX IT UP NEXT OVER."],
  [(o) => o.beaten >= 2, "BEATEN TWICE. HE ISN'T READING YOU: STAY ON IT."],
  [(o) => o.changeBeat, "THE ONE THAT CHANGED BEAT HIM. THAT'S THE PLAN WORKING."],
  [(o) => o.runs >= 12, "EXPENSIVE. TOO MUCH TO HIT: BACK TO A LENGTH."],
  [(o) => o.runs <= 2, "TIGHT. THE PRESSURE IS BUILDING ON HIM."],
  [(o) => o.full >= 3 && o.runs >= 8, "TOO FULL TOO OFTEN. HE'S DRIVING YOU."],
  [() => true, "A STEADY OVER."],
];

/** The over's facts and its line: { runs, wickets, line }. `dots`: the over's pitch dots. */
export function overReview(dots) {
  const o = {
    runs: dots.reduce((n, d) => n + d.runs, 0),
    wickets: dots.filter((d) => d.wicket).length,
    beaten: dots.filter((d) => d.beaten).length,
    lined: dots.filter((d) => d.familiar >= 2).length,
    full: dots.filter((d) => d.z < 4.5 && d.z > 1.3).length,
    wicketAfterChange: dots.some((d) => d.wicket && (d.surprise || d.notPicked)),
    changeBeat: dots.some((d) => d.beaten && (d.surprise || d.notPicked)),
  };
  return { runs: o.runs, wickets: o.wickets, line: LINES.find(([test]) => test(o))[1] };
}
