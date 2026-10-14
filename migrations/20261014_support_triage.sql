-- ════════════════════════════════════════════════════════════════════════
-- 20261014 · 오류 제보 처리 상태(관리자 접수함)
-- 왜: 제보 30건이 모두 «열림»이다. 표에 open/closed 칸은 있었지만 닫는 길이 없었다 —
--     새 제보 · 답변만 한 제보 · 고쳐서 배포까지 끝난 제보가 구분되지 않아, 답변 안 한 1건을
--     찾으려고 SQL 로 뒤져야 했다(2026-10-14).
-- 무엇:
--   ① ps_support_reports 에 fixed_in(고친 판, 예 '3.029') · closed_at(닫은 시각) 칸.
--   ② ps_support_list(p_limit, p_before, p_filter) — 줄마다 단계(stage)를 서버가 정한다:
--        closed   = 닫힘
--        answered = 열림 · 마지막 글이 운영자
--        needs    = 열림 · 글이 없거나 마지막 글이 제보자(답변 필요 — has_admin_reply 면 «재문의»)
--      p_filter(needs|answered|closed|NULL=전체)로 거르고, 관리자에게는 단계별 개수(counts)를 준다.
--      앱의 옛 호출(p_limit, p_before 이름 인자)은 그대로 된다 — p_filter 기본값 NULL.
--   ③ ps_support_set_status(p_report_id, p_status, p_fixed_in) — 관리자만. 열기/닫기 · 고친 판.
--      관리자 작업 기록(ps_admin_actions)에 남긴다.
--   ④ ps_support_reply — 제보자가 닫힌 제보에 글을 쓰면 다시 연다(운영자 글은 상태를 바꾸지 않는다).
-- 제보 본문·진단은 손대지 않는다. 재실행 안전. 되돌리기: 20261014_support_triage.rollback.sql
-- ════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214101401);

DO $preflight$
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'support triage: database administrator required'; END IF;
  IF to_regprocedure('public.ps_is_admin()') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'support triage: existing admin helpers required';
  END IF;
  IF to_regclass('public.ps_support_reports') IS NULL OR to_regclass('public.ps_support_replies') IS NULL THEN
    RAISE EXCEPTION 'support triage: 20260915_support_reports must be installed first';
  END IF;
  IF to_regclass('public.ps_admin_actions') IS NULL THEN
    RAISE EXCEPTION 'support triage: ps_admin_actions (admin action log) required';
  END IF;
  IF to_regprocedure('public.ps_support_list(integer,jsonb)') IS NULL AND to_regprocedure('public.ps_support_list(integer,jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'support triage: ps_support_list missing';
  END IF;
END $preflight$;

ALTER TABLE public.ps_support_reports ADD COLUMN IF NOT EXISTS fixed_in text;
ALTER TABLE public.ps_support_reports ADD COLUMN IF NOT EXISTS closed_at timestamptz;
DO $chk$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.ps_support_reports'::regclass AND conname='ps_support_reports_fixed_in_chk') THEN
    ALTER TABLE public.ps_support_reports ADD CONSTRAINT ps_support_reports_fixed_in_chk CHECK (fixed_in IS NULL OR fixed_in ~ '^[0-9]{1,2}\.[0-9]{3}$');
  END IF;
END $chk$;

/* 한 제보의 단계. 목록 · 개수 · 상태 바꾸기가 같은 판정을 쓴다. */
/* 앱 계정은 직접 못 부른다(아래 REVOKE) — 관리자 판정이 끝난 SECURITY DEFINER 함수 안에서만. */
CREATE OR REPLACE FUNCTION public.ps_support_stage(p_report_id uuid,p_status text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object(
    'stage',CASE WHEN p_status='closed' THEN 'closed' WHEN last.author_role='admin' THEN 'answered' ELSE 'needs' END,
    'last_role',last.author_role,
    'has_admin_reply',EXISTS(SELECT 1 FROM public.ps_support_replies q WHERE q.report_id=p_report_id AND q.author_role='admin'))
  FROM (SELECT (SELECT q.author_role FROM public.ps_support_replies q WHERE q.report_id=p_report_id ORDER BY q.created_at DESC,q.id DESC LIMIT 1) author_role) last
$$;

DROP FUNCTION IF EXISTS public.ps_support_list(integer,jsonb);
CREATE OR REPLACE FUNCTION public.ps_support_list(p_limit integer DEFAULT 20,p_before jsonb DEFAULT NULL,p_filter text DEFAULT NULL) RETURNS jsonb
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
    'fixed_in',r.fixed_in,'closed_at',r.closed_at)||r.st ORDER BY r.created_at DESC,r.id DESC),'[]'::jsonb)
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

CREATE OR REPLACE FUNCTION public.ps_support_set_status(p_report_id uuid,p_status text,p_fixed_in text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); r public.ps_support_reports%ROWTYPE; fixed text:=nullif(btrim(coalesce(p_fixed_in,'')),'');
BEGIN
  IF actor IS NULL OR public.ps_is_admin() IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='support_not_admin'; END IF;
  IF p_report_id IS NULL OR p_status IS NULL OR p_status NOT IN ('open','closed') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_status'; END IF;
  IF fixed IS NOT NULL AND fixed !~ '^[0-9]{1,2}\.[0-9]{3}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_fixed_in'; END IF;
  SELECT * INTO r FROM public.ps_support_reports WHERE id=p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='report_not_found'; END IF;
  IF r.status IS DISTINCT FROM p_status OR r.fixed_in IS DISTINCT FROM fixed THEN
    UPDATE public.ps_support_reports SET status=p_status,fixed_in=fixed,
      closed_at=CASE WHEN p_status='closed' THEN coalesce(r.closed_at,clock_timestamp()) ELSE NULL END
      WHERE id=p_report_id RETURNING * INTO r;
    INSERT INTO public.ps_admin_actions(admin_id,action,workspace_id,target_id,meta)
      VALUES(actor,'support_status',NULL,p_report_id::text,jsonb_build_object('status',p_status,'fixed_in',fixed));
  END IF;
  RETURN jsonb_build_object('id',r.id,'status',r.status,'fixed_in',r.fixed_in,'closed_at',r.closed_at)||public.ps_support_stage(r.id,r.status);
END $$;

CREATE OR REPLACE FUNCTION public.ps_support_reply(p_id uuid,p_report_id uuid,p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); admin boolean; report public.ps_support_reports%ROWTYPE; r public.ps_support_replies%ROWTYPE;
  body_value text:=btrim(p_body,E' \t\n\r\f\013'); inserted boolean;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  IF p_id IS NULL OR p_report_id IS NULL OR body_value IS NULL OR char_length(body_value) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_reply'; END IF;
  admin:=public.ps_is_admin() IS TRUE;
  SELECT * INTO report FROM public.ps_support_reports WHERE id=p_report_id AND (reporter_id=actor OR admin) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='report_not_found'; END IF;
  INSERT INTO public.ps_support_replies(id,report_id,actor_id,author_role,body)
    VALUES(p_id,p_report_id,actor,CASE WHEN admin THEN 'admin' ELSE 'reporter' END,body_value) ON CONFLICT(id) DO NOTHING;
  inserted:=FOUND;
  SELECT * INTO r FROM public.ps_support_replies WHERE id=p_id;
  IF r.actor_id IS DISTINCT FROM actor OR r.report_id IS DISTINCT FROM p_report_id OR r.body IS DISTINCT FROM body_value THEN
    RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='reply_id_conflict';
  END IF;
  IF inserted THEN
    UPDATE public.ps_support_reports SET updated_at=clock_timestamp(),
      status=CASE WHEN r.author_role='reporter' THEN 'open' ELSE status END,
      closed_at=CASE WHEN r.author_role='reporter' THEN NULL ELSE closed_at END
      WHERE id=p_report_id;
  END IF;
  RETURN (to_jsonb(r)-'actor_id')||jsonb_build_object('is_own',true);
END $$;

DO $secure$
DECLARE x record; marker constant text:='process-studio/support-triage/20261014/v1';
BEGIN
  FOR x IN SELECT p.oid::regprocedure AS name FROM pg_catalog.pg_proc p
    WHERE p.oid IN (to_regprocedure('public.ps_support_stage(uuid,text)'),to_regprocedure('public.ps_support_list(integer,jsonb,text)'),
                    to_regprocedure('public.ps_support_set_status(uuid,text,text)'),to_regprocedure('public.ps_support_reply(uuid,uuid,text)')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.name);
    EXECUTE format('COMMENT ON FUNCTION %s IS %L',x.name,marker);
  END LOOP;
END $secure$;
GRANT EXECUTE ON FUNCTION public.ps_support_list(integer,jsonb,text),public.ps_support_set_status(uuid,text,text),public.ps_support_reply(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
