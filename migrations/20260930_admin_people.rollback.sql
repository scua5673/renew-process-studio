-- Removes only the function this migration created (marker-checked). No data touched.
BEGIN;
DO $rb$
BEGIN
  IF to_regprocedure('public.ps_admin_people()') IS NOT NULL
    AND pg_catalog.obj_description(to_regprocedure('public.ps_admin_people()'),'pg_proc') IS DISTINCT FROM 'process-studio/admin-people/20260930/v1' THEN
    RAISE EXCEPTION 'ps_admin_people belongs to another migration — not dropping';
  END IF;
END $rb$;
DROP FUNCTION IF EXISTS public.ps_admin_people();
NOTIFY pgrst,'reload schema';
COMMIT;
