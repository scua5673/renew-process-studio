-- READ ONLY installation checks. No user rows are returned.
BEGIN READ ONLY;
DO $verify$
DECLARE x record; n integer; marker constant text:='process-studio/admin-operations/20260913/v1';
BEGIN
  SELECT count(*) INTO n FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname IN ('ps_admin_followups','ps_admin_followup_changes','ps_sync_reports')
      AND c.relkind='r' AND c.relrowsecurity AND pg_catalog.obj_description(c.oid,'pg_class')=marker;
  IF n<>3 THEN RAISE EXCEPTION 'admin operations verification: expected three marked RLS tables'; END IF;
  FOR x IN SELECT c.oid,c.oid::regclass AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname IN ('ps_admin_followups','ps_admin_followup_changes','ps_sync_reports') LOOP
    IF has_table_privilege('anon',x.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_table_privilege('authenticated',x.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'admin operations verification: unexpected direct client table access';
    END IF;
  END LOOP;
  FOR x IN SELECT p.oid,p.proname,p.prosecdef,p.proconfig FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND (left(p.proname,13)='ps_admin_ops_' OR p.proname IN
      ('ps_admin_followups_list','ps_admin_followup_save','ps_admin_sync_reports_list','ps_sync_report_put')) LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker
      OR has_function_privilege('anon',x.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'admin operations verification: function marker/anonymous privilege mismatch';
    END IF;
    IF left(x.proname,13)='ps_admin_ops_' THEN
      IF has_function_privilege('authenticated',x.oid,'EXECUTE') THEN RAISE EXCEPTION 'admin operations verification: internal helper exposed'; END IF;
    ELSE
      IF NOT x.prosecdef OR NOT ('search_path=pg_catalog'=ANY(x.proconfig))
        OR NOT has_function_privilege('authenticated',x.oid,'EXECUTE') THEN
        RAISE EXCEPTION 'admin operations verification: entry point not secured';
      END IF;
    END IF;
  END LOOP;
  IF to_regprocedure('public.ps_admin_followups_list(uuid,uuid)') IS NULL
    OR to_regprocedure('public.ps_admin_followup_save(uuid,integer,jsonb)') IS NULL
    OR to_regprocedure('public.ps_sync_report_put(uuid,uuid,bigint,jsonb)') IS NULL
    OR to_regprocedure('public.ps_admin_sync_reports_list(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'admin operations verification: RPC missing';
  END IF;
END $verify$;
SELECT 'admin_operations_schema_and_grants_ok' AS verification;
COMMIT;
