-- Read-only. Does not return reports or user data.
BEGIN READ ONLY;
DO $verify$
DECLARE target oid:=to_regclass('public.ps_shared_views');x record;put_definition text;
BEGIN
  IF target IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=target AND relkind='r' AND relrowsecurity
    AND pg_catalog.obj_description(oid,'pg_class')='process-studio/shared-views/20260913/v1') THEN RAISE EXCEPTION 'shared views verification: marked RLS table missing'; END IF;
  IF has_table_privilege('anon',target,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('authenticated',target,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'shared views verification: direct table access exposed';
  END IF;
  IF to_regprocedure('public.ps_shared_view_put(uuid,uuid,text)') IS NULL OR to_regprocedure('public.ps_admin_shared_views_list(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'shared views verification: RPC missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_team_role(uuid)') AND prorettype='text'::regtype) THEN
    RAISE EXCEPTION 'shared views verification: team-role helper contract missing'; END IF;
  put_definition:=pg_catalog.pg_get_functiondef('public.ps_shared_view_put(uuid,uuid,text)'::regprocedure);
  -- Detect the older installed RPC. Behavioral role checks belong to the isolated local test.
  IF position('public.ps_is_member(p_workspace_id) IS NOT TRUE' IN put_definition)=0
    OR position('(public.ps_team_role(p_workspace_id) IN (''admin'',''executive'',''staff'')) IS NOT TRUE' IN put_definition)=0 THEN
    RAISE EXCEPTION 'shared views verification: current membership and coach-role guards missing'; END IF;
  FOR x IN SELECT oid,prosecdef,proconfig FROM pg_catalog.pg_proc WHERE oid IN
    ('public.ps_shared_view_put(uuid,uuid,text)'::regprocedure,'public.ps_admin_shared_views_list(uuid,uuid)'::regprocedure) LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM 'process-studio/shared-views/20260913/v1'
      OR NOT x.prosecdef OR NOT('search_path=pg_catalog'=ANY(x.proconfig))
      OR has_function_privilege('anon',x.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',x.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'shared views verification: RPC access/config mismatch';
    END IF;
  END LOOP;
END $verify$;
SELECT 'shared_views_schema_and_grants_ok' AS verification;
COMMIT;
