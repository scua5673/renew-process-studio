-- Disable only these new RPCs. Keep the table, reports and functions.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214091302);
DO $rollback$
DECLARE x record;
BEGIN
  FOR x IN SELECT c.oid,c.oid::regclass AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='ps_shared_views' LOOP
    IF pg_catalog.obj_description(x.oid,'pg_class') IS DISTINCT FROM 'process-studio/shared-views/20260913/v1' THEN RAISE EXCEPTION 'shared views rollback: table marker differs'; END IF;
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC,anon,authenticated',x.name);
  END LOOP;
  FOR x IN SELECT p.oid,p.oid::regprocedure AS name FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('ps_shared_view_put','ps_admin_shared_views_list') LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM 'process-studio/shared-views/20260913/v1' THEN RAISE EXCEPTION 'shared views rollback: function marker differs'; END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.name);
  END LOOP;
END $rollback$;
COMMIT;
