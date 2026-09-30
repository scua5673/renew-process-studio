-- Catalog checks only. No auth impersonation, no row reads or writes.
BEGIN READ ONLY;
DO $verify$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_admin_people()');
  IF NOT FOUND OR NOT f.prosecdef OR f.provolatile<>'s' OR f.prorettype<>'jsonb'::regtype
    OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
    OR pg_catalog.obj_description(f.oid,'pg_proc') IS DISTINCT FROM 'process-studio/admin-people/20260930/v1' THEN
    RAISE EXCEPTION 'unexpected admin people function';
  END IF;
  IF has_function_privilege('anon',f.oid,'EXECUTE')
    OR NOT has_function_privilege('authenticated',f.oid,'EXECUTE')
    OR EXISTS(SELECT FROM aclexplode(f.proacl) WHERE grantee=0 AND privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'unexpected admin people function privileges';
  END IF;
  BEGIN
    PERFORM public.ps_admin_people();
    RAISE EXCEPTION 'missing JWT subject unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $verify$;
SELECT 'admin_people_verified' AS result;
COMMIT;
