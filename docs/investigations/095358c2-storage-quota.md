# Repeated storage-capacity warning investigation

Support report: 095358c2-8c11-497e-a5ed-b95e6597d762.

The report describes a recurring capacity warning on an installed desktop browser. Its privacy-filtered support diagnostic contains a quota error and three storage errors, but no precise storage stage or size metadata. Existing protections and aggregate event labels do not yet establish whether the localStorage mirror or IndexedDB failed.

Read-only metadata confirmed that the desktop small store contained about 5.3 MiB across 137 keys. Active private-board recovery head and unsaved copies accounted for about 4.5 MiB; the failed key was the schedule mirror. The origin-wide estimate was only 51 MiB of roughly 10 GiB, which is not the small-store limit. Recovery copies must remain intact. No production app-data or customer browser-store writes, customer contents, identifiers, or private query output belong in this repository or fixtures.

An actual synthetic schedule memo edit with only the mirror failing stayed in memory while IDB/server retained the old original. The process page had treated the synchronous mirror boolean as the complete durable result and skipped its pending/generation bookkeeping. The new path awaits the already-attempted exact IDB write, verifies owner/source/latest sequence, then removes only the exact obsolete mirror. The null-mirror event lets the shell queue the current IDB original. Both-store failure keeps the draft, visible failure and transition barrier. Delayed cleanup cannot retry an old owner's draft.

Sync previously treated a server-equal mirror as permission to replace a different IDB original. Unknown originals now remain untouched; only an exact confirmed previous base may be repaired with an atomic comparison. A verified document can release only its own quota warning.

Regression evidence includes baseline failures, owner/source/atomic-write/late-completion negative controls and real fixture UI/ACK/reload checks. Exact final CI, published-source and deployment results are recorded in the task handoff; passing unit checks alone are not a production release.

Physical iPad termination remains unverified. Investigate only new evidence or concrete untested hypotheses; successful synthetic boot tests alone do not establish a physical-device fix.

The tablet event followed a quota failure, with age 20 seconds and loaded=1. This establishes neither an OS memory kill nor the cause of a physical iPad termination. Desktop WebKit fixture observations do not replace physical-device evidence.

Status: fix prepared; end-to-end verification and normal staging/promotion pipeline pending.

The first staging push CI failed in the new browser test after reload: its
readiness predicate accessed `PSSync` before that document exposed the API.
The exact PR CI had passed, so the staging failure is preserved separately.
The readiness test must wait for the API's existence and then its original
unlocked/non-booting conditions; no product guard or preservation assertion is
weakened. This follow-up changes tests/documentation only and retains 3.183.
