# DB size audit runbook

This is a read-only planning step for reducing backend database storage. It must
not be used as proof that deleting or rewriting rows is safe.

## Run

1. Confirm the Supabase project is the production project you intend to inspect.
2. Run `migrations/20260916_db_size_audit.preflight.sql` from SQL Editor or an
   administrative SQL session.
3. Save the result grids privately. The script does not print payload bodies, but
   workspace IDs and key names can still identify affected teams.

## Interpret

- Start with the table footprint result. If `toast_bytes` dominates `ps_kv`,
  large text/jsonb values are the main target.
- In the key totals result, rows with many `inline_image_rows` or
  `inline_svg_rows` should usually be migrated to `ps_blob` references first.
- `process_coach_v1`, `scout_tool_v1`, and `ps_library` are expected first
  candidates because the client already has blob-reference hydration paths.
- Large `ps_kv_history` totals point to retention cleanup, not a client payload
  rewrite. Keep enough history for recovery before applying a TTL.
- A small heap with many dead tuples points to vacuum/analyze work after cleanup.

## Safe next migrations

1. Backfill inline media to `ps_blob` for keys that already support references.
2. Add dual-read support before expanding blob references to new keys.
3. Add retention cleanup for history/request/backup tables with a rollback plan.
4. Add a size guard only after old clients are no longer writing large inline
   payloads.
