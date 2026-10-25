DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='public.ps_library_history'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid='public.ps_library'::regclass AND tgname='ps_library_recovery_capture' AND NOT tgisinternal)
 OR has_table_privilege('authenticated','public.ps_library_history','INSERT')
 OR has_table_privilege('authenticated','public.ps_library_history','UPDATE')
 OR has_table_privilege('authenticated','public.ps_library_history','DELETE')
 OR has_table_privilege('anon','public.ps_library_history','SELECT')
 OR has_table_privilege('authenticated','public.ps_library_restore_requests','SELECT') THEN
  RAISE EXCEPTION 'library recovery: reviewed history boundary differs' USING ERRCODE='55000';
 END IF;
 IF NOT has_function_privilege('authenticated','public.ps_library_restore_copy_v1(uuid,bigint,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.ps_library_restore_copy_v1(uuid,bigint,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'library recovery: reviewed RPC grants differ' USING ERRCODE='55000';
 END IF;
END $$;
