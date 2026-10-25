-- READ ONLY, catalog only. privacy-blob-boundary.
SELECT current_user,version();
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
FROM pg_class c WHERE c.oid IN (to_regclass('public.ps_blob'),to_regclass('public.ps_kv'),to_regclass('public.ps_library'),to_regclass('public.ps_kv_history'),to_regclass('public.ps_library_history'));
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('ps_blob','ps_kv','ps_library','ps_library_history') ORDER BY tablename,policyname;
SELECT p.proname,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS owner,p.proacl
FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.ps_kv_history_get(uuid,bigint)'),to_regprocedure('public.ps_library_archive_conflict_v1(uuid,text,jsonb)'));
SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN ('authenticated','anon','service_role','ps_blob_reader_v1');
SELECT to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL AS automatic_upload_proof_cleanup;
