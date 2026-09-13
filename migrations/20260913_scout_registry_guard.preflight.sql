-- READ-ONLY catalog inventory. This never selects public.ps_kv row contents.
-- Run and review before applying the migration; missing results are NOT proof
-- that a production feature is installed or safe to enable.
SELECT current_database() AS database_name,
       current_user AS migration_role,
       current_setting('server_version') AS postgres_version,
       current_setting('session_replication_role') AS replication_role;

SELECT n.nspname AS table_schema, c.relname AS table_name, c.relkind,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
       a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS column_type
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
WHERE c.oid = to_regclass('public.ps_kv') AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum;

SELECT t.tgname AS trigger_name, t.tgenabled AS enabled_mode, t.tgisinternal,
       pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_definition,
       pg_catalog.obj_description(t.oid, 'pg_trigger') AS ownership_marker
FROM pg_catalog.pg_trigger t
WHERE t.tgrelid = to_regclass('public.ps_kv')
ORDER BY t.tgname COLLATE "C";

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'ps_kv'
ORDER BY policyname;

-- Discovery only: finding a similarly named function does not prove a trigger
-- is enabled, connected to ps_kv, or enforcing a particular minimum build.
SELECT n.nspname AS function_schema, p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       pg_catalog.obj_description(p.oid, 'pg_proc') AS ownership_marker
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('ps_kv_build_guard', 'ps_scout_registry_guard_v1',
                    'ps_scout_registry_guard_v1_reason', 'ps_scout_registry_guard_v1_array_kept')
ORDER BY n.nspname, p.proname;
