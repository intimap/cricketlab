/** Close-view figures' poses: where the feet and hands go for each pose and phase. */

/**
 * Where a close-view figure's feet and hands go for each pose, in figure
 * units (48 = standing height, feet at 0, y up the screen is negative).
 * `top` is the top of the shoulders; bob lifts or sinks the whole body.
 */
export function figurePose(pose, phase) {
  let lean = 0;
  let bob = 0;
  let feet = [
    { x: -4, y: -1 },
    { x: 4, y: -1 },
  ];
  if (pose === "run" || pose === "walk" || pose === "backup") {
    const swing = Math.sin(phase * Math.PI * 2) * (pose === "run" ? 1 : 0.5);
    feet = [
      { x: -3 - swing * 2, y: -1 - Math.max(0, swing) * 6 },
      { x: 3 + swing * 2, y: -1 - Math.max(0, -swing) * 6 },
    ];
    bob = Math.abs(swing);
    if (pose === "run") lean = 1;
  } else if (pose === "bound") {
    feet = [
      { x: -4, y: -9 },
      { x: 5, y: -12 },
    ];
    bob = -4;
  } else if (pose === "follow") {
    feet = [
      { x: -6, y: -1 },
      { x: 5, y: -1 },
    ];
    lean = 3;
    bob = 3;
  } else if (pose === "celebrate") {
    bob = -1;
  } else if (pose === "dive") {
    // Flat out for the crease: low, legs trailing, the bat stretched out ahead along the turf.
    feet = [
      { x: -6, y: -2 },
      { x: 5, y: -4 },
    ];
    lean = 5;
    bob = 18;
  }
  const top = -42 + bob;
  let hands;
  switch (pose) {
    case "dive":
      hands = [
        { x: -4, y: top + 20 },
        { x: 6, y: top + 21 },
      ];
      break;
    case "run": {
      const swing = Math.sin(phase * Math.PI * 2);
      hands = [
        { x: -8, y: top + 15 - swing * 6 },
        { x: 8, y: top + 15 + swing * 6 },
      ];
      break;
    }
    case "bound":
      hands = [
        { x: -10, y: top - 10 },
        { x: 9, y: top - 12 },
      ];
      break;
    case "release":
      hands = [
        { x: -4, y: top - 21 },
        { x: 13, y: top + 10 },
      ];
      break;
    case "follow":
      hands = [
        { x: 9 + lean, y: top + 19 },
        { x: 14, y: top + 11 },
      ];
      break;
    case "celebrate":
      hands = [
        { x: -12, y: top - 14 },
        { x: 12, y: top - 14 },
      ];
      break;
    case "appeal":
      hands = [
        { x: -9, y: top - 16 },
        { x: 12, y: top + 12 },
      ];
      break;
    case "outFinger":
      hands = [
        { x: -9, y: top + 16 },
        { x: 6, y: top - 16 },
      ];
      break;
    case "backup":
    case "walk": {
      const swing = Math.sin(phase * Math.PI * 2);
      hands = [
        { x: -9, y: top + 19 - swing * 3 },
        { x: 9, y: top + 19 + swing * 3 },
      ];
      break;
    }
    default:
      hands = [
        { x: -9, y: top + 19.5 },
        { x: 9, y: top + 19.5 },
      ];
  }
  return { lean, top, feet, hands };
}
