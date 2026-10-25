# Board history and player panel support follow-up

Owner: this draft PR. Baseline: staging/main a10cbb9 (3.173).

- Report `54b61c3e-86d0-47df-bf57-ae681fa33943`: page rename/reorder is outside undo and clears prior board undo history. Reproduce using synthetic pages, then preserve one chronological undo/redo history for board and page edits without leaking it into borrowed editors.
- Report `0d5cee85-bf02-4cdd-92f0-2f9f7dbdb38c`: the fixed player information panel can cover the ball when choosing a gaze target. Keep the current interface and allow safe pointer/touch repositioning within the visible viewport.

Validation pending. No reporter replies, report status changes, production data writes, or real-account browser storage changes are part of this PR. The deferred backend-isolation work in draft #625 remains separate.
