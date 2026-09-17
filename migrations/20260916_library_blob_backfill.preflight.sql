-- READ ONLY. Estimate ps_library media strings that can be moved to ps_blob.
-- Does not print item bodies or blob values.
BEGIN READ ONLY;

SELECT current_user AS applying_role,current_setting('server_version') AS server_version;

SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('ps_library','ps_blob')
ORDER BY c.relname;

SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull
FROM pg_attribute a
JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('ps_library','ps_blob')
  AND a.attnum>0 AND NOT a.attisdropped
ORDER BY c.relname,a.attnum;

SELECT to_regprocedure('public.digest(bytea,text)') IS NOT NULL
    OR to_regprocedure('extensions.digest(bytea,text)') IS NOT NULL
    OR to_regprocedure('digest(bytea,text)') IS NOT NULL AS has_pgcrypto_digest;

WITH candidate_rows AS (
  SELECT workspace_id,lib_id,item,
    pg_column_size(item) AS stored_bytes,
    octet_length(item::text) AS text_bytes
  FROM public.ps_library
  WHERE item::text LIKE '%"data:image/%'
    AND coalesce(deleted_at,0)=0
),
matches AS (
  SELECT r.workspace_id,r.lib_id,r.stored_bytes,r.text_bytes,
    value #>> '{}' AS image_value,
    length(value #>> '{}') AS image_chars
  FROM candidate_rows r
  CROSS JOIN LATERAL jsonb_path_query(r.item,'$.**') AS q(value)
  WHERE jsonb_typeof(value)='string'
    AND length(value #>> '{}') BETWEEN 512 AND 1900000
    AND ((value #>> '{}') LIKE 'data:image/%'
      OR (value #>> '{}') LIKE '%data:image/%'
      OR (value #>> '{}') LIKE '<svg%'
      OR (value #>> '{}') LIKE '%<svg%')
)
SELECT jsonb_build_object(
  'candidate_rows',(SELECT count(*) FROM candidate_rows),
  'matched_images',(SELECT count(*) FROM matches),
  'oversized_images_skipped',0,
  'candidate_stored_bytes',(SELECT coalesce(sum(stored_bytes),0) FROM candidate_rows),
  'matched_image_chars',(SELECT coalesce(sum(image_chars),0) FROM matches),
  'top_rows',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.stored_bytes DESC),'[]'::jsonb)
    FROM (
      SELECT workspace_id,lib_id,stored_bytes,text_bytes,
        count(*) AS matched_images,
        sum(image_chars) AS matched_image_chars
      FROM matches
      GROUP BY workspace_id,lib_id,stored_bytes,text_bytes
      ORDER BY stored_bytes DESC
      LIMIT 30
    ) x)
) AS estimate;

COMMIT;
