# Roster pending quota recovery

This investigation uses synthetic accounts and local fixtures. Customer reports, diagnostic bodies, device details, and private evidence mappings are kept outside the repository. It does not establish a customer failure cause or recover customer data.

## Preservation contract

The synthetic baseline adds a player through the real UI and rejects the first immutable `ps_roster_pending_v1:` localStorage batch. At baseline runtime `e9d2babca609315bd3f565107db37739da1bc4b2`, the row remained in memory but neither pending store held its original; MAIN and SQ had not advanced. Reopening failed the original-preservation assertion. The same stage-before-MAIN path is present in version 3.240 code `ad5d7c160cab1acd5263ab8ea640c054187fe9fe`. This is code lineage, not evidence about any real account.

`studio/roster-pending.js` preserves the exact native key, token, sequence, raw body, base, and history in IDB only after an actual batch quota failure. Hydration reads only the current owner's prefix through the real native parser. Unknown hydration, failed preservation, or any retained rescue keeps MAIN, SQ, ACK, and update completion blocked. Concurrent owners, permissions, epochs, transitions, and source edits cannot borrow an earlier capture.

Recovery writes the same immutable raw to the same native LS key, verifies it, conditionally removes the exact IDB original, and verifies absence before the existing native save and ACK path resumes. An interrupted or failed removal stays pending. A foreign LS body arriving during asynchronous readback is retained. If neither store accepts the original, the operation never reports success.

## Exact MAIN confirmation

The generic read-only confirmation from `e6b18e2a` is integrated in `scoutStore.set`. It confirms the captured owner, permission scope, authored memory draft, LS mirror, and already-attempted IDB body without replaying the failed document write. A confirmed MAIN body does not acknowledge a native player batch or a server row. Both asynchronous confirmation reads reject changed source or authority.

## Owned source suspension

The first implementation confused a changed preparation stamp with an actual rescue. A normal workspace transition rotates its guard, epoch, and source seal after the first flush, so its second flush incorrectly attempted writable recovery on an empty journal.

`PSSync.sourceSuspension()` supplies read-only proof from the actual transition closure while the same owned source remains current and no wipe has started. `emptyForTransition()` requires a previously hydrated exact source, no rescue/job/error, a fresh stable IDB-prefix read, and unchanged empty native LS state. Its lease changes observation only; it does not change `preparedStamp` or grant stage, read/overlay, ACK, settle, or promote authority. Unknown hydration, retained originals, new batches, and external authority changes remain blocked.

## Synthetic validation and limits

The preservation boundary has 42 targeted unit cases, and `tests/roster-source-suspension.test.cjs` exercises the actual transition closure and getter. Related durability, coordination, branding, syntax, and size checks are retained. The source-suspension repair is frozen at `2cf5cab2804b0f9c8aa663bc11a07efe4e126ba1` before later test observations are revised.

Native Chromium and WebKit checks retain exact device and synthetic server assertions. New SQ keys are verified on the server only after a real completed reopen performs a fresh live-key scan; no clock or sync-readiness predicate is changed. MAIN quota with a real native batch verifies that MAIN confirmation alone leaves the batch, ACK, SQ, and exit barrier untouched. Completion then requires the original SQ body, a completed reopen, an exact synthetic server row, and no resurrection. Both-store failure stays failed and pending.

Two isolated harness dependencies were corrected without changing runtime success conditions. `storage-safety` explicitly performs real journal hydration before asserting an empty queue. `root-child-save-state` captures exact local/IDB, saved state, no pending work, and server confirmation in one accepted observation; this avoids a later automatic round invalidating a separate read. Original server, negative, and timeout assertions remain.

Source CI at `2cf5cab` failed at a later native-resume test boundary. A separate read-only observation reproduced the same failure mode after an actual automatic heal and one-row ACK had already emptied the receipt. This does not establish that Linux CI followed that order. The strict test permits an idempotent false only with unchanged captured authority, no guard or rescue, a prepared empty receipt, exact MAIN/memory/SQ bodies, and the real flush barrier followed by a second exact check. Other false results remain failures. Native Chromium and WebKit retain the final exact SQ, reopen, server, no-resurrection, and both-store-failure assertions.

Local targeted results do not constitute a passing release. Original failures and synthetic raw evidence are preserved locally. Full unit, independent review, fresh source CI, and release verification are required for each final candidate. No production database, account storage, report reply, or report status is changed by these tests.

Failed-only scalar artifacts record the actual navigation request/message state, click-time action and child readiness, or permission-phase key readiness and exact local stores. A diagnostic read error cannot replace the original assertion failure. Local passing observations do not establish the Linux CI cause.

The next navigation failure recorded an active `playersView` and a completed latest request, followed by older `home`/`team` notifications that changed the parent selection. The shell now accepts a child notification only when it matches the child's current visible view. Two unit regressions fail before this change and pass afterward; the browser check also sends an old notification after a real navigation and retains the original menu assertions.

The permission scenario now requires actual MATCH key readiness, no document/sync/typed/local pending work, a successful real local barrier, and exact local/IDB `abcde` before permission is denied. Preparation stays within the existing eight-second completion bound. If a server round is needed it uses the captured real engine before the permission flag and guard-call counters are set. The original permission toast and no-extra-guard-sync assertions remain.

The phone board fixture waits for the current owner's restore generation and write flight to finish before seeding its synthetic token. `__boardRestoreDone` remains true after the initial restore, while a later generation can mark its local head loaded before the remote read and apply finish. A fixture seed is not a tracked user edit. Waiting for current owner, loaded state, no active restore, and no flight excludes that unfinished lifecycle without changing product edit protection or geometry/read-only assertions. The exact historical CI generation was not recorded and remains unknown.

A subsequent null element-handle box retained the seeded player and completed current-owner restore. Input preparation now queries the live token, reads the board state, and measures the token/frame coordinate spaces in one synchronous callback, avoiding an element handle spanning a token render. Missing or hidden current geometry still fails immediately, with no measurement retry or relaxed pointer, keyboard, storage, or read-only assertion. The artifact does not by itself prove which render detached the old handle.
