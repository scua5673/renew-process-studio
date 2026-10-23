-- Read-only verification. It does not create a report or inspect image contents.
DO $$
DECLARE signature text; p record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.ps_support_images'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'image RLS missing'; END IF;
 IF has_table_privilege('anon','public.ps_support_images','SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated','public.ps_support_images','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'direct image table access'; END IF;
 FOREACH signature IN ARRAY ARRAY['public.ps_support_image_info(bytea)','public.ps_support_create_image(uuid,text,text,jsonb,text)','public.ps_support_get_with_image(uuid)','public.ps_support_image_get(uuid)'] LOOP
   SELECT * INTO p FROM pg_proc WHERE oid=signature::regprocedure;
   IF NOT p.prosecdef OR NOT coalesce('search_path=pg_catalog'=ANY(p.proconfig),false) OR obj_description(p.oid,'pg_proc') IS DISTINCT FROM 'process-studio/support-images/20261023/v1' THEN RAISE EXCEPTION 'unsafe image function %',signature; END IF;
   IF has_function_privilege('anon',signature,'EXECUTE') THEN RAISE EXCEPTION 'anonymous image RPC %',signature; END IF;
   IF signature='public.ps_support_image_info(bytea)' THEN
     IF has_function_privilege('authenticated',signature,'EXECUTE') THEN RAISE EXCEPTION 'internal image helper exposed'; END IF;
   ELSIF NOT has_function_privilege('authenticated',signature,'EXECUTE') THEN RAISE EXCEPTION 'authenticated image RPC missing %',signature;
   END IF;
 END LOOP;
END $$;
SELECT 'support-images-v1-ready' AS result;
