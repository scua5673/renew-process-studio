-- Read-only preflight; run as the database administrator.
DO $$
BEGIN
 IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'database administrator required'; END IF;
 IF to_regprocedure('public.ps_support_get(uuid)') IS NULL OR to_regprocedure('public.ps_support_create(uuid,text,text,jsonb)') IS NULL OR to_regclass('public.ps_support_reports') IS NULL THEN RAISE EXCEPTION 'install support reports first'; END IF;
 IF to_regclass('public.ps_support_images') IS NOT NULL AND obj_description(to_regclass('public.ps_support_images'),'pg_class') IS DISTINCT FROM 'process-studio/support-images/20261023/v1' THEN RAISE EXCEPTION 'foreign support image table'; END IF;
END $$;
