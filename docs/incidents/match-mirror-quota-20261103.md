# Match mirror quota recovery investigation

Diagnostic reference: sync_storage / storage / match-round-failed, 2026-11-03 08:58 KST, client 3.238. No new support-report ID is associated with this diagnostic; no report has been created or changed.

A two-round synthetic reproduction on 3.243 writes a new server match document to IDB, rejects only its localStorage mirror, then lifts quota. The second round retains the old mirror and new IDB/server originals but fails the expected-local guard before another mirror attempt, with readiness false. This does not establish the real account cause or authorize overwriting newer local edits.

Scope: preserve exact prior-base, owner, permissions, concurrent-edit and server-readiness protections while allowing a verified unchanged mirror to recover. Do not change optional schedule-mirror policy. All reproduction data is synthetic.

Status: claimed before runtime edits; tests and implementation pending.
