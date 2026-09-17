-- Metadata/catalog only. No names, email addresses, IDs, or content bodies.
BEGIN READ ONLY;
SELECT c.table_schema,c.table_name,c.column_name,c.udt_name
FROM information_schema.columns c
WHERE (c.table_schema='public' AND c.table_name IN('ps_library','ps_members','ps_workspaces')
  AND c.column_name IN('id','workspace_id','lib_id','owner_id','deleted_at','user_id','name'))
  OR(c.table_schema='auth' AND c.table_name='users' AND c.column_name IN('id','email','raw_user_meta_data'));
SELECT p.oid::regprocedure::text AS function_name,pg_get_functiondef(p.oid) AS definition,proacl::text AS privileges
FROM pg_catalog.pg_proc p WHERE p.oid IN(to_regprocedure('public.ps_admin_library(uuid,boolean)'),
  to_regprocedure('public.ps_is_admin()'),to_regprocedure('public.ps_admin_content_owners(uuid,boolean)'));
SELECT jsonb_build_object('library_rows',count(*),'missing_owner_id',count(*) FILTER(WHERE l.owner_id IS NULL),
  'owner_user_missing',count(*) FILTER(WHERE l.owner_id IS NOT NULL AND u.id IS NULL),
  'owner_email_missing',count(*) FILTER(WHERE nullif(btrim(u.email),'') IS NULL)) AS summary
FROM public.ps_library l LEFT JOIN auth.users u ON u.id=l.owner_id;
COMMIT;
