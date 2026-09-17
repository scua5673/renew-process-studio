-- READ ONLY. Size audit for planning DB compaction migrations.
-- This script does not print ps_kv.v, library item bodies, blob values, tokens or
-- user messages. Review byte counts first, then decide which migration to run.
BEGIN READ ONLY;

SELECT current_user AS applying_role,current_setting('server_version') AS server_version;

-- Table footprint. total_bytes includes indexes and TOAST; toast_bytes is where
-- large text/jsonb values usually live.
SELECT n.nspname AS schema_name,c.relname,
  pg_total_relation_size(c.oid) AS total_bytes,
  pg_relation_size(c.oid) AS heap_bytes,
  pg_indexes_size(c.oid) AS index_bytes,
  CASE WHEN c.reltoastrelid=0 THEN 0 ELSE pg_total_relation_size(c.reltoastrelid) END AS toast_bytes,
  s.n_live_tup,s.n_dead_tup,s.last_vacuum,s.last_autovacuum,s.last_analyze,s.last_autoanalyze
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
WHERE n.nspname IN ('public','ps_roster_private')
  AND c.relkind IN ('r','p')
  AND c.relname IN (
    'ps_kv','ps_kv_history','ps_blob','ps_library','ps_events',
    'ps_support_reports','ps_support_replies',
    'control','backups','requests','write_permits'
  )
ORDER BY total_bytes DESC NULLS LAST,n.nspname,c.relname;

-- ps_kv rows with the largest payloads. Payload text is intentionally omitted.
SELECT workspace_id,k,cupd,
  pg_column_size(v) AS stored_bytes,
  octet_length(v::text) AS text_bytes,
  CASE
    WHEN k IN ('process_coach_v1','scout_tool_v1') AND position('"thumbRef"' IN v::text)>0 THEN true
    WHEN k IN ('process_coach_v1','scout_tool_v1') AND position('"emblemRef"' IN v::text)>0 THEN true
    WHEN k IN ('process_coach_v1','scout_tool_v1') AND position('"psblob:' IN v::text)>0 THEN true
    ELSE false
  END AS has_blob_refs,
  CASE
    WHEN position('data:image/' IN v::text)>0 THEN true
    WHEN position('<svg' IN v::text)>0 THEN true
    ELSE false
  END AS has_inline_media_marker
FROM public.ps_kv
ORDER BY pg_column_size(v) DESC NULLS LAST
LIMIT 100;

-- Key-level totals identify which app documents should be compacted first.
SELECT k,
  count(*) AS rows,
  sum(pg_column_size(v)) AS stored_bytes,
  avg(pg_column_size(v))::bigint AS avg_stored_bytes,
  max(pg_column_size(v)) AS max_stored_bytes,
  sum(CASE WHEN position('data:image/' IN v::text)>0 THEN 1 ELSE 0 END) AS inline_image_rows,
  sum(CASE WHEN position('<svg' IN v::text)>0 THEN 1 ELSE 0 END) AS inline_svg_rows,
  sum(CASE WHEN position('"thumbRef"' IN v::text)>0 OR position('"emblemRef"' IN v::text)>0 OR position('"psblob:' IN v::text)>0 THEN 1 ELSE 0 END) AS blob_ref_rows
FROM public.ps_kv
GROUP BY k
ORDER BY stored_bytes DESC NULLS LAST
LIMIT 80;

-- Prefix grouping keeps per-player/item rows readable without dumping IDs.
SELECT CASE
    WHEN k LIKE 'sq:%' THEN 'sq:*'
    WHEN k LIKE 'cs_idp_v1_%' THEN 'cs_idp_v1_*'
    WHEN k LIKE 'cs_idp_pub_v1_%' THEN 'cs_idp_pub_v1_*'
    ELSE k
  END AS key_group,
  count(*) AS rows,
  count(DISTINCT workspace_id) AS workspaces,
  sum(pg_column_size(v)) AS stored_bytes,
  avg(pg_column_size(v))::bigint AS avg_stored_bytes,
  max(pg_column_size(v)) AS max_stored_bytes
FROM public.ps_kv
GROUP BY 1
ORDER BY stored_bytes DESC NULLS LAST
LIMIT 80;

-- Workspace totals help find accidental bulk imports or runaway autosave data.
SELECT workspace_id,
  count(*) AS rows,
  sum(pg_column_size(v)) AS stored_bytes,
  max(pg_column_size(v)) AS max_row_bytes,
  array_agg(k ORDER BY pg_column_size(v) DESC) FILTER (WHERE pg_column_size(v)>262144) AS large_keys_over_256kb
FROM public.ps_kv
GROUP BY workspace_id
ORDER BY stored_bytes DESC NULLS LAST
LIMIT 80;

-- History volume by key. The body is not selected.
SELECT k,
  count(*) AS history_rows,
  min(changed_at) AS oldest_at,
  max(changed_at) AS newest_at,
  sum(pg_column_size(v)) AS stored_bytes,
  max(pg_column_size(v)) AS max_stored_bytes
FROM public.ps_kv_history
GROUP BY k
ORDER BY stored_bytes DESC NULLS LAST
LIMIT 80;

-- Optional object inventory. If one of these is missing, install/rollback state
-- should be reviewed before planning a compaction migration.
SELECT n.nspname AS schema_name,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='public' AND c.relname IN ('ps_kv','ps_kv_history','ps_blob','ps_library'))
   OR (n.nspname='ps_roster_private' AND c.relname IN ('control','backups','requests','write_permits'))
ORDER BY n.nspname,c.relname;

-- Supabase SQL Editor may show only the final result grid. This final summary
-- repeats the actionable output as JSON sections so one copy/paste is enough.
SELECT section,rows
FROM (
  SELECT 1 AS sort,'table_footprint' AS section,
    coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.total_bytes DESC NULLS LAST,x.schema_name,x.relname),'[]'::jsonb) AS rows
  FROM (
    SELECT n.nspname AS schema_name,c.relname,
      pg_total_relation_size(c.oid) AS total_bytes,
      pg_relation_size(c.oid) AS heap_bytes,
      pg_indexes_size(c.oid) AS index_bytes,
      CASE WHEN c.reltoastrelid=0 THEN 0 ELSE pg_total_relation_size(c.reltoastrelid) END AS toast_bytes,
      s.n_live_tup,s.n_dead_tup,s.last_vacuum,s.last_autovacuum,s.last_analyze,s.last_autoanalyze
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
    WHERE n.nspname IN ('public','ps_roster_private')
      AND c.relkind IN ('r','p')
      AND c.relname IN (
        'ps_kv','ps_kv_history','ps_blob','ps_library','ps_events',
        'ps_support_reports','ps_support_replies',
        'control','backups','requests','write_permits'
      )
    LIMIT 80
  ) x
  UNION ALL
  SELECT 2,'ps_kv_key_totals',
    coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.stored_bytes DESC NULLS LAST),'[]'::jsonb)
  FROM (
    SELECT k,
      count(*) AS rows,
      sum(pg_column_size(v)) AS stored_bytes,
      avg(pg_column_size(v))::bigint AS avg_stored_bytes,
      max(pg_column_size(v)) AS max_stored_bytes,
      sum(CASE WHEN position('data:image/' IN v::text)>0 THEN 1 ELSE 0 END) AS inline_image_rows,
      sum(CASE WHEN position('<svg' IN v::text)>0 THEN 1 ELSE 0 END) AS inline_svg_rows,
      sum(CASE WHEN position('"thumbRef"' IN v::text)>0 OR position('"emblemRef"' IN v::text)>0 OR position('"psblob:' IN v::text)>0 THEN 1 ELSE 0 END) AS blob_ref_rows
    FROM public.ps_kv
    GROUP BY k
    ORDER BY stored_bytes DESC NULLS LAST
    LIMIT 40
  ) x
  UNION ALL
  SELECT 3,'ps_kv_largest_rows',
    coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.stored_bytes DESC NULLS LAST),'[]'::jsonb)
  FROM (
    SELECT workspace_id,k,cupd,
      pg_column_size(v) AS stored_bytes,
      octet_length(v::text) AS text_bytes,
      CASE
        WHEN k IN ('process_coach_v1','scout_tool_v1') AND position('"thumbRef"' IN v::text)>0 THEN true
        WHEN k IN ('process_coach_v1','scout_tool_v1') AND position('"emblemRef"' IN v::text)>0 THEN true
        WHEN k IN ('process_coach_v1','scout_tool_v1') AND position('"psblob:' IN v::text)>0 THEN true
        ELSE false
      END AS has_blob_refs,
      CASE
        WHEN position('data:image/' IN v::text)>0 THEN true
        WHEN position('<svg' IN v::text)>0 THEN true
        ELSE false
      END AS has_inline_media_marker
    FROM public.ps_kv
    ORDER BY pg_column_size(v) DESC NULLS LAST
    LIMIT 40
  ) x
  UNION ALL
  SELECT 4,'ps_kv_history_totals',
    coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.stored_bytes DESC NULLS LAST),'[]'::jsonb)
  FROM (
    SELECT k,
      count(*) AS history_rows,
      min(changed_at) AS oldest_at,
      max(changed_at) AS newest_at,
      sum(pg_column_size(v)) AS stored_bytes,
      max(pg_column_size(v)) AS max_stored_bytes
    FROM public.ps_kv_history
    GROUP BY k
    ORDER BY stored_bytes DESC NULLS LAST
    LIMIT 40
  ) x
) summary
ORDER BY sort;

COMMIT;
