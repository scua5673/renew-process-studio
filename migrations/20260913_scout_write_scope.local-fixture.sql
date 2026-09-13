-- LOCAL IN-MEMORY FIXTURE ONLY. NEVER run this file against an existing database.
-- The four non-IDP policies and membership/owner/role/read/write helpers below
-- reproduce catalog source read on 2026-09-13. ps_key_scope contains only the
-- two catalog-confirmed keys exercised here; unrelated IDP policies/data and
-- production audit/lineage triggers are deliberately outside this RLS fixture.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim',true),''),
    nullif(current_setting('request.jwt.claims',true),''))::jsonb
$$;
CREATE TABLE public.ps_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  kind text NOT NULL DEFAULT 'team', owner_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.ps_members (
  workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(), email text, role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(), name text, PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE public.ps_kv (
  workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,
  k text NOT NULL, v text NOT NULL, cupd bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  PRIMARY KEY(workspace_id,k)
);
ALTER TABLE public.ps_kv ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_kv TO authenticated;

CREATE FUNCTION public.ps_is_member(wid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.ps_members m WHERE m.workspace_id=wid AND m.user_id=auth.uid())
$$;
CREATE FUNCTION public.ps_is_owner(wid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.ps_members m
    WHERE m.workspace_id=wid AND m.user_id=auth.uid() AND m.role='owner')
$$;
CREATE FUNCTION public.ps_team_role(wid uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
DECLARE pj jsonb; knd text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'none'; END IF;
  SELECT kind INTO knd FROM public.ps_workspaces WHERE id=wid;
  IF knd IS NULL OR knd='personal' THEN RETURN 'admin'; END IF;
  IF public.ps_is_owner(wid) THEN RETURN 'admin'; END IF;
  BEGIN
    SELECT v::jsonb INTO pj FROM public.ps_kv WHERE workspace_id=wid AND k='cs_perms_v1' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN pj:=NULL; END;
  IF pj IS NULL THEN RETURN 'admin'; END IF;
  RETURN coalesce(pj->'members'->(auth.uid()::text)->>'role',pj->>'defaultRole','staff');
END
$$;
CREATE FUNCTION public.ps_key_scope(key text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE key WHEN 'cs_scout_targets_v1' THEN 'scout' WHEN 'cs_team_notice_v1' THEN 'team' ELSE NULL END
$$;
CREATE FUNCTION public.ps_can_write_key(wid uuid,key text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
DECLARE pj jsonb; r text; sc text; scl jsonb;
BEGIN
  IF NOT public.ps_is_member(wid) THEN RETURN false; END IF;
  r:=public.ps_team_role(wid);
  IF r='admin' OR r='executive' THEN RETURN true; END IF;
  IF key='cs_perms_v1' THEN RETURN false; END IF;
  sc:=public.ps_key_scope(key);
  IF sc IS NULL THEN RETURN true; END IF;
  BEGIN
    SELECT v::jsonb INTO pj FROM public.ps_kv WHERE workspace_id=wid AND k='cs_perms_v1' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN pj:=NULL; END;
  scl:=pj->'members'->(auth.uid()::text)->'scopes';
  IF scl IS NOT NULL AND jsonb_typeof(scl)='array' THEN RETURN scl ? sc; END IF;
  IF r='staff' THEN RETURN true; END IF;
  RETURN false;
END
$$;
CREATE FUNCTION public.ps_can_read_key(wid uuid,key text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  IF NOT public.ps_is_member(wid) THEN RETURN false; END IF;
  IF key='cs_scout_targets_v1' THEN RETURN public.ps_team_role(wid) IN ('executive','admin'); END IF;
  IF key NOT LIKE 'sq:%' AND key NOT IN ('scout_tool_v1','cs_squad_v1','cs_meet_sit_v1','cs_match_v1','cs_match_roster_v1') THEN RETURN true; END IF;
  RETURN public.ps_team_role(wid)<>'player' OR public.ps_can_write_key(wid,key);
END
$$;
CREATE POLICY kv_sel_nonidp ON public.ps_kv FOR SELECT TO PUBLIC
  USING ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_read_key(workspace_id,k));
CREATE POLICY kv_ins_nonidp ON public.ps_kv FOR INSERT TO PUBLIC
  WITH CHECK ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_write_key(workspace_id,k));
CREATE POLICY kv_upd_nonidp ON public.ps_kv FOR UPDATE TO PUBLIC
  USING ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_write_key(workspace_id,k))
  WITH CHECK ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_write_key(workspace_id,k));
CREATE POLICY kv_del_nonidp ON public.ps_kv FOR DELETE TO PUBLIC
  USING ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_write_key(workspace_id,k));
