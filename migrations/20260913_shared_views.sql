-- Client-reported display of a teammate's player-matches screen only.
-- Not proof that an individual review was read or understood. No content IDs.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214091302);
DO $preflight$
DECLARE x record; marker constant text:='process-studio/shared-views/20260913/v1';
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'shared views: database administrator required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('auth.uid()') AND prorettype='uuid'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_is_admin()') AND prorettype='boolean'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_is_member(uuid)') AND prorettype='boolean'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_team_role(uuid)') AND prorettype='text'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.ps_members') AND attname='user_id' AND NOT attisdropped AND atttypid='uuid'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.ps_members') AND attname='workspace_id' AND NOT attisdropped AND atttypid='uuid'::regtype) THEN
    RAISE EXCEPTION 'shared views: catalog-confirmed auth/admin/member/team-role contracts required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated' AND NOT rolsuper AND NOT rolbypassrls)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN RAISE EXCEPTION 'shared views: expected client roles required'; END IF;
  FOR x IN SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='ps_shared_views' LOOP
    IF pg_catalog.obj_description(x.oid,'pg_class') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'shared views: table name owned by another migration'; END IF;
  END LOOP;
  FOR x IN SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('ps_shared_view_put','ps_admin_shared_views_list') LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'shared views: function name owned by another migration'; END IF;
  END LOOP;
END $preflight$;
CREATE TABLE IF NOT EXISTS public.ps_shared_views(
  user_id uuid NOT NULL, workspace_id uuid NOT NULL, subject_user_id uuid NOT NULL,
  view_kind text NOT NULL CHECK(view_kind='player_matches'),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,workspace_id,subject_user_id,view_kind),
  CHECK(user_id<>subject_user_id)
);
CREATE INDEX IF NOT EXISTS ps_shared_views_subject_received_idx ON public.ps_shared_views(subject_user_id,received_at DESC);
ALTER TABLE public.ps_shared_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ps_shared_views FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.ps_shared_views IS 'process-studio/shared-views/20260913/v1';

CREATE OR REPLACE FUNCTION public.ps_shared_view_put(p_workspace_id uuid,p_subject_user_id uuid,p_view_kind text DEFAULT 'player_matches') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); r public.ps_shared_views%ROWTYPE;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated_actor_required'; END IF;
  IF p_workspace_id IS NULL OR p_subject_user_id IS NULL OR p_view_kind IS DISTINCT FROM 'player_matches' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_shared_view';
  END IF;
  IF actor=p_subject_user_id OR public.ps_is_member(p_workspace_id) IS NOT TRUE
    OR NOT EXISTS(SELECT 1 FROM public.ps_members m WHERE m.workspace_id=p_workspace_id AND m.user_id=p_subject_user_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='different_members_in_same_workspace_required';
  END IF;
  IF (public.ps_team_role(p_workspace_id) IN ('admin','executive','staff')) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='coach_role_required';
  END IF;
  INSERT INTO public.ps_shared_views AS target(user_id,workspace_id,subject_user_id,view_kind)
    VALUES(actor,p_workspace_id,p_subject_user_id,p_view_kind)
    ON CONFLICT(user_id,workspace_id,subject_user_id,view_kind) DO UPDATE SET received_at=clock_timestamp()
    RETURNING * INTO r;
  DELETE FROM public.ps_shared_views t USING (SELECT user_id,workspace_id,subject_user_id,view_kind FROM public.ps_shared_views
    WHERE user_id=actor AND received_at<clock_timestamp()-interval '30 days' ORDER BY received_at LIMIT 100) expired
    WHERE t.user_id=expired.user_id AND t.workspace_id=expired.workspace_id AND t.subject_user_id=expired.subject_user_id
      AND t.view_kind=expired.view_kind AND t.received_at<clock_timestamp()-interval '30 days';
  RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.ps_admin_shared_views_list(p_user_id uuid,p_workspace_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.ps_is_admin() IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='admin_required'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='user_id_required'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.received_at DESC,r.user_id,r.workspace_id,r.subject_user_id),'[]'::jsonb) INTO result
    FROM (SELECT * FROM public.ps_shared_views v
      WHERE (v.user_id=p_user_id OR v.subject_user_id=p_user_id) AND(p_workspace_id IS NULL OR v.workspace_id=p_workspace_id)
        AND v.received_at>=statement_timestamp()-interval '30 days'
      ORDER BY v.received_at DESC,v.user_id,v.workspace_id,v.subject_user_id LIMIT 100) r;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ps_shared_view_put(uuid,uuid,text),public.ps_admin_shared_views_list(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_shared_view_put(uuid,uuid,text),public.ps_admin_shared_views_list(uuid,uuid) TO authenticated;
COMMENT ON FUNCTION public.ps_shared_view_put(uuid,uuid,text) IS 'process-studio/shared-views/20260913/v1';
COMMENT ON FUNCTION public.ps_admin_shared_views_list(uuid,uuid) IS 'process-studio/shared-views/20260913/v1';
COMMIT;
