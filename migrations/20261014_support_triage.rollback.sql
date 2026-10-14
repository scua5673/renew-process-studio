-- 20261014_support_triage 되돌리기 — 목록·답변 함수를 20260915 판으로, 상태 바꾸기·단계 함수는 지운다.
-- 칸(fixed_in · closed_at)과 그 값은 남긴다(옛 함수는 읽지 않을 뿐 — 자료를 지우지 않는다).
-- 칸까지 지우려면 맨 아래 주석을 풀 것. ⚠ 닫은 표시·고친 판 기록이 사라진다.
BEGIN;
SET LOCAL lock_timeout='5s';
DROP FUNCTION IF EXISTS public.ps_support_set_status(uuid,text,text);
DROP FUNCTION IF EXISTS public.ps_support_list(integer,jsonb,text);
CREATE OR REPLACE FUNCTION public.ps_support_list(p_limit integer DEFAULT 20,p_before jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); admin boolean; n integer; before_at timestamptz; before_id uuid;
  rows jsonb; cursor_value jsonb:=NULL; entry jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  admin:=public.ps_is_admin() IS TRUE;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>50 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_limit'; END IF;
  IF p_before IS NOT NULL THEN
    PERFORM public.ps_support_fields(p_before,ARRAY['created_at','id'],true);
    before_at:=public.ps_support_time(p_before,'created_at');
    BEGIN before_id:=public.ps_support_text(p_before,'id',36)::uuid; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_cursor'; END;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,
    'is_own',r.reporter_id=actor,'reply_count',(SELECT count(*) FROM public.ps_support_replies q WHERE q.report_id=r.id),
    'last_reply_at',(SELECT max(q.created_at) FROM public.ps_support_replies q WHERE q.report_id=r.id)) ORDER BY r.created_at DESC,r.id DESC),'[]'::jsonb)
    INTO rows FROM (SELECT * FROM public.ps_support_reports WHERE (reporter_id=actor OR admin)
      AND (p_before IS NULL OR (created_at,id)<(before_at,before_id)) ORDER BY created_at DESC,id DESC LIMIT p_limit+1) r;
  n:=jsonb_array_length(rows);
  IF n>p_limit THEN
    rows:=rows-(n-1);entry:=rows->(p_limit-1);cursor_value:=jsonb_build_object('created_at',entry->'created_at','id',entry->'id');
  END IF;
  RETURN jsonb_build_object('reports',rows,'next_cursor',cursor_value,'is_admin',admin);
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
  IF inserted THEN UPDATE public.ps_support_reports SET updated_at=clock_timestamp() WHERE id=p_report_id; END IF;
  RETURN (to_jsonb(r)-'actor_id')||jsonb_build_object('is_own',true);
END $$;
DROP FUNCTION IF EXISTS public.ps_support_stage(uuid,text);
DO $secure$
DECLARE x record; marker constant text:='process-studio/support-reports/20260915/v1';
BEGIN
  FOR x IN SELECT p.oid::regprocedure AS name FROM pg_catalog.pg_proc p
    WHERE p.oid IN (to_regprocedure('public.ps_support_list(integer,jsonb)'),to_regprocedure('public.ps_support_reply(uuid,uuid,text)')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.name);
    EXECUTE format('COMMENT ON FUNCTION %s IS %L',x.name,marker);
  END LOOP;
END $secure$;
GRANT EXECUTE ON FUNCTION public.ps_support_list(integer,jsonb),public.ps_support_reply(uuid,uuid,text) TO authenticated;
-- UPDATE public.ps_support_reports SET status='open' WHERE status='closed';   -- 닫힘을 모두 되돌리려면
-- ALTER TABLE public.ps_support_reports DROP CONSTRAINT IF EXISTS ps_support_reports_fixed_in_chk, DROP COLUMN IF EXISTS fixed_in, DROP COLUMN IF EXISTS closed_at;
NOTIFY pgrst,'reload schema';
COMMIT;
