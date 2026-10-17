-- ════════════════════════════════════════════════════════════════════════
-- 20261017 · 오류 제보 — 관리자에게 «보낸 사람»
-- 왜: 관리자 «오류 제보» 접수함은 제보마다 «내 글인지»(is_own)만 받아, 누가 보냈는지 알려면 SQL 로
--     reporter_id 를 찾아 «사람» 화면과 맞춰 봐야 했다(사용자 2026-10-17 «오류제보에 누가 올린건지 관리자화면에서 알고 싶다»).
-- 무엇:
--   ① ps_support_reporter(uuid) — 내부 보조(앱 역할 anon · authenticated 는 부르지 못한다).
--      {user_id, name, email, teams:[{name, role}]}. 이름은 ps_admin_people 과 같은 차례 —
--      팀 멤버 이름 → 계정 이름(name · full_name · nickname · display_name · user_name). 팀은 kind='team' 만(개인 공간은 뺀다).
--   ② ps_support_inbox · ps_support_get — **관리자에게만** 제보마다 reporter 를 붙인다.
--      일반 계정의 답 · 옛 칸 · 거르기 · 쪽 넘김은 한 글자도 같다(제보 본문 · 진단 · 답변은 손대지 않는다).
-- 기존 함수 · 정책을 지우는 문장은 없다 — 함수는 이름 · 인자 그대로 몸만 바꾼다. 재실행 안전.
-- 되돌리기: 20261017_support_reporter.rollback.sql
-- ════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214101701);

DO $preflight$
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'support reporter: database administrator required'; END IF;
  IF to_regprocedure('public.ps_is_admin()') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'support reporter: existing admin helpers required';
  END IF;
  IF to_regprocedure('public.ps_support_inbox(integer,jsonb,text)') IS NULL OR to_regprocedure('public.ps_support_get(uuid)') IS NULL
    OR to_regprocedure('public.ps_support_stage(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'support reporter: 20261014_support_triage must be installed first';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE (table_schema,table_name,column_name) IN (
       ('auth','users','id'),('auth','users','email'),('auth','users','raw_user_meta_data'),
       ('public','ps_members','user_id'),('public','ps_members','workspace_id'),('public','ps_members','name'),('public','ps_members','role'),
       ('public','ps_workspaces','id'),('public','ps_workspaces','name'),('public','ps_workspaces','kind')))<>10 THEN
    RAISE EXCEPTION 'support reporter: auth.users / ps_members / ps_workspaces columns missing';
  END IF;
END $preflight$;

/* ① 보낸 사람 — 계정이 지워졌으면 NULL */
CREATE OR REPLACE FUNCTION public.ps_support_reporter(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'user_id',u.id,
    'email',left(nullif(btrim(u.email::text),''),120),
    'name',left(coalesce(mn.name,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'name'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'full_name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'full_name'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'nickname')='string' THEN nullif(btrim(u.raw_user_meta_data->>'nickname'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'display_name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'display_name'),'') END,
      CASE WHEN jsonb_typeof(u.raw_user_meta_data->'user_name')='string' THEN nullif(btrim(u.raw_user_meta_data->>'user_name'),'') END),60),
    'teams',coalesce(tm.teams,'[]'::jsonb)))
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT min(nullif(btrim(m.name),'')) AS name FROM public.ps_members m WHERE m.user_id=u.id
  ) mn ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('name',left(coalesce(nullif(btrim(w.name),''),'(이름 없는 팀)'),60),'role',m.role) ORDER BY w.name,w.id) AS teams
    FROM public.ps_members m JOIN public.ps_workspaces w ON w.id=m.workspace_id
    WHERE m.user_id=u.id AND w.kind='team'
  ) tm ON true
  WHERE u.id=p_user
$$;
REVOKE ALL ON FUNCTION public.ps_support_reporter(uuid) FROM PUBLIC;
DO $acl$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON FUNCTION public.ps_support_reporter(uuid) FROM anon'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON FUNCTION public.ps_support_reporter(uuid) FROM authenticated'; END IF;
END $acl$;
COMMENT ON FUNCTION public.ps_support_reporter(uuid) IS 'process-studio/support-reporter/20261017/v1';

/* ② 목록 — 20261014 판 그대로, 관리자에게만 reporter 를 덧붙인다 */
CREATE OR REPLACE FUNCTION public.ps_support_inbox(p_limit integer DEFAULT 20,p_before jsonb DEFAULT NULL,p_filter text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); admin boolean; n integer; before_at timestamptz; before_id uuid;
  rows jsonb; cursor_value jsonb:=NULL; entry jsonb; counts jsonb:=NULL;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  admin:=public.ps_is_admin() IS TRUE;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>50 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_limit'; END IF;
  IF p_filter IS NOT NULL AND p_filter NOT IN ('needs','answered','closed') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_filter'; END IF;
  IF p_before IS NOT NULL THEN
    PERFORM public.ps_support_fields(p_before,ARRAY['created_at','id'],true);
    before_at:=public.ps_support_time(p_before,'created_at');
    BEGIN before_id:=public.ps_support_text(p_before,'id',36)::uuid; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_cursor'; END;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,
    'is_own',r.reporter_id=actor,'reply_count',(SELECT count(*) FROM public.ps_support_replies q WHERE q.report_id=r.id),
    'last_reply_at',(SELECT max(q.created_at) FROM public.ps_support_replies q WHERE q.report_id=r.id),
    'fixed_in',r.fixed_in,'closed_at',r.closed_at)||r.st
    ||CASE WHEN admin THEN jsonb_build_object('reporter',public.ps_support_reporter(r.reporter_id)) ELSE '{}'::jsonb END
    ORDER BY r.created_at DESC,r.id DESC),'[]'::jsonb)
    INTO rows FROM (SELECT x.*,public.ps_support_stage(x.id,x.status) st FROM public.ps_support_reports x
      WHERE (x.reporter_id=actor OR admin)
        AND (p_before IS NULL OR (x.created_at,x.id)<(before_at,before_id))
        AND (p_filter IS NULL OR public.ps_support_stage(x.id,x.status)->>'stage'=p_filter)
      ORDER BY x.created_at DESC,x.id DESC LIMIT p_limit+1) r;
  n:=jsonb_array_length(rows);
  IF n>p_limit THEN
    rows:=rows-(n-1);entry:=rows->(p_limit-1);cursor_value:=jsonb_build_object('created_at',entry->'created_at','id',entry->'id');
  END IF;
  IF admin THEN
    SELECT jsonb_build_object('needs',count(*) FILTER (WHERE s='needs'),'answered',count(*) FILTER (WHERE s='answered'),
      'closed',count(*) FILTER (WHERE s='closed'),'total',count(*)) INTO counts
      FROM (SELECT public.ps_support_stage(x.id,x.status)->>'stage' s FROM public.ps_support_reports x) t;
  END IF;
  RETURN jsonb_build_object('reports',rows,'next_cursor',cursor_value,'is_admin',admin,'filter',p_filter)
    ||CASE WHEN counts IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('counts',counts) END;
END $$;

/* ③ 한 제보 — 20260915 판 그대로, 관리자에게만 report.reporter */
CREATE OR REPLACE FUNCTION public.ps_support_get(p_report_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); admin boolean; r public.ps_support_reports%ROWTYPE; replies jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  admin:=public.ps_is_admin() IS TRUE;
  SELECT * INTO r FROM public.ps_support_reports WHERE id=p_report_id AND (reporter_id=actor OR admin);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='report_not_found'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'report_id',q.report_id,'body',q.body,'author_role',q.author_role,
    'is_own',q.actor_id=actor,'created_at',q.created_at) ORDER BY q.created_at,q.id),'[]'::jsonb) INTO replies
    FROM public.ps_support_replies q WHERE q.report_id=r.id;
  RETURN jsonb_build_object('report',(to_jsonb(r)-'reporter_id')||jsonb_build_object('is_own',r.reporter_id=actor)
      ||CASE WHEN admin THEN jsonb_build_object('reporter',public.ps_support_reporter(r.reporter_id)) ELSE '{}'::jsonb END,
    'replies',replies);
END $$;

COMMIT;
