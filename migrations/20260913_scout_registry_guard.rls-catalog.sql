-- READ ONLY. Required catalog before building/running the synthetic RLS fixture.
-- No user/team row values, API keys or authentication tokens are selected.
-- If an external-call risk is flagged below, do NOT insert synthetic auth/users
-- until its complete trigger call chain has been reviewed. ROLLBACK cannot undo
-- all network/webhook side effects. Do not disable those triggers for this test.

SELECT n.nspname AS table_schema, c.relname AS table_name, c.relkind,
       c.relrowsecurity, c.relforcerowsecurity, c.relowner::regrole::text AS owner,
       a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS column_type,
       a.attnotnull AS not_null, a.attidentity AS identity_mode, a.attgenerated AS generated_mode,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS column_default
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE c.oid IN (to_regclass('auth.users'), to_regclass('public.ps_workspaces'),
                to_regclass('public.ps_members'), to_regclass('public.ps_kv'))
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY n.nspname, c.relname, a.attnum;

SELECT conrelid::regclass::text AS table_name, conname, contype,
       pg_catalog.pg_get_constraintdef(oid, true) AS definition
FROM pg_catalog.pg_constraint
WHERE conrelid IN (to_regclass('auth.users'), to_regclass('public.ps_workspaces'),
                    to_regclass('public.ps_members'), to_regclass('public.ps_kv'))
ORDER BY conrelid::regclass::text, conname;

SELECT n.nspname AS function_schema, p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.proconfig,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname IN (
  'ps_is_member', 'ps_team_role', 'ps_key_scope', 'ps_can_read_key', 'ps_can_write_key'))
  OR (n.nspname = 'auth' AND p.proname IN ('uid','role','jwt'))
ORDER BY p.proname, arguments;

-- Risk classification is conservative; a false result does NOT prove all nested
-- functions are safe. Only inspect function source after reviewing these names.
SELECT t.tgrelid::regclass::text AS table_name, t.tgname, t.tgenabled,
       pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_definition,
       n.nspname AS function_schema, p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.prosrc ~* '(\mnet\M\s*\.|\mhttp\w*\s*\(|\mdblink\w*\s*\(|webhook|send.?mail|send.?email|pg_notify|\mcron\M\s*\.|\mpgmq\M\s*\.)' AS external_call_review_required
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE t.tgrelid IN (to_regclass('auth.users'), to_regclass('public.ps_workspaces'),
                     to_regclass('public.ps_members'), to_regclass('public.ps_kv'))
  AND NOT t.tgisinternal
ORDER BY t.tgrelid::regclass::text, t.tgname COLLATE "C";

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'ps_kv'
ORDER BY policyname;

SELECT rolname, rolsuper, rolbypassrls, rolinherit FROM pg_catalog.pg_roles
WHERE rolname IN (current_user, 'authenticated');

SELECT has_schema_privilege('authenticated','public','USAGE') AS public_schema_usage,
       has_table_privilege('authenticated','public.ps_kv','SELECT') AS kv_select,
       has_table_privilege('authenticated','public.ps_kv','INSERT') AS kv_insert,
       has_table_privilege('authenticated','public.ps_kv','UPDATE') AS kv_update,
       has_table_privilege('authenticated','public.ps_kv','DELETE') AS kv_delete;
