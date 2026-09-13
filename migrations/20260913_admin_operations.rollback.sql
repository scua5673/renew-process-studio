-- Non-destructive rollback: disable new RPCs, retain follow-ups, audit, reports,
-- tables and functions. Reapplying the migration restores RPC access.
-- No DROP/CASCADE or edits to existing application security objects.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214091301);
DO $rollback$
DECLARE x record; marker constant text:='process-studio/admin-operations/20260913/v1';
BEGIN
  FOR x IN SELECT c.oid,c.oid::regclass AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname IN ('ps_admin_followups','ps_admin_followup_changes','ps_sync_reports') LOOP
    IF pg_catalog.obj_description(x.oid,'pg_class') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'admin operations rollback: table ownership marker differs'; END IF;
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC,anon,authenticated',x.name);
  END LOOP;
  FOR x IN SELECT p.oid,p.oid::regprocedure AS name FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND (left(p.proname,13)='ps_admin_ops_' OR p.proname IN
      ('ps_admin_followups_list','ps_admin_followup_save','ps_admin_sync_reports_list','ps_sync_report_put')) LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'admin operations rollback: function ownership marker differs'; END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.name);
  END LOOP;
END $rollback$;
COMMIT;
