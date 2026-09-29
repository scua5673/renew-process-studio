-- LOCAL IN-MEMORY FIXTURE ONLY. NEVER run this file against an existing database.
-- 20260930 role_default_player · idp_pub_write 시험용. 세 함수는 운영 정의 원문(2026-09-30 적용 직전), 정책은 저장소 SQL 모양을 재현한다.
-- 가드는 판정 뼈대만(일정·권한표 분기 없음) — 운영 트리거 전체를 복제했다고 주장하지 않는다.
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

CREATE TABLE public.ps_kv_denied (
  workspace_id uuid NOT NULL, user_id uuid NOT NULL, k text NOT NULL, reason text, at timestamptz DEFAULT now(),
  PRIMARY KEY(workspace_id,user_id,k)
);
CREATE FUNCTION public.ps_is_member(wid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.ps_members m WHERE m.workspace_id=wid AND m.user_id=auth.uid())
$$;
CREATE FUNCTION public.ps_is_owner(wid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.ps_members m
    WHERE m.workspace_id=wid AND m.user_id=auth.uid() AND m.role='owner')
$$;
-- 운영 정의 원문(2026-09-30 적용 직전 pg_get_functiondef)
CREATE FUNCTION public.ps_team_role(wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pj jsonb; knd text;
begin
 if auth.uid() is null then return 'none'; end if;
 select kind into knd from public.ps_workspaces where id = wid;
 if knd is null or knd = 'personal' then return 'admin'; end if;
 if public.ps_is_owner(wid) then return 'admin'; end if;
 begin
 select v::jsonb into pj from public.ps_kv where workspace_id = wid and k = 'cs_perms_v1' limit 1;
 exception when others then pj := null; end;
 if pj is null then return 'admin'; end if;
 return coalesce(pj->'members'->(auth.uid()::text)->>'role', pj->>'defaultRole', 'staff');
end $function$;
-- 운영 정의 원문(2026-09-30 적용 직전)
CREATE FUNCTION public.ps_idp_can_view(wid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pj jsonb; r text;
begin
 if public.ps_is_owner(wid) then return true; end if;
 begin
 select v::jsonb into pj from public.ps_kv where workspace_id = wid and k = 'cs_perms_v1' limit 1;
 exception when others then pj := null; end;
 if pj is null then return true; end if;
 r := coalesce(pj->'members'->(auth.uid()::text)->>'role', pj->>'defaultRole', 'staff');
 return r <> 'player';
end $function$;
CREATE FUNCTION public.ps_key_scope(key text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN key IN ('scout_tool_v1','cs_idp_pub_v1','cs_team_notice_v1') THEN 'team'
              WHEN key='cs_scout_targets_v1' THEN 'scout' ELSE 'board' END
$$;
-- 운영 정의 원문(2026-09-30 적용 직전) — ⚠ 개별 구역이 없는 스태프는 쓰기 허용(«보기 전용»은 앱에서만 지킨다)
CREATE FUNCTION public.ps_can_write_key(wid uuid, key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pj jsonb; r text; sc text; scl jsonb;
begin
 if not public.ps_is_member(wid) then return false; end if;
 r := public.ps_team_role(wid);
 if r = 'admin' or r = 'executive' then return true; end if;
 if key = 'cs_perms_v1' then return false; end if;
 sc := public.ps_key_scope(key);
 if sc is null then return true; end if;
 begin
 select v::jsonb into pj from public.ps_kv where workspace_id = wid and k = 'cs_perms_v1' limit 1;
 exception when others then pj := null; end;
 scl := pj->'members'->(auth.uid()::text)->'scopes';
 if scl is not null and jsonb_typeof(scl) = 'array' then return scl ? sc; end if;
 if r = 'staff' then return true; end if;
 return false;
end $function$;
CREATE FUNCTION public.ps_can_read_key(wid uuid,key text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  IF NOT public.ps_is_member(wid) THEN RETURN false; END IF;
  IF key='cs_scout_targets_v1' THEN RETURN public.ps_team_role(wid) IN ('executive','admin'); END IF;
  IF key NOT LIKE 'sq:%' AND key NOT IN ('scout_tool_v1','cs_squad_v1','cs_meet_sit_v1','cs_match_v1','cs_match_roster_v1') THEN RETURN true; END IF;
  RETURN public.ps_team_role(wid)<>'player' OR public.ps_can_write_key(wid,key);
END
$$;
-- 쓰기 가드 트리거의 판정 뼈대(supabase-staff-readonly.sql ps_kv_team_guard: 소유자 통과 · ③ 개인 IDP · ④ 나머지 = ps_can_write_key · 거부면 되돌림)
CREATE FUNCTION public.ps_kv_team_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid := auth.uid(); allowed boolean;
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.ps_workspaces w WHERE w.id=NEW.workspace_id AND w.owner_id=uid) THEN RETURN NEW; END IF;
  IF NEW.k LIKE 'cs\_idp\_v1\_%' THEN allowed := (NEW.k = 'cs_idp_v1_' || uid::text);
  ELSE allowed := public.ps_can_write_key(NEW.workspace_id, NEW.k); END IF;
  IF allowed THEN RETURN NEW; END IF;
  INSERT INTO public.ps_kv_denied(workspace_id,user_id,k,reason) VALUES(NEW.workspace_id,uid,NEW.k,'fixture guard')
    ON CONFLICT (workspace_id,user_id,k) DO UPDATE SET at=now();
  IF TG_OP='UPDATE' THEN NEW.v := OLD.v; NEW.cupd := OLD.cupd; RETURN NEW; END IF;
  RETURN NULL;
END
$$;
CREATE TRIGGER ps_kv_team_guard_t BEFORE INSERT OR UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.ps_kv_team_guard();
GRANT EXECUTE ON FUNCTION public.ps_is_member(uuid),public.ps_is_owner(uuid),public.ps_team_role(uuid),public.ps_idp_can_view(uuid),
  public.ps_key_scope(text),public.ps_can_write_key(uuid,text),public.ps_can_read_key(uuid,text) TO authenticated;
CREATE POLICY kv_sel_nonidp ON public.ps_kv FOR SELECT TO PUBLIC
  USING ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_read_key(workspace_id,k));
CREATE POLICY kv_ins_nonidp ON public.ps_kv FOR INSERT TO PUBLIC
  WITH CHECK ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_write_key(workspace_id,k));
CREATE POLICY kv_upd_nonidp ON public.ps_kv FOR UPDATE TO PUBLIC
  USING ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_write_key(workspace_id,k))
  WITH CHECK ((k NOT LIKE 'cs\_idp\_v1\_%') AND (k NOT LIKE 'cs\_idp\_pub\_v1\_%') AND ps_can_write_key(workspace_id,k));
CREATE POLICY kv_sel_idp ON public.ps_kv FOR SELECT TO PUBLIC
  USING (ps_is_member(workspace_id) AND k LIKE 'cs\_idp\_v1\_%' AND (k = 'cs_idp_v1_' || auth.uid()::text OR ps_idp_can_view(workspace_id)));
CREATE POLICY kv_ins_idp ON public.ps_kv FOR INSERT TO PUBLIC
  WITH CHECK (ps_is_member(workspace_id) AND k = 'cs_idp_v1_' || auth.uid()::text);
CREATE POLICY kv_upd_idp ON public.ps_kv FOR UPDATE TO PUBLIC
  USING (ps_is_member(workspace_id) AND k = 'cs_idp_v1_' || auth.uid()::text) WITH CHECK (k = 'cs_idp_v1_' || auth.uid()::text);
CREATE POLICY kv_sel_pub ON public.ps_kv FOR SELECT TO PUBLIC
  USING (ps_is_member(workspace_id) AND k LIKE 'cs\_idp\_pub\_v1\_%' AND (k = 'cs_idp_pub_v1_' || auth.uid()::text OR ps_idp_can_view(workspace_id)));
CREATE POLICY kv_ins_pub ON public.ps_kv FOR INSERT TO PUBLIC
  WITH CHECK (ps_is_member(workspace_id) AND k LIKE 'cs\_idp\_pub\_v1\_%' AND ps_idp_can_view(workspace_id));
CREATE POLICY kv_upd_pub ON public.ps_kv FOR UPDATE TO PUBLIC
  USING (ps_is_member(workspace_id) AND k LIKE 'cs\_idp\_pub\_v1\_%' AND ps_idp_can_view(workspace_id))
  WITH CHECK (ps_is_member(workspace_id) AND k LIKE 'cs\_idp\_pub\_v1\_%' AND ps_idp_can_view(workspace_id));
