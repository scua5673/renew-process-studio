-- Read-only security verification. Does not read report or reply contents.
BEGIN READ ONLY;
DO $verify$
DECLARE x record; n integer; marker constant text:='process-studio/support-reports/20260915/v1';
  api text[]:=ARRAY['ps_support_list','ps_support_get','ps_support_create','ps_support_reply'];
BEGIN
  SELECT count(*) INTO n FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname IN ('ps_support_reports','ps_support_replies') AND c.relkind='r'
    AND c.relrowsecurity AND pg_catalog.obj_description(c.oid,'pg_class')=marker;
  IF n<>2 THEN RAISE EXCEPTION 'support verification: two marked RLS tables required'; END IF;
  FOR x IN SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname IN ('ps_support_reports','ps_support_replies') LOOP
    IF has_table_privilege('anon',x.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_table_privilege('authenticated',x.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'support verification: direct table access exposed';
    END IF;
  END LOOP;
  FOR x IN SELECT p.oid,p.proname,p.prosecdef,p.proconfig FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND left(p.proname,11)='ps_support_' LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker OR has_function_privilege('anon',x.oid,'EXECUTE')
      OR ('search_path=pg_catalog'=ANY(x.proconfig)) IS NOT TRUE THEN RAISE EXCEPTION 'support verification: function security mismatch'; END IF;
    IF x.proname=ANY(api) THEN
      IF NOT x.prosecdef OR NOT has_function_privilege('authenticated',x.oid,'EXECUTE') THEN RAISE EXCEPTION 'support verification: API not secured'; END IF;
    ELSIF has_function_privilege('authenticated',x.oid,'EXECUTE') THEN RAISE EXCEPTION 'support verification: internal helper exposed'; END IF;
  END LOOP;
  IF to_regprocedure('public.ps_support_list(integer,jsonb)') IS NULL OR to_regprocedure('public.ps_support_get(uuid)') IS NULL
    OR to_regprocedure('public.ps_support_create(uuid,text,text,jsonb)') IS NULL OR to_regprocedure('public.ps_support_reply(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'support verification: missing API';
  END IF;
END $verify$;
SELECT 'support_reports_security_ok' AS verification;
COMMIT;
