-- 20261017_server_hardening — Supabase 보안·성능 경고 가운데 «동작은 그대로 두고 문만 잠그는» 넷.
--   ① search_path 가 열린 함수 6개에 search_path = public 고정(본문은 pg_catalog 내장 함수만 부른다)
--   ② ps_kv_note_denied — 로그인 안 한 사람(anon)도 아무 팀·사람 이름으로 «거절 기록»을 쓸 수 있던 것.
--      부르는 곳은 SECURITY DEFINER 가드 트리거뿐이라(소유자 postgres) PUBLIC·anon·authenticated 실행 권한을 거둔다.
--   ③ 관리자 RPC 30개(ps_admin_* · ps_audit_log)의 anon 실행 권한 — 본문이 관리자 확인을 하므로 지금 뚫린 것은 아니다(이중 잠금).
--      authenticated 의 실행 권한은 그대로(명시 GRANT). 관리자 화면은 로그인한 세션으로만 부른다.
--   ④ ps_usage 의 중복 유일 색인 ps_usage_day_user_feature_uidx(= ps_usage_pkey 와 같은 열) 삭제.
-- 멱등. 운영 상태가 예상과 다르면 예외로 멈추고 아무것도 바꾸지 않는다(한 트랜잭션).
-- 운영 상태(2026-10-17 읽기 전용 조회)와 근거는 20261017_server_hardening.runbook.md.
BEGIN;
DO $m$
DECLARE
  fixed_path constant text[] := array[
    'ps_build_lt(text,text)','ps_key_scope(text)','ps_kv_noop_guard()','ps_request_build()','ps_touch()','ps_try_jsonb(text)'];
  admin_rpc constant text[] := array[
    'ps_admin_activity_keys(integer)','ps_admin_activity_users()','ps_admin_activity_ws()','ps_admin_delete_workspace(uuid)',
    'ps_admin_event_breakdown(integer)','ps_admin_event_summary()','ps_admin_event_summary_v2()','ps_admin_health()',
    'ps_admin_idp_funnel()','ps_admin_idp_get(uuid)','ps_admin_idp_users()','ps_admin_kv_history(text,text,integer)',
    'ps_admin_library(uuid,boolean)','ps_admin_library_item(uuid,text)','ps_admin_log(text,uuid,text,jsonb)','ps_admin_members(uuid)',
    'ps_admin_reach()','ps_admin_recent_activity(integer,integer,uuid,uuid)','ps_admin_remove_member(uuid,uuid)',
    'ps_admin_restore_lib(uuid,text)','ps_admin_soft_delete_lib(uuid,text)','ps_admin_sync_stuck(integer)','ps_admin_team_idp(uuid)',
    'ps_admin_usage_daily(integer)','ps_admin_usage_features(integer)','ps_admin_usage_summary()','ps_admin_users()',
    'ps_admin_versions(integer)','ps_admin_workspaces()','ps_audit_log()'];
  note constant text := 'ps_kv_note_denied(uuid,uuid,text,text)';
  f text; o regprocedure; cfg text[]; bad text; pk_cols int2vector; dup_cols int2vector;
BEGIN
  -- ── 먼저 전부 확인(하나라도 어긋나면 아무것도 바꾸지 않는다) ─────────────
  FOREACH f IN ARRAY fixed_path LOOP
    o := to_regprocedure('public.'||f);
    IF o IS NULL THEN RAISE EXCEPTION '20261017: public.% 이 없습니다 — 아무것도 바꾸지 않았습니다', f; END IF;
    SELECT proconfig INTO cfg FROM pg_proc WHERE oid=o;
    IF cfg IS NOT NULL AND cfg <> array['search_path=public'] THEN
      RAISE EXCEPTION '20261017: public.% 설정이 예상과 다릅니다(%) — 아무것도 바꾸지 않았습니다', f, cfg;
    END IF;
  END LOOP;

  o := to_regprocedure('public.'||note);
  IF o IS NULL THEN RAISE EXCEPTION '20261017: public.% 이 없습니다 — 아무것도 바꾸지 않았습니다', note; END IF;
  -- 부르는 함수가 모두 같은 소유자의 SECURITY DEFINER 여야 권한을 거둬도 거절 기록이 계속 남는다.
  SELECT string_agg(p.proname, ', ') INTO bad FROM pg_proc p
   WHERE p.pronamespace='public'::regnamespace AND p.oid<>o AND p.prosrc LIKE '%ps_kv_note_denied%'
     AND NOT (p.prosecdef AND p.proowner=(SELECT proowner FROM pg_proc WHERE oid=o));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '20261017: ps_kv_note_denied 를 SECURITY DEFINER 가 아닌 곳에서 부릅니다(%) — 아무것도 바꾸지 않았습니다', bad;
  END IF;

  FOREACH f IN ARRAY admin_rpc LOOP
    o := to_regprocedure('public.'||f);
    CONTINUE WHEN o IS NULL;   -- 이미 지운 함수는 건너뛴다
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=o) THEN
      RAISE EXCEPTION '20261017: public.% 이 SECURITY DEFINER 가 아닙니다 — 아무것도 바꾸지 않았습니다', f;
    END IF;
    IF NOT has_function_privilege('authenticated', o, 'EXECUTE') THEN
      RAISE EXCEPTION '20261017: public.% 을 authenticated 가 실행하지 못합니다(예상 밖) — 아무것도 바꾸지 않았습니다', f;
    END IF;
  END LOOP;

  IF to_regclass('public.ps_usage_day_user_feature_uidx') IS NOT NULL THEN
    SELECT indkey INTO pk_cols FROM pg_index WHERE indexrelid='public.ps_usage_pkey'::regclass;
    SELECT indkey INTO dup_cols FROM pg_index WHERE indexrelid='public.ps_usage_day_user_feature_uidx'::regclass
       AND indrelid='public.ps_usage'::regclass AND indisunique AND indpred IS NULL AND indexprs IS NULL;
    IF dup_cols IS NULL OR pk_cols IS NULL OR dup_cols::text <> pk_cols::text THEN
      RAISE EXCEPTION '20261017: ps_usage_day_user_feature_uidx 가 ps_usage_pkey 와 같은 색인이 아닙니다 — 아무것도 바꾸지 않았습니다';
    END IF;
  END IF;

  -- ── 바꾸기 ─────────────────────────────────────────────
  -- ①
  FOREACH f IN ARRAY fixed_path LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', f);
  END LOOP;
  -- ②
  EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', note);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', note);
  -- ③
  FOREACH f IN ARRAY admin_rpc LOOP
    CONTINUE WHEN to_regprocedure('public.'||f) IS NULL;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  -- ④
  DROP INDEX IF EXISTS public.ps_usage_day_user_feature_uidx;

  -- 목록 밖에서 새로 생긴 관리자 함수가 anon 에게 열려 있으면 알리기만 한다(검토 전이라 건드리지 않는다).
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO bad FROM pg_proc p
   WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE 'ps\_admin\_%' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF bad IS NOT NULL THEN RAISE NOTICE '20261017: 목록 밖 관리자 함수가 아직 anon 에게 열려 있습니다 — %', bad; END IF;
  RAISE NOTICE '20261017: server hardening 적용';
END
$m$;
COMMIT;
