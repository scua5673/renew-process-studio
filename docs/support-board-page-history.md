# Board history and player panel support follow-up

Owner: this draft PR. Baseline: staging/main a10cbb9 (3.173).

- Report `54b61c3e-86d0-47df-bf57-ae681fa33943`: page rename/reorder is outside undo and clears prior board undo history. Reproduce using synthetic pages, then preserve one chronological undo/redo history for board and page edits without leaking it into borrowed editors.
- Report `0d5cee85-bf02-4cdd-92f0-2f9f7dbdb38c`: the fixed player information panel can cover the ball when choosing a gaze target. Keep the current interface and allow safe pointer/touch repositioning within the visible viewport.

The existing fifty-step stack now tags board edits with a transient page identity and stores only small name/order records for page edits. Ordinary page navigation keeps that chronology. Destructive page operations and borrowed-document boundaries keep their previous history reset, while returning from a training editor or vault restores the correct work context. A second click landing on a moving tab control cannot accidentally open its delete confirmation.

The inspector uses its existing placement path for manual header dragging, with viewport clamping, keyboard movement, and a memory-only position. Inputs and scrolling keep their own gestures. Its close button now also hides the panel after touch input and the next token selection can reopen it.

Validation: unit tests 4,340 passed; unchanged SQL tests 26 passed in isolated PGlite. Targeted Chromium/WebKit UI verification passed: page chronology, inactive-tab double-click, animation, capture/editor/vault context restoration, patternbook and duplicate boundaries; player panel pointer/touch movement, gaze selection, input, scrolling, close/reopen, keyboard movement, resize and transforms. Phone widths 375/393 retain their dock and have no horizontal overflow. Required CI is pending before merge. The board remains below its unchanged 2,560,000-byte budget.

No reporter replies, report status changes, production data writes, or real-account browser storage changes are part of this PR. The deferred backend-isolation work in draft #625 remains separate. Browser validation is not evidence that a physical iPad shutdown has been resolved.
