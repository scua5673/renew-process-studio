# Board settings and multiple-pitch markings

Prepared locally from production `e9d2babc` (3.244), on `codex/board-settings-pitch-lines`. Release number 3.246 is provisional until the next release checks concurrent work. No remote push or production deployment is part of this change yet.

## Reproduced problems

The multiple-pitch renderer used fixed football proportions for every non-futsal specification: the penalty-area depth was 15.5% of length and the center-circle radius was 13% of width. An 8-a-side pitch requires the application's configured 12.5/65 and 7/48 respectively. The line visibility setting was absent from its cache key, and changes to the line/grid builders did not reliably repaint the multiple-pitch layer. Hidden lines therefore remained visible.

The multiple-pitch grid renderer omitted `grid` and `fthird`, and rendered `zone20` as a 15-zone grid. Its lane widths also ignored the specification. The four smaller pitches in the five-pitch arrangement explicitly suppressed their goals. Custom color contrast was computed separately from the single-pitch palette.

## Changes

- Read all line measurements from the board's existing `PITCH_SPECS`: penalty and goal areas, circle, arc intersections, penalty marks, corners and goal width/depth. Futsal includes both penalty marks, second-mark side marks and substitution-zone marks.
- Use the same resolved `--pline` and `--grid` colors as the board. Include colors and line visibility in the layout signature.
- Repaint multiple pitches synchronously when the board rebuilds lines or grids. Keep the existing stable world frame, fitted aspect ratios, saved coordinates, atomic group replacement and 3D goal metadata.
- Render every existing grid type with specification-aware lane and penalty boundaries. `fthird` remains supported for older saved boards; no removed button is reintroduced.
- Include both goals on each of the five pitches, retaining the existing depth limit between rows. Apply that limit after 3D depth exaggeration as well, so opposing goal footprints cannot intersect; the live view and video export use the same limit.
- Keep cards and tactical grids when field markings are hidden; the 3D goal and export paths obey the same line setting.

## Validation

`tests/browser/board-settings-pitches.mjs` exercises settings buttons, all 1–6 counts, three specifications and both orientations in 3D, seven grid types, custom colors, line hiding, snapshot restoration, undo, blank-grid transition and SVG export. It uses the synthetic team fixture and cannot write to production services.

The existing browser regressions cover settings hierarchy, manual opening, the settings strip, per-document appearance, 3D mood/decorations, stadium bounds, cross-page pitch settings and 180 rotation/viewport combinations per engine. Detailed run results and screenshots are kept in the workspace's `outputs/2026-11-03-board-settings/` folder. Physical-device testing and production publishing are separate from local browser validation.

Final verification records both browser runs (36 3D combinations and 180 rotation/viewport combinations per engine), 9 existing settings/rendering regressions per engine, the complete unit suite and local SQL suite. An initial new color assertion incorrectly treated SVG `stroke="none"` on filled dots as their color; the assertion was corrected and rerun. A subsequent parallel unit run hit an unchanged 30 ms synthetic workspace-barrier timer; the isolated 7-test recheck passed without changing runtime or test timeouts.

Final unit run with four workers: 5,438/5,438 passed. Local SQL suite passed. Packaging produced 1,955 runtime files for process-3.246. No runtime validation errors remain; the failed diagnostic attempts are retained in the output folder.
