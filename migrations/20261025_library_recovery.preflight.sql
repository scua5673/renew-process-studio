-- Read-only catalog inspection. No production credentials belong in this file.
SELECT current_database(),current_user;
SELECT to_regclass('public.ps_library') AS library,to_regclass('public.ps_blob') AS blobs,
 to_regclass('public.ps_library_history') AS history,to_regprocedure('public.ps_is_member(uuid)') AS membership;
SELECT column_name,data_type,is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('ps_library','ps_blob') ORDER BY table_name,ordinal_position;
SELECT tgname,pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.ps_library'::regclass AND NOT tgisinternal;
SELECT polname,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)
 FROM pg_policy WHERE polrelid='public.ps_library'::regclass;
