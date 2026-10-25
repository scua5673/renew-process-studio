-- READ ONLY aggregate estimates; no document values, hashes, names or user IDs.
-- Run after library_recovery. Does not require the new helper functions.
WITH sources(kind,raw) AS (
 SELECT 'kv',v FROM public.ps_kv
 UNION ALL SELECT 'library',item::text FROM public.ps_library
 UNION ALL SELECT 'kv_history',v FROM public.ps_kv_history
 UNION ALL SELECT 'library_history',snapshot::text FROM public.ps_library_history
)
SELECT kind,count(*) AS rows,count(*) FILTER(WHERE raw ~ 'psblob:[0-9a-f]{16,64}|"(thumb|emblem)Ref"\s*:') AS possible_reference_rows,
 coalesce(sum(length(raw)),0) AS source_chars FROM sources GROUP BY kind ORDER BY kind;
SELECT count(*) AS blob_rows,coalesce(sum(length(v)),0) AS blob_chars,
 count(*) FILTER(WHERE created_by IS NULL) AS legacy_no_creator FROM public.ps_blob;
