-- Read-only catalog inspection; returns no user/report bodies or credentials.
BEGIN READ ONLY;
SELECT p.oid::regprocedure::text AS name,t.typname AS result_type,p.prosecdef,p.proconfig
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_type t ON t.oid=p.prorettype
  WHERE p.oid IN (to_regprocedure('auth.uid()'),to_regprocedure('public.ps_is_admin()'));
SELECT rolname,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated');
SELECT c.relname,c.relkind,c.relrowsecurity,pg_catalog.obj_description(c.oid,'pg_class') AS marker
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('ps_support_reports','ps_support_replies');
SELECT p.oid::regprocedure::text AS name,pg_catalog.obj_description(p.oid,'pg_proc') AS marker
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND left(p.proname,11)='ps_support_';
COMMIT;
