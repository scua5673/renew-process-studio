-- Disable only this feature's RPC access. Retain reports, replies and tables.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214091501);
DO $rollback$
DECLARE x record; marker constant text:='process-studio/support-reports/20260915/v1';
BEGIN
  FOR x IN SELECT c.oid,c.oid::regclass AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('ps_support_reports','ps_support_replies') LOOP
    IF pg_catalog.obj_description(x.oid,'pg_class') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'support rollback: table ownership differs'; END IF;
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC,anon,authenticated',x.name);
  END LOOP;
  FOR x IN SELECT p.oid,p.oid::regprocedure AS name FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND left(p.proname,11)='ps_support_' LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'support rollback: function ownership differs'; END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.name);
  END LOOP;
END $rollback$;
NOTIFY pgrst,'reload schema';
COMMIT;
