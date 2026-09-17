# ps_library blob backfill runbook

This migration reduces database size by moving existing large `ps_library.item`
media strings to `ps_blob`. This includes JSON string values that contain inline
`data:image/` or SVG media. The library row keeps a `psblob:<hash>` reference
that current clients already hydrate.

## Before Apply

1. Run `20260916_library_blob_backfill.preflight.sql`.
2. Confirm `has_pgcrypto_digest` is true and the result estimates enough
   candidate rows to justify applying.
3. Apply during a quiet window. The migration uses exact `item_before` checks and
   aborts if a library row changes while it runs.

## Apply

Run `20260916_library_blob_backfill.sql` once from an administrative SQL
session. It is idempotent for rows that were already rewritten.

## After Apply

1. Re-run `20260916_db_size_audit.preflight.sql`.
2. Confirm `ps_library` inline image rows dropped and `ps_blob` grew.
3. Expect physical table size to shrink only after PostgreSQL can reclaim or
   reuse old TOAST pages. This migration primarily stops repeated large reads and
   future growth immediately.
