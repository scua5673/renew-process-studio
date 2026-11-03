# Match mirror quota recovery investigation

Diagnostic reference: sync_storage / storage / match-round-failed, 2026-11-03 08:58 KST, client 3.238. No new support-report ID is associated with this diagnostic; no report has been created or changed.

A two-round synthetic reproduction on 3.243 writes a new server match document to IDB, rejects only its localStorage mirror, then lifts quota. The second round retains the old mirror and new IDB/server originals but fails the expected-local guard before another mirror attempt, with readiness false. This does not establish the real account cause or authorize overwriting newer local edits.

Production MATCH has no merge base. The generic reproduction fixture had a base Map; that Map is not proof that an old MATCH mirror is confirmed. The new regression tests use the production MATCH base policy and error classifier.

Fix scope: only an actual match-mirror quota failure may conditionally roll back the exact IDB candidate written by that same operation to its captured previous IDB raw. Atomic comparison plus current owner, permissions, role and mirror guards preserve later edits. The original quota is still reported. After space is available, an ordinary later pull can retry; no readiness or outbox ACK bypass is added. Existing ambiguous split copies retain the existing review path. Do not change optional schedule-mirror policy. All reproduction data is synthetic.

Validation: 63 targeted units passed; Chromium and WebKit native-fixture tests passed quota retry, exact source preservation, ordinary recovery, real match input/save and reload. Initial browser setup failures and the reproduction qualification are retained in evidence. Full suite, CI and publication status are recorded in the pull request. Physical devices and existing real-account copies are unverified.
