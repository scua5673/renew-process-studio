-- Read-only catalog report. Does not return user rows, authentication tokens,
-- notes, document contents, or existing application payloads.
BEGIN READ ONLY;
SELECT p.oid::regprocedure::text AS function_name,t.typname AS result_type,p.prosecdef,p.proconfig
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_type t ON t.oid=p.prorettype
  WHERE p.oid IN (to_regprocedure('auth.uid()'),to_regprocedure('public.ps_is_admin()'),to_regprocedure('public.ps_is_member(uuid)'));
SELECT n.nspname AS schema_name,c.relname,a.attname,t.typname,c.relkind,c.relrowsecurity
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND NOT a.attisdropped AND a.attnum>0
  JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
  WHERE (n.nspname='auth' AND c.relname='users' AND a.attname='id')
     OR (n.nspname='public' AND c.relname='ps_workspaces' AND a.attname='id')
     OR (n.nspname='public' AND c.relname='ps_members' AND a.attname IN ('user_id','workspace_id'));
SELECT rolname,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated');
SELECT n.nspname,c.relname,c.relkind,pg_catalog.obj_description(c.oid,'pg_class') AS marker
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('ps_admin_followups','ps_admin_followup_changes','ps_sync_reports');
COMMIT;
