# Cricket Lab

A 16-bit style Test cricket game (Australia v England) that runs in the browser as a single HTML page.

## Play

Open `index.html` in a desktop browser (it needs a keyboard). Click the game, then press Enter.

- **Batting:** S drive, Q cut/pull, W loft, A defend. Arrows aim, Left Shift adds power.
- **Bowling:** arrows set line and length, 1–5 pick the delivery, Space runs in and releases.
- **Other:** O sim an over, P sim 5 overs, C camera, M sound, Esc scorecard.

## Notes

`index.html` holds the whole game: one bundled, minified script with the art embedded as base64 PNGs.
The original TypeScript source wasn't in the published page, so local names in the script are minified.
