-- READ ONLY. Metadata only: no board payloads, session tokens or user records.
SELECT current_user AS applying_role,current_setting('server_version') AS server_version;
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('ps_kv','ps_kv_history','ps_workspaces','ps_members');
SELECT has_table_privilege('anon','public.ps_kv_history','SELECT') AS anonymous_history_select,
 has_table_privilege('authenticated','public.ps_kv_history','SELECT') AS authenticated_history_select;
SELECT p.polname,p.polroles::regrole[],pg_get_expr(p.polqual,p.polrelid) AS using_expression
FROM pg_policy p WHERE p.polrelid=to_regclass('public.ps_kv_history');
SELECT schemaname,viewname,definition FROM pg_views
WHERE schemaname='public' AND definition ILIKE '%ps_kv%';
SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('ps_kv','ps_workspaces','ps_members') AND a.attnum>0 AND NOT a.attisdropped
ORDER BY c.relname,a.attnum;
SELECT p.polname,p.polpermissive,p.polcmd,p.polroles::regrole[],pg_get_expr(p.polqual,p.polrelid) AS using_expression,
 pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
FROM pg_policy p WHERE p.polrelid=to_regclass('public.ps_kv') ORDER BY p.polname;
SELECT r.rolname,r.rolsuper,r.rolbypassrls FROM pg_roles r
WHERE r.rolname IN ('anon','authenticated','service_role',current_user);
-- Existing definer RPCs may bypass RLS. Review any generic writer and the role
-- granted EXECUTE; this inventory is not itself proof that those RPCs are safe.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_get_userbyid(p.proowner) AS owner,p.proacl,p.proconfig,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef AND (p.prosrc ILIKE '%ps_kv%' OR p.proname='ps_private_board_owner_v1')
ORDER BY p.proname;
SELECT tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger
WHERE tgrelid=to_regclass('public.ps_kv') AND NOT tgisinternal ORDER BY tgname;
