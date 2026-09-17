-- Admin-only content authors. Reads metadata only; never rewrites content,
-- author IDs, the existing library RPC, application grants, or RLS policies.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214091701);
DO $preflight$
DECLARE x record; marker constant text:='process-studio/admin-content-owners/20260917/v1';
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'database administrator required'; END IF;
  IF NOT EXISTS(SELECT FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('auth.uid()') AND prorettype='uuid'::regtype)
    OR NOT EXISTS(SELECT FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_is_admin()') AND prorettype='boolean'::regtype)
    OR to_regprocedure('public.ps_admin_library(uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'catalog-confirmed existing admin/library helpers required';
  END IF;
  FOR x IN SELECT * FROM (VALUES
    ('public.ps_library','workspace_id','uuid'),('public.ps_library','lib_id','text'),
    ('public.ps_library','owner_id','uuid'),('public.ps_library','deleted_at','bigint'),
    ('public.ps_workspaces','id','uuid'),('public.ps_members','workspace_id','uuid'),
    ('public.ps_members','user_id','uuid'),('public.ps_members','name','text'),
    ('auth.users','id','uuid'),('auth.users','email','character varying'),
    ('auth.users','raw_user_meta_data','jsonb')) c(relation_name,column_name,type_name) LOOP
    IF NOT EXISTS(SELECT FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass(x.relation_name)
      AND attname=x.column_name AND atttypid=to_regtype(x.type_name) AND NOT attisdropped) THEN
      RAISE EXCEPTION 'unexpected content owner schema: %.%',x.relation_name,x.column_name;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname='authenticated' AND NOT rolsuper AND NOT rolbypassrls)
    OR NOT EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname='anon' AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'expected client roles required';
  END IF;
  FOR x IN SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='ps_admin_content_owners' LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker
      OR x.oid<>to_regprocedure('public.ps_admin_content_owners(uuid,boolean)') THEN
      RAISE EXCEPTION 'content owner function name belongs to another migration';
    END IF;
  END LOOP;
END $preflight$;

CREATE OR REPLACE FUNCTION public.ps_admin_content_owners(p_wid uuid DEFAULT NULL,p_include_deleted boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.ps_is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='admin_required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'workspace_id',l.workspace_id,'lib_id',l.lib_id,'owner_id',l.owner_id,
    'owner_name',coalesce(m.owner_name,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'name'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'full_name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'full_name'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'nickname')='string' THEN nullif(btrim(u.raw_user_meta_data->>'nickname'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'display_name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'display_name'),'') END),
    'owner_email',nullif(btrim(u.email),'')
  ) ORDER BY l.workspace_id,l.lib_id),'[]'::jsonb) INTO result
  FROM public.ps_library l
  JOIN public.ps_workspaces w ON w.id=l.workspace_id
  LEFT JOIN auth.users u ON u.id=l.owner_id
  LEFT JOIN LATERAL (
    SELECT min(nullif(btrim(member.name),'')) AS owner_name
    FROM public.ps_members member
    WHERE member.workspace_id=l.workspace_id AND member.user_id=l.owner_id
  ) m ON true
  WHERE (p_wid IS NULL OR l.workspace_id=p_wid)
    AND (coalesce(p_include_deleted,false) OR l.deleted_at IS NULL);
  RETURN result;
END $function$;

COMMENT ON FUNCTION public.ps_admin_content_owners(uuid,boolean) IS 'process-studio/admin-content-owners/20260917/v1';
REVOKE ALL ON FUNCTION public.ps_admin_content_owners(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_content_owners(uuid,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
