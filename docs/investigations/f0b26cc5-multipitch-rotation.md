# Multiple-pitch rotation — f0b26cc5

The October 31 report describes two pitches losing their proportions after rotation. It was filed from build 3.207 on Chrome/macOS and reproduced with the synthetic team fixture against staging 3.227.

## Cause and correction

The shell used the board's rotated viewport as unrotated world coordinates. The board also widened that viewport to 2.2:1 independently of its orientation. Two pitches changed from world rectangles of 752.5 × 688 to 1128 × 1032 after rotation and extended outside the visible board. Each card independently filled its cell, so its aspect ratio also ignored the selected pitch specification.

The renderer now converts the viewport back into world coordinates, uses a fixed world frame, and fits centered cells to the existing 11-a-side, 8-a-side or futsal aspect ratio. Pitch specification participates in the rendering cache key. The existing multi-pitch renderer moved from app.html to board-multipitch.js, with a lower shell size budget. Drawing, player, storage and synchronization formats are unchanged; no saved document migration runs.

## Verification

- Unit suite: 5,349 passed. The existing pitch-presentation test now reads the extracted renderer.
- WebKit: 180 combinations (375/768/1280px, counts 2–6, three pitch specifications, four quarter-turns), actual settings buttons, save/reload and image-export geometry passed.
- Chromium, SQL and the existing animation/3D regressions: in progress at this commit.
- Physical iPad/iPhone/Android devices: not tested. This correction does not establish a cause or resolution for earlier iPad termination reports.
- Production data writes, report replies and report closures: none.
