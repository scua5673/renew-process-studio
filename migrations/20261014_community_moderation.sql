-- ════════════════════════════════════════════════════════════════════════
-- 20261014 · 커뮤니티 신고함 · 글 숨기기(관리자)
-- 왜: 커뮤니티의 «신고»는 ps_comm_reports 에 쌓이지만(2026-10-14 기준 2건 — 8월 공개 글 1 · 이미 지운 글 1)
--     관리자 화면 어디에서도 읽지 않았고, 관리자가 글을 내릴 길도 없었다(글 주인만 지울 수 있다).
-- 무엇:
--   ① ps_community 에 hidden_at · hidden_by · hidden_reason — 숨긴 글은 모두에게(글 주인 포함) 안 보인다.
--      읽기 정책 comm_sel: NOT deleted → NOT deleted AND hidden_at IS NULL.
--      숨김 칸은 아래 관리자 함수만 바꾼다(트리거 — 앱 계정이 PATCH 로 지우거나 INSERT 로 넣어도 무시).
--   ② ps_comm_reports 에 resolved_at · resolved_by — «검토 끝». 숨기면 그 글의 열린 신고도 함께 닫는다.
--   ③ 관리자 함수(ps_is_admin): ps_admin_comm_queue(목록) · ps_admin_comm_hide(숨김/되살림) · ps_admin_comm_resolve(문제 없음).
--      ps_admin_actions 에 community_hide · community_unhide · community_resolve 로 남긴다.
--   글 본문(item)은 돌려주지 않는다 — 제목 · 요약 앞 200자 · 작성자 표시 이름만.
-- 재실행 안전. 되돌리기: 20261014_community_moderation.rollback.sql
-- ════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $preflight$
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'community moderation: database administrator required'; END IF;
  IF to_regprocedure('public.ps_is_admin()') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'community moderation: existing admin helpers required';
  END IF;
  IF to_regclass('public.ps_community') IS NULL OR to_regclass('public.ps_comm_reports') IS NULL OR to_regclass('public.ps_admin_actions') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'community moderation: expected tables missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.ps_community'::regclass AND polname='comm_sel') THEN
    RAISE EXCEPTION 'community moderation: read policy comm_sel missing — check the community table before changing it';
  END IF;
END $preflight$;

ALTER TABLE public.ps_community ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE public.ps_community ADD COLUMN IF NOT EXISTS hidden_by uuid;
ALTER TABLE public.ps_community ADD COLUMN IF NOT EXISTS hidden_reason text;
ALTER TABLE public.ps_comm_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.ps_comm_reports ADD COLUMN IF NOT EXISTS resolved_by uuid;
DO $chk$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.ps_community'::regclass AND conname='ps_community_hidden_reason_chk') THEN
    ALTER TABLE public.ps_community ADD CONSTRAINT ps_community_hidden_reason_chk CHECK (hidden_reason IS NULL OR char_length(hidden_reason)<=200);
  END IF;
END $chk$;

/* 숨김 칸은 관리자 함수(아래, 거래 안에서 ps.comm_moderation=on)만 바꾼다. 앱 계정의 PATCH · INSERT 는 그 칸을 그대로 둔다. */
CREATE OR REPLACE FUNCTION public.ps_comm_moderation_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF coalesce(current_setting('ps.comm_moderation',true),'')='on' THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    NEW.hidden_at:=NULL;NEW.hidden_by:=NULL;NEW.hidden_reason:=NULL;
  ELSE
    NEW.hidden_at:=OLD.hidden_at;NEW.hidden_by:=OLD.hidden_by;NEW.hidden_reason:=OLD.hidden_reason;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER ps_comm_moderation_guard_t BEFORE INSERT OR UPDATE ON public.ps_community
  FOR EACH ROW EXECUTE FUNCTION public.ps_comm_moderation_guard();

/* 같은 정책을 고친다(지우고 다시 만들지 않는다) — 역할(anon · authenticated)과 명령(SELECT)은 그대로 */
ALTER POLICY comm_sel ON public.ps_community USING (NOT deleted AND hidden_at IS NULL);

CREATE OR REPLACE FUNCTION public.ps_admin_comm_queue(p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE reported jsonb; hidden jsonb; counts jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.ps_is_admin() IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='admin_required'; END IF;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>200 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_limit'; END IF;
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'last_report_at') DESC),'[]'::jsonb) INTO reported FROM (
    SELECT jsonb_build_object('pub_id',r.pub_id,'reports',count(*),'reporters',count(DISTINCT r.reporter),'anonymous',count(*) FILTER (WHERE r.reporter IS NULL),
      'first_report_at',min(r.at),'last_report_at',max(r.at),
      'reasons',coalesce((SELECT jsonb_agg(DISTINCT left(q.reason,200)) FROM public.ps_comm_reports q WHERE q.pub_id=r.pub_id AND q.resolved_at IS NULL AND btrim(q.reason)<>''),'[]'::jsonb),
      'exists',c.id IS NOT NULL,'title',left(c.title,120),'summary',left(c.summary,200),'cat',c.cat,'owner_name',left(c.owner_name,60),
      'owner_email',(SELECT u.email::text FROM auth.users u WHERE u.id=c.owner),'created_at',c.created_at,'views',c.views,'likes',c.likes,'copies',c.copies,
      'deleted',coalesce(c.deleted,false),'hidden_at',c.hidden_at) x
    FROM public.ps_comm_reports r LEFT JOIN public.ps_community c ON c.id=r.pub_id
    WHERE r.resolved_at IS NULL
    GROUP BY r.pub_id,c.id ORDER BY max(r.at) DESC LIMIT p_limit) t;
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'hidden_at') DESC),'[]'::jsonb) INTO hidden FROM (
    SELECT jsonb_build_object('pub_id',c.id,'title',left(c.title,120),'summary',left(c.summary,200),'owner_name',left(c.owner_name,60),
      'owner_email',(SELECT u.email::text FROM auth.users u WHERE u.id=c.owner),'created_at',c.created_at,
      'hidden_at',c.hidden_at,'hidden_reason',c.hidden_reason,'hidden_by_email',(SELECT u.email::text FROM auth.users u WHERE u.id=c.hidden_by)) x
    FROM public.ps_community c WHERE c.hidden_at IS NOT NULL ORDER BY c.hidden_at DESC LIMIT p_limit) t;
  SELECT jsonb_build_object('open_reports',(SELECT count(*) FROM public.ps_comm_reports WHERE resolved_at IS NULL),
    'reported_posts',(SELECT count(DISTINCT pub_id) FROM public.ps_comm_reports WHERE resolved_at IS NULL),
    'hidden_posts',(SELECT count(*) FROM public.ps_community WHERE hidden_at IS NOT NULL)) INTO counts;
  RETURN jsonb_build_object('reported',reported,'hidden',hidden,'counts',counts);
END $$;

CREATE OR REPLACE FUNCTION public.ps_admin_comm_hide(p_pub_id text,p_hidden boolean,p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); c public.ps_community%ROWTYPE; reason text:=nullif(btrim(coalesce(p_reason,'')),''); closed integer:=0;
BEGIN
  IF actor IS NULL OR public.ps_is_admin() IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='admin_required'; END IF;
  IF p_pub_id IS NULL OR p_hidden IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_request'; END IF;
  IF reason IS NOT NULL AND char_length(reason)>200 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='reason_too_long'; END IF;
  SELECT * INTO c FROM public.ps_community WHERE id=p_pub_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='post_not_found'; END IF;
  PERFORM set_config('ps.comm_moderation','on',true);
  IF p_hidden AND c.hidden_at IS NULL THEN
    UPDATE public.ps_community SET hidden_at=clock_timestamp(),hidden_by=actor,hidden_reason=reason WHERE id=p_pub_id RETURNING * INTO c;
    UPDATE public.ps_comm_reports SET resolved_at=clock_timestamp(),resolved_by=actor WHERE pub_id=p_pub_id AND resolved_at IS NULL;
    GET DIAGNOSTICS closed=ROW_COUNT;
    INSERT INTO public.ps_admin_actions(admin_id,action,workspace_id,target_id,meta)
      VALUES(actor,'community_hide',NULL,p_pub_id,jsonb_build_object('reason',reason,'reports_closed',closed));
  ELSIF NOT p_hidden AND c.hidden_at IS NOT NULL THEN
    UPDATE public.ps_community SET hidden_at=NULL,hidden_by=NULL,hidden_reason=NULL WHERE id=p_pub_id RETURNING * INTO c;
    INSERT INTO public.ps_admin_actions(admin_id,action,workspace_id,target_id,meta)
      VALUES(actor,'community_unhide',NULL,p_pub_id,jsonb_build_object('reason',reason));
  END IF;
  PERFORM set_config('ps.comm_moderation','',true);
  RETURN jsonb_build_object('pub_id',c.id,'hidden_at',c.hidden_at,'hidden_reason',c.hidden_reason,'reports_closed',closed);
END $$;

CREATE OR REPLACE FUNCTION public.ps_admin_comm_resolve(p_pub_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); closed integer:=0;
BEGIN
  IF actor IS NULL OR public.ps_is_admin() IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='admin_required'; END IF;
  IF p_pub_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_request'; END IF;
  UPDATE public.ps_comm_reports SET resolved_at=clock_timestamp(),resolved_by=actor WHERE pub_id=p_pub_id AND resolved_at IS NULL;
  GET DIAGNOSTICS closed=ROW_COUNT;
  IF closed>0 THEN
    INSERT INTO public.ps_admin_actions(admin_id,action,workspace_id,target_id,meta)
      VALUES(actor,'community_resolve',NULL,p_pub_id,jsonb_build_object('reports_closed',closed));
  END IF;
  RETURN jsonb_build_object('pub_id',p_pub_id,'reports_closed',closed);
END $$;

DO $secure$
DECLARE x record; marker constant text:='process-studio/community-moderation/20261014/v1';
BEGIN
  FOR x IN SELECT p.oid::regprocedure AS name FROM pg_catalog.pg_proc p
    WHERE p.oid IN (to_regprocedure('public.ps_comm_moderation_guard()'),to_regprocedure('public.ps_admin_comm_queue(integer)'),
                    to_regprocedure('public.ps_admin_comm_hide(text,boolean,text)'),to_regprocedure('public.ps_admin_comm_resolve(text)')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.name);
    EXECUTE format('COMMENT ON FUNCTION %s IS %L',x.name,marker);
  END LOOP;
END $secure$;
GRANT EXECUTE ON FUNCTION public.ps_admin_comm_queue(integer),public.ps_admin_comm_hide(text,boolean,text),public.ps_admin_comm_resolve(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
