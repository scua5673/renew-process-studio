-- ════════════════════════════════════════════════════════════════════════
-- 20261014 · 관리자 작업 기록 보기(ps_admin_actions_list)
-- 왜: 팀 삭제 · 멤버 내보내기 · 콘텐츠 삭제/복구는 이미 ps_admin_log 로 ps_admin_actions 에 남는다
--     (운영 함수 확인 2026-10-14). 그런데 그 기록을 읽는 곳이 없어 «누가 언제 지웠나»를 SQL 로만 볼 수 있었다.
--     오류 제보 상태(20261014_support_triage)와 커뮤니티 숨김(20261014_community_moderation)도 같은 표에 남는다.
-- 무엇: 관리자만 부르는 읽기 함수 하나. 최신순, before_id 로 넘긴다.
--       누가(관리자 메일) · 무엇(action) · 대상(팀 이름 — 지운 팀은 기록 당시 이름 / 제보 제목 / 콘텐츠 이름 / 글 제목) · meta.
--       콘텐츠 본문 · 제보 본문은 돌려주지 않는다(제목 앞 80자까지만).
-- 쓰기 없음. 재실행 안전. 되돌리기: 20261014_admin_actions_view.rollback.sql
-- ════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $preflight$
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'admin actions view: database administrator required'; END IF;
  IF to_regprocedure('public.ps_is_admin()') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'admin actions view: existing admin helpers required';
  END IF;
  IF to_regclass('public.ps_admin_actions') IS NULL OR to_regclass('public.ps_workspaces') IS NULL OR to_regclass('public.ps_library') IS NULL
     OR to_regclass('auth.users') IS NULL OR to_regclass('public.ps_support_reports') IS NULL OR to_regclass('public.ps_community') IS NULL THEN
    RAISE EXCEPTION 'admin actions view: expected tables missing';
  END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.ps_admin_actions_list(p_limit integer DEFAULT 50,p_before_id bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE rows jsonb; n integer;
BEGIN
  IF auth.uid() IS NULL OR public.ps_is_admin() IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='admin_required'; END IF;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>200 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_limit'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'at',a.created_at,'action',a.action,'admin_email',u.email::text,'admin_id',a.admin_id,
      'workspace_id',a.workspace_id,'workspace_name',coalesce(w.name,a.meta->>'name'),'workspace_gone',a.workspace_id IS NOT NULL AND w.id IS NULL,
      'target_id',a.target_id,'target_name',left(coalesce(t.name,''),80),'meta',a.meta) ORDER BY a.id DESC),'[]'::jsonb)
    INTO rows
    FROM (SELECT * FROM public.ps_admin_actions WHERE p_before_id IS NULL OR id<p_before_id ORDER BY id DESC LIMIT p_limit+1) a
    LEFT JOIN auth.users u ON u.id=a.admin_id
    LEFT JOIN public.ps_workspaces w ON w.id=a.workspace_id
    LEFT JOIN LATERAL (
      SELECT CASE
        WHEN a.action IN ('library_soft_delete','library_restore') THEN (SELECT l.name FROM public.ps_library l WHERE l.workspace_id=a.workspace_id AND l.lib_id=a.target_id LIMIT 1)
        WHEN a.action='support_status' THEN (SELECT r.title FROM public.ps_support_reports r WHERE r.id::text=a.target_id LIMIT 1)
        WHEN a.action IN ('community_hide','community_unhide','community_resolve') THEN (SELECT c.title FROM public.ps_community c WHERE c.id=a.target_id LIMIT 1)
        WHEN a.action='member_remove' THEN (SELECT x.email::text FROM auth.users x WHERE x.id::text=a.target_id LIMIT 1)
        END name) t ON true;
  n:=jsonb_array_length(rows);
  RETURN jsonb_build_object('rows',CASE WHEN n>p_limit THEN rows-(n-1) ELSE rows END,
    'next_before',CASE WHEN n>p_limit THEN (rows->(p_limit-1)->>'id')::bigint ELSE NULL END);
END $$;

REVOKE ALL ON FUNCTION public.ps_admin_actions_list(integer,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_actions_list(integer,bigint) TO authenticated;
COMMENT ON FUNCTION public.ps_admin_actions_list(integer,bigint) IS 'process-studio/admin-actions-view/20261014/v1';
NOTIFY pgrst,'reload schema';
COMMIT;
