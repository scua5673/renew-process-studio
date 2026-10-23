-- Remove the new API only. Keep reports and image bytes for safe reinstallation.
BEGIN;
DO $$
DECLARE signature text;
BEGIN
 IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'database administrator required'; END IF;
 FOREACH signature IN ARRAY ARRAY['public.ps_support_image_info(bytea)','public.ps_support_create_image(uuid,text,text,jsonb,text)','public.ps_support_get_with_image(uuid)','public.ps_support_image_get(uuid)'] LOOP
   IF to_regprocedure(signature) IS NOT NULL AND obj_description(to_regprocedure(signature),'pg_proc') IS DISTINCT FROM 'process-studio/support-images/20261023/v1' THEN RAISE EXCEPTION 'foreign image function %',signature; END IF;
 END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.ps_support_create_image(uuid,text,text,jsonb,text);
DROP FUNCTION IF EXISTS public.ps_support_get_with_image(uuid);
DROP FUNCTION IF EXISTS public.ps_support_image_get(uuid);
DROP FUNCTION IF EXISTS public.ps_support_image_info(bytea);
NOTIFY pgrst,'reload schema';
COMMIT;
