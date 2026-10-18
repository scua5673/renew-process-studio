-- 20261017_support_reporter 되돌리기 — 목록(ps_support_inbox) · 한 제보(ps_support_get)를 20261014 · 20260915 판 몸으로.
-- 관리자 답에서 reporter 만 빠진다. 제보 · 답변 · 상태 자료는 그대로. 보조 ps_support_reporter 는 남겨 둔다(앱 역할은 못 부른다 —
-- 다시 설치하면 그대로 쓴다). 지우려면 맨 아래 주석 줄.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214101701);

/* 20261014_support_triage 의 목록 그대로 */
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

/* 20260915_support_reports 의 한 제보 그대로 */
CREATE OR REPLACE FUNCTION public.ps_support_get(p_report_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); r public.ps_support_reports%ROWTYPE; replies jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  SELECT * INTO r FROM public.ps_support_reports WHERE id=p_report_id AND (reporter_id=actor OR public.ps_is_admin() IS TRUE);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='report_not_found'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'report_id',q.report_id,'body',q.body,'author_role',q.author_role,
    'is_own',q.actor_id=actor,'created_at',q.created_at) ORDER BY q.created_at,q.id),'[]'::jsonb) INTO replies
    FROM public.ps_support_replies q WHERE q.report_id=r.id;
  RETURN jsonb_build_object('report',(to_jsonb(r)-'reporter_id')||jsonb_build_object('is_own',r.reporter_id=actor),'replies',replies);
END $$;

COMMIT;
-- 보조까지 지우려면(설치 · 되돌리기 문장에는 DROP 을 두지 않는다 — 연결 도구에서 확인 대기로 멈췄다, 20261014 applied.md):
-- DROP FUNCTION IF EXISTS public.ps_support_reporter(uuid);
