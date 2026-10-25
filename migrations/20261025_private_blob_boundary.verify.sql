-- READ ONLY metadata and synthetic literals; never reads user content.
DO $$
DECLARE r record;
BEGIN
 SELECT * INTO r FROM pg_roles WHERE rolname='ps_blob_reader_v1';
 IF NOT FOUND OR r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreaterole
 OR NOT pg_has_role('ps_blob_reader_v1','authenticated','USAGE')
 OR pg_has_role('authenticated','ps_blob_reader_v1','MEMBER')
 OR has_schema_privilege('ps_blob_reader_v1','public','CREATE') THEN
  RAISE EXCEPTION 'Blob reader role differs' USING ERRCODE='55000';
 END IF;
 SELECT * INTO r FROM pg_proc WHERE oid=to_regprocedure('public.ps_blob_can_read_v1(uuid,text)');
 IF NOT FOUND OR NOT r.prosecdef OR r.provolatile<>'s' OR r.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR pg_get_userbyid(r.proowner)<>'ps_blob_reader_v1'
 OR has_function_privilege('anon',r.oid,'EXECUTE') THEN RAISE EXCEPTION 'Blob reader function differs' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT FROM pg_class WHERE oid IN ('public.ps_blob_refs_v1'::regclass,'public.ps_blob_upload_proof_v1'::regclass,'public.ps_blob'::regclass) AND NOT relrowsecurity)
 OR has_table_privilege('authenticated','public.ps_blob_refs_v1','INSERT')
 OR has_table_privilege('authenticated','public.ps_blob_upload_proof_v1','SELECT')
 OR has_table_privilege('authenticated','public.ps_blob_upload_proof_v1','INSERT')
 OR has_function_privilege('authenticated','public.ps_blob_stage_v1(uuid,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Blob derived-table privacy differs' USING ERRCODE='55000';END IF;
 IF NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.ps_blob'::regclass AND polname='ps_blob_parent_read_v1' AND NOT polpermissive AND polcmd='r')
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.ps_blob'::regclass AND polname='ps_blob_uploader_v1' AND NOT polpermissive AND polcmd='a') THEN RAISE EXCEPTION 'Blob restrictive policies differ' USING ERRCODE='55000';END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('ps_blob_stage_before_insert_v1','ps_blob_refs_before_kv_v1','ps_blob_refs_before_library_v1','ps_blob_refs_after_kv_v1','ps_blob_refs_after_library_v1','ps_blob_refs_after_history_v1','ps_blob_refs_after_library_history_v1'))<>7 THEN
  RAISE EXCEPTION 'Blob source triggers differ' USING ERRCODE='55000';
 END IF;
 IF (SELECT array_agg(h ORDER BY h) FROM public.ps_blob_refs_json_v1('{"nested":[{"photo":"psblob:aaaaaaaaaaaaaaaa","emblemRef":"bbbbbbbbbbbbbbbb"}],"note":"prefix psblob:cccccccccccccccc suffix"}'::jsonb) h)
 IS DISTINCT FROM ARRAY['aaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbb']::text[] THEN RAISE EXCEPTION 'Blob reference parser differs' USING ERRCODE='55000';END IF;
END $$;
SELECT 'privacy-blob-boundary/20261025/v1 verified' AS result;
