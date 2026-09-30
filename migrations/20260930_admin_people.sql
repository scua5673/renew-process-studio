-- Admin-only «who is this person». Reads identity metadata only; never returns
-- document contents, never rewrites rows, grants, RLS policies or helpers.
-- 사용자: «관리자 페이지에 사용자에 대해서 누군지 더 잘 볼 수 있게 해줘» (2026-09-30)
--   지금 관리자 사용자 목록(ps_admin_users)은 이메일·가입일뿐이라 카카오 가입자(이메일 없음)는
--   «(이름·이메일 없음)», 활동·오류 목록은 «(이름 없음 · b4df6561)» 로만 보였다.
--   한 사람마다: 이름(팀에 적은 이름 → 로그인 계정 이름), 이메일, 로그인 방식, 소속 팀별 역할,
--   그 팀에서 연결된 선수(이름·등번호·자리), 가입·최근 로그인, 본인이 만든 보관함 항목 수.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214093001);
DO $preflight$
DECLARE x record; marker constant text:='process-studio/admin-people/20260930/v1';
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'database administrator required'; END IF;
  IF NOT EXISTS(SELECT FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('auth.uid()') AND prorettype='uuid'::regtype)
    OR NOT EXISTS(SELECT FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_is_admin()') AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'catalog-confirmed existing admin helpers required';
  END IF;
  FOR x IN SELECT * FROM (VALUES
    ('auth.users','id','uuid'),('auth.users','email','character varying'),
    ('auth.users','raw_user_meta_data','jsonb'),('auth.users','raw_app_meta_data','jsonb'),
    ('auth.users','created_at','timestamp with time zone'),('auth.users','last_sign_in_at','timestamp with time zone'),
    ('public.ps_workspaces','id','uuid'),('public.ps_workspaces','name','text'),('public.ps_workspaces','kind','text'),
    ('public.ps_workspaces','owner_id','uuid'),
    ('public.ps_members','workspace_id','uuid'),('public.ps_members','user_id','uuid'),
    ('public.ps_members','role','text'),('public.ps_members','name','text'),
    ('public.ps_kv','workspace_id','uuid'),('public.ps_kv','k','text'),('public.ps_kv','v','text'),
    ('public.ps_library','owner_id','uuid'),('public.ps_library','deleted_at','bigint')) c(relation_name,column_name,type_name) LOOP
    IF NOT EXISTS(SELECT FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass(x.relation_name)
      AND attname=x.column_name AND atttypid=to_regtype(x.type_name) AND NOT attisdropped) THEN
      RAISE EXCEPTION 'unexpected admin people schema: %.%',x.relation_name,x.column_name;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname='authenticated' AND NOT rolsuper AND NOT rolbypassrls)
    OR NOT EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname='anon' AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'expected client roles required';
  END IF;
  FOR x IN SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='ps_admin_people' LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker
      OR x.oid<>to_regprocedure('public.ps_admin_people()') THEN
      RAISE EXCEPTION 'admin people function name belongs to another migration';
    END IF;
  END LOOP;
END $preflight$;

CREATE OR REPLACE FUNCTION public.ps_admin_people()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $function$
DECLARE
  result jsonb;
  perm_members jsonb:='{}'::jsonb;   -- { workspace_id: members object of cs_perms_v1 }
  players jsonb:='{}'::jsonb;        -- { "workspace_id|player_id": {name,num,pos} }
  roster_need jsonb:='{}'::jsonb;    -- { workspace_id: [player_id...] } still unresolved
  r record; j jsonb; p jsonb; pid text; wkey text; raw text;
BEGIN
  IF auth.uid() IS NULL OR public.ps_is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='admin_required';
  END IF;

  /* 팀 권한 문서(작다). 깨진 문서(예: 문자열 'undefined')는 건너뛴다 — 한 팀 때문에 목록 전체가 죽지 않게. */
  FOR r IN SELECT kv.workspace_id,kv.v FROM public.ps_kv kv WHERE kv.k='cs_perms_v1' LOOP
    BEGIN j:=r.v::jsonb; EXCEPTION WHEN others THEN j:=NULL; END;
    IF j IS NOT NULL AND jsonb_typeof(j)='object' AND jsonb_typeof(j->'members')='object' THEN
      perm_members:=perm_members||jsonb_build_object(r.workspace_id::text,j->'members');
    END IF;
  END LOOP;

  /* 연결된 선수: 항목 키(sq:<선수 id>, 작은 행) 먼저. 없을 때만 그 팀 선수단 문서(scout_tool_v1)를 한 번 읽는다. */
  FOR r IN
    SELECT w.key AS wid,mm.value->>'playerId' AS player_id
    FROM jsonb_each(perm_members) w
    CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(w.value)='object' THEN w.value ELSE '{}'::jsonb END) mm
    WHERE jsonb_typeof(mm.value)='object' AND jsonb_typeof(mm.value->'playerId')='string'
      AND length(btrim(mm.value->>'playerId')) BETWEEN 1 AND 120
  LOOP
    wkey:=r.wid||'|'||r.player_id;
    IF players ? wkey THEN CONTINUE; END IF;
    raw:=NULL;
    SELECT kv.v INTO raw FROM public.ps_kv kv WHERE kv.workspace_id=r.wid::uuid AND kv.k='sq:'||r.player_id;
    j:=NULL;
    IF raw IS NOT NULL THEN BEGIN j:=raw::jsonb; EXCEPTION WHEN others THEN j:=NULL; END; END IF;
    IF j IS NOT NULL AND jsonb_typeof(j)='object' AND jsonb_typeof(j->'name')='string' AND btrim(j->>'name')<>'' THEN
      players:=players||jsonb_build_object(wkey,jsonb_build_object('name',left(btrim(j->>'name'),60),
        'num',CASE WHEN jsonb_typeof(j->'num') IN ('string','number') THEN left(btrim(j->>'num'),8) END,
        'pos',CASE WHEN jsonb_typeof(j->'posId')='string' THEN left(regexp_replace(btrim(j->>'posId'),'^pos_',''),12) END));
    ELSE
      roster_need:=jsonb_set(roster_need,ARRAY[r.wid],coalesce(roster_need->r.wid,'[]'::jsonb)||to_jsonb(r.player_id));
    END IF;
  END LOOP;
  FOR r IN SELECT n.key AS wid,n.value AS ids FROM jsonb_each(roster_need) n LOOP
    raw:=NULL;
    SELECT kv.v INTO raw FROM public.ps_kv kv WHERE kv.workspace_id=r.wid::uuid AND kv.k='scout_tool_v1';
    j:=NULL;
    IF raw IS NOT NULL THEN BEGIN j:=raw::jsonb; EXCEPTION WHEN others THEN j:=NULL; END; END IF;
    IF j IS NULL OR jsonb_typeof(j->'players') IS DISTINCT FROM 'array' THEN CONTINUE; END IF;
    FOR p IN SELECT e FROM jsonb_array_elements(j->'players') e LOOP
      IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'id') IS DISTINCT FROM 'string' THEN CONTINUE; END IF;
      pid:=p->>'id';
      IF (r.ids ? pid) IS NOT TRUE OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR btrim(p->>'name')='' THEN CONTINUE; END IF;
      players:=players||jsonb_build_object(r.wid||'|'||pid,jsonb_build_object('name',left(btrim(p->>'name'),60),
        'num',CASE WHEN jsonb_typeof(p->'num') IN ('string','number') THEN left(btrim(p->>'num'),8) END,
        'pos',CASE WHEN jsonb_typeof(p->'posId')='string' THEN left(regexp_replace(btrim(p->>'posId'),'^pos_',''),12) END));
    END LOOP;
  END LOOP;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id',u.id,
    'email',nullif(btrim(u.email),''),
    'provider',CASE WHEN jsonb_typeof(u.raw_app_meta_data->'provider')='string' THEN left(u.raw_app_meta_data->>'provider',20) END,
    'providers',CASE WHEN jsonb_typeof(u.raw_app_meta_data->'providers')='array' THEN u.raw_app_meta_data->'providers' END,
    'account_name',coalesce(
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'name'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'full_name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'full_name'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'nickname')='string' THEN nullif(btrim(u.raw_user_meta_data->>'nickname'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'display_name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'display_name'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'user_name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'user_name'),'') END),
    'member_name',mn.name,
    'created_at',u.created_at,
    'last_sign_in_at',u.last_sign_in_at,
    'made_count',(SELECT count(*) FROM public.ps_library l WHERE l.owner_id=u.id AND l.deleted_at IS NULL),
    'teams',coalesce(tm.teams,'[]'::jsonb)
  ) ORDER BY u.created_at DESC,u.id),'[]'::jsonb) INTO result
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT min(nullif(btrim(m.name),'')) AS name
    FROM public.ps_members m WHERE m.user_id=u.id
  ) mn ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'workspace_id',w.id,'name',w.name,'kind',w.kind,
      'owner',(w.owner_id=u.id),
      'member_role',m.role,
      'role',CASE WHEN jsonb_typeof(perm_members->(w.id::text)->(u.id::text)->'role')='string'
                  THEN left(perm_members->(w.id::text)->(u.id::text)->>'role',20) END,
      'member_name',nullif(btrim(m.name),''),
      'player',players->(w.id::text||'|'||(perm_members->(w.id::text)->(u.id::text)->>'playerId'))
    ) ORDER BY (w.kind='team') DESC,w.name,w.id) AS teams
    FROM public.ps_members m JOIN public.ps_workspaces w ON w.id=m.workspace_id
    WHERE m.user_id=u.id
  ) tm ON true;
  RETURN result;
END $function$;

COMMENT ON FUNCTION public.ps_admin_people() IS 'process-studio/admin-people/20260930/v1';
REVOKE ALL ON FUNCTION public.ps_admin_people() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_people() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
